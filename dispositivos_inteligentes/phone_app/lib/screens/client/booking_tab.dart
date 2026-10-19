import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/client_provider.dart';
import '../../widgets/voice_note_recorder.dart';

class BookingTab extends StatefulWidget {
  const BookingTab({super.key});

  @override
  State<BookingTab> createState() => _BookingTabState();
}

class _BookingTabState extends State<BookingTab> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _phoneController;

  String? _audioFilePath;
  Key _voiceRecorderKey = UniqueKey();
  bool _isSubmitting = false;

  String _selectedService = 'Corte Clásico';
  DateTime _selectedDate = DateTime.now();
  String _selectedTime = '10:00';

  final List<String> _services = [
    'Corte Clásico',
    'Perfilado de Barba',
    'Paquete Completo',
    'Tinte / Decoloración',
  ];

  final List<String> _availableTimes = [
    '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30',
    '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30'
  ];

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    _nameController = TextEditingController(text: auth.user?.usuario ?? '');
    _phoneController = TextEditingController(text: auth.user?.telefono ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppColors.amarillo,
              onPrimary: Colors.black,
              surface: AppColors.azulOscuro,
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  void _submitAppointment() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isSubmitting = true;
      });

      final clientProvider = Provider.of<ClientProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final formattedDate = DateFormat('yyyy-MM-dd').format(_selectedDate);

      String? audioFinalUrl;

      // 1. Si el cliente grabó nota de voz, la subimos usando la URL preasignada
      if (_audioFilePath != null && _audioFilePath!.isNotEmpty) {
        final audioFile = File(_audioFilePath!);
        if (await audioFile.exists()) {
          try {
            final audioBytes = await audioFile.readAsBytes();

            // Solicitar URL preasignada al backend
            final presignedData = await clientProvider.getAudioPresignedUrl(
              fileName: 'nota_cita_${DateTime.now().millisecondsSinceEpoch}.m4a',
            );

            if (presignedData != null && presignedData['uploadUrl'] != null) {
              final uploadSuccess = await clientProvider.uploadAudioToPresignedUrl(
                presignedData['uploadUrl'],
                audioBytes,
              );

              if (uploadSuccess) {
                audioFinalUrl = presignedData['fileUrl'];
              } else {
                setState(() => _isSubmitting = false);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Error al subir la nota de voz. Inténtalo de nuevo.'),
                    backgroundColor: AppColors.rojo,
                  ),
                );
                return;
              }
            } else {
              setState(() => _isSubmitting = false);
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Error al autorizar la subida de la nota de voz.'),
                  backgroundColor: AppColors.rojo,
                ),
              );
              return;
            }
          } catch (e) {
            setState(() => _isSubmitting = false);
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Error procesando audio: $e'),
                backgroundColor: AppColors.rojo,
              ),
            );
            return;
          }
        }
      }

      // 2. Crear la cita guardando la URL del audio en el campo notas
      final success = await clientProvider.createAppointment(
        nombreCompleto: _nameController.text.trim(),
        telefono: _phoneController.text.trim(),
        correo: auth.user?.email ?? '',
        servicio: _selectedService,
        fechaCita: formattedDate,
        horaCita: _selectedTime,
        notas: audioFinalUrl,
      );

      setState(() {
        _isSubmitting = false;
      });

      if (success) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cita agendada con éxito'),
            backgroundColor: AppColors.verdeExito,
          ),
        );
        setState(() {
          _audioFilePath = null;
          _voiceRecorderKey = UniqueKey();
        });
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(clientProvider.error),
            backgroundColor: AppColors.rojo,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final clientProvider = Provider.of<ClientProvider>(context);
    final isBusy = _isSubmitting || clientProvider.isLoading;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Agendar Nueva Cita',
              style: TextStyle(
                color: AppColors.amarillo,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 20),

            // Servicio
            const Text('Servicio', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 15),
              decoration: BoxDecoration(
                color: AppColors.azulOscuro,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white24),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  isExpanded: true,
                  dropdownColor: AppColors.azulOscuro,
                  value: _selectedService,
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                  icon: const Icon(Icons.arrow_drop_down, color: AppColors.amarillo),
                  items: _services.map((String value) {
                    return DropdownMenuItem<String>(
                      value: value,
                      child: Text(value),
                    );
                  }).toList(),
                  onChanged: (newValue) {
                    setState(() {
                      _selectedService = newValue!;
                    });
                  },
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Fecha
            const Text('Fecha', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            InkWell(
              onTap: () => _selectDate(context),
              child: Container(
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: AppColors.azulOscuro,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.white24),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      DateFormat('EEEE, d MMMM yyyy', 'es').format(_selectedDate),
                      style: const TextStyle(color: Colors.white, fontSize: 16),
                    ),
                    const Icon(Icons.calendar_today, color: AppColors.amarillo),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Hora
            const Text('Hora', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _availableTimes.map((time) {
                final isSelected = _selectedTime == time;
                return ChoiceChip(
                  label: Text(time),
                  selected: isSelected,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() {
                        _selectedTime = time;
                      });
                    }
                  },
                  backgroundColor: AppColors.azulOscuro,
                  selectedColor: AppColors.amarillo,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.black : Colors.white,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: BorderSide(
                      color: isSelected ? AppColors.amarillo : Colors.white24,
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Datos Personales
            const Text('Tus Datos', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _nameController,
              style: const TextStyle(color: Colors.white),
              decoration: _buildInputDecoration('Nombre Completo', Icons.person),
              validator: (val) => val == null || val.isEmpty ? 'Requerido' : null,
            ),
            const SizedBox(height: 15),
            TextFormField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              style: const TextStyle(color: Colors.white),
              decoration: _buildInputDecoration('Teléfono', Icons.phone),
              validator: (val) => val == null || val.isEmpty ? 'Requerido' : null,
            ),
            const SizedBox(height: 20),

            // Apartado de Nota de Voz (reemplaza el cuadro de texto)
            VoiceNoteRecorder(
              key: _voiceRecorderKey,
              onAudioChanged: (path) {
                setState(() {
                  _audioFilePath = path;
                });
              },
            ),
            const SizedBox(height: 30),

            // Botón Agendar
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: isBusy ? null : _submitAppointment,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.amarillo,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 5,
                ),
                child: isBusy
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                          ),
                          SizedBox(width: 12),
                          Text(
                            'Procesando Cita...',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black),
                          ),
                        ],
                      )
                    : const Text(
                        'Confirmar Cita',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
              ),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  InputDecoration _buildInputDecoration(String hint, IconData icon) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Colors.white38),
      prefixIcon: Icon(icon, color: Colors.white54),
      filled: true,
      fillColor: AppColors.azulOscuro,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Colors.white10),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.amarillo),
      ),
    );
  }
}
