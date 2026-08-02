import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class BleProvider with ChangeNotifier {
  BluetoothDevice? _device;
  BluetoothCharacteristic? _dataCharacteristic;
  StreamSubscription? _connectionSub;
  StreamSubscription? _notifySub;
  IO.Socket? _socket;

  bool _isScanning = false;
  bool _isConnected = false;
  
  String _citas = "--";
  String _tiempo = "--";
  String _dinero = "--";
  
  bool get isScanning => _isScanning;
  bool get isConnected => _isConnected;
  String get citas => _citas;
  String get tiempo => _tiempo;
  String get dinero => _dinero;
  
  final String targetServiceUuid = "0000180F-0000-1000-8000-00805f9b34fb";
  final String targetCharacteristicUuid = "00002A19-0000-1000-8000-00805f9b34fb";

  BleProvider() {
    _initSocket();
  }

  void _initSocket() {
    _socket = IO.io('http://10.0.2.2:3000', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
    });

    _socket?.on('wearable_data_broadcast', (data) {
      if (data is String) {
        _processData(data);
      }
    });

    _socket?.on('wearable_disconnect_broadcast', (_) {
      disconnect();
    });
  }

  void _processData(String dataStr) {
    List<String> parts = dataStr.split(',');
    if (parts.length == 3) {
      _citas = parts[0];
      _tiempo = parts[1];
      _dinero = parts[2];
      
      // Simular que está conectado por Sockets si recibe datos
      if (!_isConnected) {
        _isConnected = true;
      }
      notifyListeners();
    }
  }

  void syncAppointment(String date, String time, String barber, String status) {
    if (_socket != null && _socket!.connected) {
      int? timestamp;
      try {
        final partsDate = date.split('-');
        final partsTime = time.split(':');
        // La hora de la cita es hora México (UTC-6), convertimos a UTC sumando 6
        final dt = DateTime.utc(
          int.parse(partsDate[0]),
          int.parse(partsDate[1]),
          int.parse(partsDate[2]),
          int.parse(partsTime[0]) + 6, // UTC-6 Querétaro → UTC
          int.parse(partsTime[1]),
        );
        timestamp = dt.millisecondsSinceEpoch;
      } catch (e) {
        print('Error calculating timestamp: $e');
      }

      _socket!.emit('sync_appointment', {
        'date': date,
        'time': time,
        'barber': barber,
        'status': status,
        'timestamp': timestamp,
      });
    }
  }

  Future<void> requestPermissions() async {
    await [
      Permission.bluetooth,
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();
  }

  Future<void> startScan() async {
    await requestPermissions();
    if (_isScanning) return;
    
    _isScanning = true;
    notifyListeners();
    
    // Conectar Socket en paralelo por si estamos en emulador
    _socket?.connect();

    try {
      await FlutterBluePlus.startScan(
        timeout: const Duration(seconds: 4),
        withServices: [Guid(targetServiceUuid)],
      );

      FlutterBluePlus.scanResults.listen((results) {
        for (ScanResult r in results) {
          if (r.device.platformName == 'BarberWear') {
            FlutterBluePlus.stopScan();
            _connectToDevice(r.device);
            break;
          }
        }
      });
    } catch (e) {
      print("Scan Error: $e");
    } finally {
      Future.delayed(const Duration(seconds: 4), () {
        _isScanning = false;
        notifyListeners();
      });
    }
  }

  Future<void> _connectToDevice(BluetoothDevice device) async {
    _device = device;
    
    try {
      await _device!.connect(license: License.nonprofit, autoConnect: true, mtu: null);
      _isConnected = true;
      notifyListeners();

      _connectionSub = _device!.connectionState.listen((state) {
        if (state == BluetoothConnectionState.disconnected) {
          _isConnected = false;
          _resetData();
          notifyListeners();
          startScan();
        }
      });

      List<BluetoothService> services = await _device!.discoverServices();
      for (var service in services) {
        if (service.uuid.toString().toUpperCase() == targetServiceUuid.toUpperCase()) {
          for (var c in service.characteristics) {
            if (c.uuid.toString().toUpperCase() == targetCharacteristicUuid.toUpperCase()) {
              _dataCharacteristic = c;
              await _dataCharacteristic!.setNotifyValue(true);
              
              _notifySub = _dataCharacteristic!.onValueReceived.listen((value) {
                if (value.isNotEmpty) {
                  String dataStr = String.fromCharCodes(value);
                  _processData(dataStr);
                }
              });
            }
          }
        }
      }
    } catch (e) {
      print("Connect error: $e");
    }
  }

  void _resetData() {
    _citas = "--";
    _tiempo = "--";
    _dinero = "--";
  }

  Future<void> disconnect() async {
    _notifySub?.cancel();
    _connectionSub?.cancel();
    await _device?.disconnect();
    _socket?.disconnect();
    _isConnected = false;
    _resetData();
    notifyListeners();
  }
}
