import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../models/appointment_model.dart';
import '../services/api_service.dart';
import '../services/local_db_service.dart';

class ClientProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final LocalDbService _localDb = LocalDbService.instance;
  
  List<AppointmentModel> _myAppointments = [];
  bool _isLoading = false;
  String _error = '';

  // Rastrear estados para detectar cambios y notificar inmediatamente
  final Map<int, String> _previousStatuses = {};
  void Function(AppointmentModel appt, String oldStatus, String newStatus)? onStatusChanged;

  List<AppointmentModel> get myAppointments => _myAppointments;
  bool get isLoading => _isLoading;
  String get error => _error;

  Future<void> fetchMyAppointments({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _error = '';
      notifyListeners();
    }

    try {
      final response = await _apiService.get('/appointments/mis-citas');
      
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        final List<AppointmentModel> incoming =
            data.map((json) => AppointmentModel.fromJson(json)).toList();

        // Detectar si alguna cita cambió de estado
        if (_previousStatuses.isNotEmpty) {
          for (final appt in incoming) {
            final oldStatus = _previousStatuses[appt.id];
            if (oldStatus != null &&
                oldStatus.toLowerCase().trim() != appt.estado.toLowerCase().trim()) {
              debugPrint('ClientProvider: Cita ${appt.id} cambió de $oldStatus a ${appt.estado}');
              onStatusChanged?.call(appt, oldStatus, appt.estado);
            }
          }
        }

        // Registrar los estados actuales en memoria
        for (final appt in incoming) {
          _previousStatuses[appt.id] = appt.estado;
        }

        _myAppointments = incoming;
        // Guardar en la base de datos local SQLite para acceso offline
        await _localDb.saveAppointments(_myAppointments);
      } else {
        // Si hay error en el servidor, cargar desde SQLite
        final cached = await _localDb.getCachedAppointments();
        if (cached.isNotEmpty) {
          _myAppointments = cached;
        } else {
          _error = 'Error al cargar tus citas: ${response.statusCode}';
        }
      }
    } catch (e) {
      // Sin conexión / sin internet: Cargar citas desde SQLite local
      final cached = await _localDb.getCachedAppointments();
      if (cached.isNotEmpty) {
        _myAppointments = cached;
      } else {
        _error = 'Modo sin conexión. No hay citas en caché local.';
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createAppointment({
    required String nombreCompleto,
    required String telefono,
    required String correo,
    required String servicio,
    required String fechaCita,
    required String horaCita,
    String? notas,
  }) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final body = {
        'nombreCompleto': nombreCompleto,
        'telefono': telefono,
        'correo': correo,
        'servicio': servicio,
        'fechaCita': fechaCita,
        'horaCita': horaCita,
        if (notas != null && notas.isNotEmpty) 'notas': notas,
      };

      final response = await _apiService.post('/appointments', body);

      if (response.statusCode == 201 || response.statusCode == 200) {
        try {
          await fetchMyAppointments();
        } catch (_) {}
        return true;
      } else {
        try {
          final dynamic errorData = jsonDecode(response.body);
          if (response.statusCode == 409) {
            _error = (errorData is Map && errorData['message'] != null)
                ? errorData['message'].toString()
                : 'La hora seleccionada ya está ocupada. Por favor elige otro horario.';
          } else if (errorData is Map && errorData['message'] != null) {
            if (errorData['message'] is List) {
              _error = (errorData['message'] as List).join(', ');
            } else {
              _error = errorData['message'].toString();
            }
          } else {
            _error = 'No se pudo crear la cita (${response.statusCode})';
          }
        } catch (_) {
          if (response.statusCode == 409) {
            _error = 'La hora seleccionada ya está ocupada. Por favor elige otro horario.';
          } else {
            _error = 'Error al agendar cita en el servidor (${response.statusCode})';
          }
        }
        return false;
      }
    } catch (e) {
      _error = 'Error de conexión con el servidor.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> cancelMyAppointment(int id) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final response = await _apiService.patch('/appointments/mis-citas/$id/cancelar', {});
      
      if (response.statusCode == 200) {
        await fetchMyAppointments();
        return true;
      } else {
        _error = 'Error al cancelar la cita: ${response.statusCode}';
        return false;
      }
    } catch (e) {
      _error = 'Error de conexión: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> getAudioPresignedUrl({String? fileName}) async {
    try {
      final response = await _apiService.post('/appointments/audio-presigned-url', {
        'fileName': ?fileName,
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        _error = 'Error al solicitar URL preasignada: ${response.statusCode}';
        return null;
      }
    } catch (e) {
      _error = 'Error al conectar con el servidor: $e';
      return null;
    }
  }

  Future<bool> uploadAudioToPresignedUrl(String uploadUrl, List<int> audioBytes) async {
    try {
      final response = await http.put(
        Uri.parse(uploadUrl),
        headers: {
          'Content-Type': 'audio/m4a',
          'x-app-client': 'barberia-smart-device',
        },
        body: audioBytes,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return true;
      } else {
        _error = 'Error al subir nota de voz: ${response.statusCode}';
        return false;
      }
    } catch (e) {
      _error = 'Error al subir archivo de audio: $e';
      return false;
    }
  }
}
