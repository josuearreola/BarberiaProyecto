import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:phone_app/providers/ble_provider.dart';
import 'package:phone_app/providers/client_provider.dart';
import 'package:phone_app/models/appointment_model.dart';

class DeviceLinkScreen extends StatefulWidget {
  const DeviceLinkScreen({super.key});

  @override
  State<DeviceLinkScreen> createState() => _DeviceLinkScreenState();
}

class _DeviceLinkScreenState extends State<DeviceLinkScreen> {
  @override
  void initState() {
    super.initState();
    // Cargar citas reales al entrar a la pantalla
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ClientProvider>(context, listen: false).fetchMyAppointments();
    });
  }

  DateTime? _lastAlertTime;

  String _formatTime(String minutesStr) {
    final mins = int.tryParse(minutesStr);
    if (mins == null) return '$minutesStr min';
    if (mins < 60) return '$mins min';
    final hours = mins ~/ 60;
    final remainingMins = mins % 60;
    return '${hours}h ${remainingMins}m';
  }

  @override
  Widget build(BuildContext context) {
    final bleProvider = Provider.of<BleProvider>(context);
    final clientProvider = Provider.of<ClientProvider>(context);

    // Alerta de ritmo cardíaco excedido con debounce para evitar crasheos (ANR)
    if (bleProvider.isConnected && bleProvider.dinero != "--") {
      final ritmoCardiaco = int.tryParse(bleProvider.dinero) ?? 0;
      if (ritmoCardiaco > 120) {
        if (_lastAlertTime == null || DateTime.now().difference(_lastAlertTime!).inSeconds > 3) {
          _lastAlertTime = DateTime.now();
          WidgetsBinding.instance.addPostFrameCallback((_) {
            ScaffoldMessenger.of(context).clearSnackBars(); // Limpiar colas viejas
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('⚠️ ¡El cliente tiene el ritmo cardíaco acelerado (>120 bpm)!'),
                backgroundColor: Colors.redAccent,
                duration: Duration(seconds: 2),
              ),
            );
          });
        }
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFF1E2124),
      appBar: AppBar(
        title: const Text('Vincular Wear OS', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF282B30),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              bleProvider.isConnected ? Icons.watch : Icons.watch_off,
              size: 100,
              color: bleProvider.isConnected ? Colors.greenAccent : Colors.white54,
            ),
            const SizedBox(height: 20),
            Text(
              bleProvider.isConnected 
                ? 'Conectado a BarberWear' 
                : (bleProvider.isScanning ? 'Buscando dispositivos...' : 'Reloj Desconectado'),
              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 30),
            if (bleProvider.isConnected) ...[
              ElevatedButton.icon(
                onPressed: () {
                  if (clientProvider.myAppointments.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('No tienes citas programadas')),
                    );
                    return;
                  }

                  // Buscar la próxima cita pendiente o confirmada
                  final nowUtc = DateTime.now().toUtc();
                  final upcoming = clientProvider.myAppointments.where((app) {
                    if (app.estado != 'pendiente' && app.estado != 'confirmada') return false;
                    try {
                      final timeStr = app.horaCita.length <= 5 ? '${app.horaCita}:00' : app.horaCita;
                      final parts = timeStr.split(':');
                      final dateParts = app.fechaCita.split("T")[0].split('-');
                      final targetUtc = DateTime.utc(
                        int.parse(dateParts[0]), 
                        int.parse(dateParts[1]), 
                        int.parse(dateParts[2]), 
                        int.parse(parts[0]) + 6, // UTC-6 Querétaro
                        int.parse(parts[1])
                      );
                      // Ignorar si ya pasó hace más de 5 minutos
                      if (targetUtc.isBefore(nowUtc.subtract(const Duration(minutes: 5)))) return false;
                    } catch (e) {}
                    return true;
                  }).toList();

                  if (upcoming.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('No hay citas pendientes válidas próximas')),
                    );
                    return;
                  }
                  
                  // Ordenar las citas de la más cercana a la más lejana
                  upcoming.sort((a, b) {
                    try {
                      final timeA = a.horaCita.length <= 5 ? '${a.horaCita}:00' : a.horaCita;
                      final timeB = b.horaCita.length <= 5 ? '${b.horaCita}:00' : b.horaCita;
                      final partsA = timeA.split(':');
                      final partsB = timeB.split(':');
                      final datePartsA = a.fechaCita.split("T")[0].split('-');
                      final datePartsB = b.fechaCita.split("T")[0].split('-');
                      
                      final targetUtcA = DateTime.utc(int.parse(datePartsA[0]), int.parse(datePartsA[1]), int.parse(datePartsA[2]), int.parse(partsA[0]) + 6, int.parse(partsA[1]));
                      final targetUtcB = DateTime.utc(int.parse(datePartsB[0]), int.parse(datePartsB[1]), int.parse(datePartsB[2]), int.parse(partsB[0]) + 6, int.parse(partsB[1]));
                      
                      return targetUtcA.compareTo(targetUtcB);
                    } catch (e) {
                      return 0;
                    }
                  });
                  
                  // Tomamos la más próxima
                  final nextApp = upcoming.first;

                  // Enviar la próxima cita real al Wear OS
                  bleProvider.syncAppointment(
                    nextApp.fechaCita.split('T')[0], 
                    nextApp.horaCita, 
                    nextApp.nombreBarbero ?? 'Sin asignar', 
                    nextApp.estado
                  );
                  
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Cita real sincronizada con el reloj')),
                  );
                },
                icon: const Icon(Icons.sync),
                label: const Text('Sincronizar Próxima Cita'),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.amber),
              ),
              const SizedBox(height: 20),
              _buildMetricCard(Icons.battery_full, 'Batería Wear OS', '${bleProvider.citas}%', Colors.green),
              const SizedBox(height: 10),
              _buildMetricCard(Icons.timer, 'Tiempo Restante Cita', _formatTime(bleProvider.tiempo), Colors.blueAccent),
              const SizedBox(height: 10),
              _buildMetricCard(Icons.favorite, 'Ritmo Cardíaco', '${bleProvider.dinero} bpm', Colors.redAccent),
              const SizedBox(height: 30),
              ElevatedButton(
                onPressed: () => bleProvider.disconnect(),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                child: const Text('Desconectar', style: TextStyle(color: Colors.white)),
              ),
            ] else ...[
              ElevatedButton(
                onPressed: bleProvider.isScanning ? null : () => bleProvider.startScan(),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFFC107)),
                child: Text(
                  bleProvider.isScanning ? 'Buscando...' : 'Buscar Reloj',
                  style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                ),
              ),
            ]
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard(IconData icon, String title, String value, Color color) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF282B30),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                Icon(icon, color: color),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title, 
                    style: const TextStyle(color: Colors.white70),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          Text(
            value, 
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)
          ),
        ],
      ),
    );
  }
}
