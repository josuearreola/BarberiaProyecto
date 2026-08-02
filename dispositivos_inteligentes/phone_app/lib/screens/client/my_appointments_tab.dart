import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme.dart';
import '../../providers/client_provider.dart';

class MyAppointmentsTab extends StatefulWidget {
  const MyAppointmentsTab({super.key});

  @override
  State<MyAppointmentsTab> createState() => _MyAppointmentsTabState();
}

class _MyAppointmentsTabState extends State<MyAppointmentsTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ClientProvider>(context, listen: false).fetchMyAppointments();
    });
  }

  @override
  Widget build(BuildContext context) {
    final clientProvider = Provider.of<ClientProvider>(context);

    if (clientProvider.isLoading && clientProvider.myAppointments.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.amarillo));
    }

    if (clientProvider.myAppointments.isEmpty) {
      return const Center(
        child: Text('No tienes citas programadas', style: TextStyle(color: Colors.white54, fontSize: 16)),
      );
    }

    return RefreshIndicator(
      color: AppColors.amarillo,
      onRefresh: () => clientProvider.fetchMyAppointments(),
      child: ListView.builder(
        padding: const EdgeInsets.all(15),
        itemCount: clientProvider.myAppointments.length,
        itemBuilder: (context, index) {
          final cita = clientProvider.myAppointments[index];
          
          Color stateColor = Colors.grey;
          IconData stateIcon = Icons.access_time;
          if (cita.estado == 'pendiente') {
            stateColor = Colors.orangeAccent;
            stateIcon = Icons.pending_actions;
          } else if (cita.estado == 'confirmada') {
            stateColor = AppColors.verdeExito;
            stateIcon = Icons.check_circle;
          } else if (cita.estado == 'cancelada') {
            stateColor = AppColors.rojo;
            stateIcon = Icons.cancel;
          }

          return Card(
            color: AppColors.azulOscuro,
            elevation: 3,
            margin: const EdgeInsets.only(bottom: 15),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
            child: Padding(
              padding: const EdgeInsets.all(15.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: stateColor.withOpacity(0.15),
                        child: Icon(stateIcon, color: stateColor, size: 22),
                      ),
                      const SizedBox(width: 15),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${cita.fechaCita} - ${cita.horaCita}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              cita.servicio,
                              style: const TextStyle(color: Colors.white70),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 15),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: stateColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(5),
                      border: Border.all(color: stateColor.withOpacity(0.5)),
                    ),
                    child: Text(
                      cita.estado.toUpperCase(),
                      style: TextStyle(color: stateColor, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                  if (cita.estado == 'pendiente') ...[
                    const SizedBox(height: 15),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          _confirmCancel(context, cita.id, clientProvider);
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.rojo,
                          side: BorderSide(color: AppColors.rojo.withOpacity(0.5)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        icon: const Icon(Icons.cancel_outlined),
                        label: const Text('Cancelar Cita'),
                      ),
                    ),
                  ]
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _confirmCancel(BuildContext context, int citaId, ClientProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.azulOscuro,
        title: const Text('Cancelar Cita', style: TextStyle(color: Colors.white)),
        content: const Text('¿Estás seguro que deseas cancelar tu cita?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Volver', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final success = await provider.cancelMyAppointment(citaId);
              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Cita cancelada correctamente'), backgroundColor: AppColors.verdeExito),
                );
              } else if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(provider.error), backgroundColor: AppColors.rojo),
                );
              }
            },
            child: const Text('Sí, cancelar', style: TextStyle(color: AppColors.rojo, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
