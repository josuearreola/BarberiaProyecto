import 'dart:async';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:ble_peripheral/ble_peripheral.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'BarberWear',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: Colors.black,
        colorScheme: const ColorScheme.dark(
          primary: Colors.amber,
          secondary: Colors.redAccent,
        ),
      ),
      home: const WatchScreen(),
    );
  }
}

class WatchScreen extends StatefulWidget {
  const WatchScreen({super.key});

  @override
  State<WatchScreen> createState() => _WatchScreenState();
}

class _WatchScreenState extends State<WatchScreen> {
  bool isBroadcasting = false;
  Timer? _dataTimer;
  IO.Socket? _socket;

  // Datos de cita
  Map<String, dynamic>? appointmentData;
  DateTime? targetDate;
  
  // Datos IoT generados localmente
  int currentBateria = 100;
  int currentTiempo = 0;
  int currentHR = 75;

  // UUIDs simulados para IoT
  final String serviceUuid = "0000180F-0000-1000-8000-00805f9b34fb";
  final String characteristicUuid = "00002A19-0000-1000-8000-00805f9b34fb";

  @override
  void initState() {
    super.initState();
    _requestPermissions();
    _initSocket();
  }
  
  void _initSocket() {
    // Apunta al backend local para emuladores
    _socket = IO.io('https://barberiaproyecto-f2wb.onrender.com', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
    });
    
    _socket?.on('sync_appointment_broadcast', (data) {
      if (mounted) {
        setState(() {
          appointmentData = Map<String, dynamic>.from(data);
          if (data['timestamp'] != null) {
            targetDate = DateTime.fromMillisecondsSinceEpoch(data['timestamp'], isUtc: true);
          } else {
            _parseAppointmentDate(appointmentData!);
          }
        });
      }
    });
  }

  void _parseAppointmentDate(Map<String, dynamic> data) {
    try {
      final dateParts = data['date'].toString().split('-');
      if (dateParts.length != 3) return;
      
      int year = int.parse(dateParts[0]);
      int month = int.parse(dateParts[1]);
      int day = int.parse(dateParts[2]);

      String timeStr = data['time'].toString().trim().toUpperCase();
      int hour = 0;
      int minute = 0;
      
      if (timeStr.contains('AM') || timeStr.contains('PM')) {
        bool isPM = timeStr.contains('PM');
        timeStr = timeStr.replaceAll('AM', '').replaceAll('PM', '').trim();
        List<String> timeParts = timeStr.split(':');
        hour = int.parse(timeParts[0]);
        minute = int.parse(timeParts[1]);
        if (isPM && hour < 12) hour += 12;
        if (!isPM && hour == 12) hour = 0;
      } else {
        List<String> timeParts = timeStr.split(':');
        hour = int.parse(timeParts[0]);
        minute = int.parse(timeParts[1]);
      }
      
      // Forzamos la fecha a UTC sumando 6 horas (Querétaro UTC-6)
      targetDate = DateTime.utc(year, month, day, hour + 6, minute);
    } catch (e) {
      print("Error parseando fecha: $e");
    }
  }

  Future<void> _requestPermissions() async {
    await [
      Permission.bluetooth,
      Permission.bluetoothAdvertise,
      Permission.bluetoothConnect,
    ].request();
  }

  Future<void> _setupBlePeripheral() async {
    await BlePeripheral.initialize();
    
    final service = BleService(
      uuid: serviceUuid,
      primary: true,
      characteristics: [
        BleCharacteristic(
          uuid: characteristicUuid,
          properties: [
            CharacteristicProperties.read.index,
            CharacteristicProperties.notify.index,
          ],
          permissions: [AttributePermissions.readable.index],
          value: null,
        )
      ],
    );

    await BlePeripheral.addService(service);
  }

  void _startBroadcasting() async {
    await _setupBlePeripheral();
    
    await BlePeripheral.startAdvertising(
      services: [serviceUuid],
      localName: 'BarberWear',
    );
    
    _socket?.connect();

    setState(() {
      isBroadcasting = true;
    });

    _dataTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        // Generar métricas simuladas del cliente (Batería)
        currentBateria = max(0, 100 - (timer.tick ~/ 60)); // Baja 1% cada minuto real
        
        // Calcular tiempo real restante
        if (targetDate != null) {
          final nowUtc = DateTime.now().toUtc();
          currentTiempo = targetDate!.difference(nowUtc).inMinutes;
        } else {
          currentTiempo = 0;
        }
        
        // Ritmo cardiaco oscila, si falta poco tiempo real, se estresa
        if (currentTiempo < 5 && currentTiempo >= -5) {
          currentHR = 110 + Random().nextInt(20); // Se estresa > 120 (a punto de empezar)
        } else {
          currentHR = 70 + Random().nextInt(15);  // Relajado
        }
      });

      String dataStr = "$currentBateria,$currentTiempo,$currentHR";
      
      // Enviar notificación a la característica (BLE)
      BlePeripheral.updateCharacteristic(
        characteristicId: characteristicUuid,
        value: Uint8List.fromList(dataStr.codeUnits),
      );
      
      // Enviar por Sockets (SIMULADOR EMULADOR)
      _socket?.emit('wearable_data', dataStr);
    });
  }

  void _stopBroadcasting() async {
    _dataTimer?.cancel();
    await BlePeripheral.stopAdvertising();
    await BlePeripheral.clearServices();
    _socket?.emit('wearable_disconnect');
    _socket?.disconnect();

    setState(() {
      isBroadcasting = false;
      appointmentData = null; // Limpiar cita al detener
    });
  }

  @override
  void dispose() {
    _dataTimer?.cancel();
    BlePeripheral.stopAdvertising();
    _socket?.dispose();
    super.dispose();
  }

  String _formatTime(int mins) {
    if (mins < 60) return '$mins min';
    final hours = mins ~/ 60;
    final remainingMins = mins % 60;
    return '${hours}h ${remainingMins}m';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            colors: isBroadcasting 
              ? [const Color(0xFF1E3A8A).withOpacity(0.5), Colors.black]
              : [const Color(0xFF282B30), Colors.black],
            radius: 0.8,
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.only(top: 20.0, bottom: 50.0, left: 16.0, right: 16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                if (appointmentData != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.amber.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.withOpacity(0.5)),
                    ),
                    child: const Text('PRÓXIMA CITA', style: TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 8),
                  Text('${appointmentData!['date']} - ${appointmentData!['time']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white)),
                  Text('💈 ${appointmentData!['barber']}', style: const TextStyle(fontSize: 11, color: Colors.white70)),
                  const SizedBox(height: 12),
                ],
                if (isBroadcasting) ...[
                  if (appointmentData != null) ...[
                    Text(
                      'Faltan ${_formatTime(currentTiempo)}', 
                      style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 16, letterSpacing: 0.5)
                    ),
                    const SizedBox(height: 10),
                  ],
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.favorite, color: Colors.redAccent, size: 12),
                        Text(' $currentHR', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 10),
                        const Icon(Icons.battery_charging_full, color: Colors.greenAccent, size: 12),
                        Text(' $currentBateria%', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _stopBroadcasting,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.redAccent,
                      foregroundColor: Colors.white,
                      elevation: 4,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    ),
                    child: const Text('Desconectar', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  ),
                ] else ...[
                  const Text(
                    'LISTO',
                    style: TextStyle(
                      color: Colors.white54,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ElevatedButton(
                    onPressed: _startBroadcasting,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amber,
                      foregroundColor: Colors.black,
                      elevation: 4,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    ),
                    child: const Text('Vincular', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  )
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
