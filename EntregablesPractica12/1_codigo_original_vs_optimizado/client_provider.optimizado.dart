import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/appointment_model.dart';
import '../services/api_service.dart';
import '../services/local_db_service.dart';

/// Función de nivel superior ejecutable en Isolate secundario mediante [compute]
/// para evitar bloqueos (>16.67 ms) en el hilo principal de la UI.
List<AppointmentModel> parseAppointmentsJson(String responseBody) {
  final List<dynamic> data = jsonDecode(responseBody) as List<dynamic>;
  return data
      .map((json) => AppointmentModel.fromJson(json as Map<String, dynamic>))
      .toList();
}

class ClientProvider with ChangeNotifier {
  final ApiService _apiService;
  final LocalDbService _localDb;

  ClientProvider({ApiService? apiService, LocalDbService? localDb})
      : _apiService = apiService ?? ApiService(),
        _localDb = localDb ?? LocalDbService.instance;

  List<AppointmentModel> _myAppointments = [];
  bool _isLoading = false;
  bool _isSubmitting = false;
  bool _requiresReauth = false;
  String _error = '';
  String _lastSnapshotSignature = '';
  int _fetchSequence = 0;

  // Rastrear estados para detectar cambios y notificar inmediatamente
  final Map<int, String> _previousStatuses = {};
  void Function(AppointmentModel appt, String oldStatus, String newStatus)? onStatusChanged;

  List<AppointmentModel> get myAppointments => _myAppointments;
  bool get isLoading => _isLoading;
  bool get isSubmitting => _isSubmitting;
  bool get requiresReauth => _requiresReauth;
  String get error => _error;

  String _buildSnapshotSignature(List<AppointmentModel> items) {
    if (items.isEmpty) return '';
    return items
        .map((a) => '${a.id}:${a.estado}:${a.fechaCita}:${a.horaCita}:${a.nombreBarbero ?? ''}')
        .join('|');
  }

  Future<void> fetchMyAppointments({bool silent = false}) async {
    final int currentSeq = ++_fetchSequence;
    if (!silent) {
      _isLoading = true;
      _error = '';
      _requiresReauth = false;
      notifyListeners();
    }

    bool shouldNotify = !silent;

    try {
      final response = await _apiService.get('/appointments/mis-citas');

      // Descarta respuestas tardías si ya se disparó una consulta más reciente (RES-08)
      if (currentSeq != _fetchSequence) return;

      if (response.statusCode == 200) {
        _requiresReauth = false;
        _error = '';

        // Deserializar en Isolate secundario cuando la carga útil supera 20 KB
        final List<AppointmentModel> incoming = response.body.length > 20480
            ? await compute(parseAppointmentsJson, response.body)
            : parseAppointmentsJson(response.body);

        if (currentSeq != _fetchSequence) return;

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

        final newSignature = _buildSnapshotSignature(incoming);
        if (newSignature != _lastSnapshotSignature) {
          _previousStatuses
            ..clear()
            ..addEntries(incoming.map((a) => MapEntry(a.id, a.estado)));
          _myAppointments = incoming;
          _lastSnapshotSignature = newSignature;
          await _localDb.saveAppointments(_myAppointments);
          shouldNotify = true;
        }
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        _requiresReauth = true;
        final cached = await _localDb.getCachedAppointments();
        if (cached.isNotEmpty && response.statusCode == 403) {
          _myAppointments = cached;
        } else {
          _error = 'Error al cargar tus citas: ${response.statusCode}';
        }
        shouldNotify = true;
      } else {
        final cached = await _localDb.getCachedAppointments();
        if (cached.isNotEmpty) {
          _myAppointments = cached;
        } else {
          _error = 'Error al cargar tus citas: ${response.statusCode}';
        }
        shouldNotify = true;
      }
    } on TimeoutException {
      if (currentSeq != _fetchSequence) return;
      final cached = await _localDb.getCachedAppointments();
      if (cached.isNotEmpty) {
        _myAppointments = cached;
      }
      _error = 'Tiempo de espera agotado al conectar con el servidor.';
      shouldNotify = true;
    } catch (e) {
      if (currentSeq != _fetchSequence) return;
      final cached = await _localDb.getCachedAppointments();
      if (cached.isNotEmpty) {
        _myAppointments = cached;
      } else {
        _error = 'Modo sin conexión. No hay citas en caché local.';
      }
      shouldNotify = true;
    } finally {
      if (currentSeq == _fetchSequence) {
        _isLoading = false;
        if (shouldNotify) {
          notifyListeners();
        }
      }
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
    String? idempotencyKey,
  }) async {
    // Evitar dobles envíos o respuestas tardías concurrentes (RES-07 / RES-08)
    if (_isSubmitting) {
      _error = 'Ya existe una solicitud de cita en curso.';
      return false;
    }

    _isSubmitting = true;
    _isLoading = true;
    _error = '';
    notifyListeners();

    final effectiveKey = idempotencyKey ??
        '${correo.trim()}_${fechaCita}_${horaCita}_${DateTime.now().microsecondsSinceEpoch}';

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

      final response = await _apiService.post(
        '/appointments',
        body,
        idempotencyKey: effectiveKey,
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        // Optimización Fase 6: actualizar estado local directamente desde la respuesta 201
        // evitando un segundo roundtrip HTTP GET /appointments/mis-citas innecesario.
        try {
          final dynamic decoded = jsonDecode(response.body);
          if (decoded is Map<String, dynamic> && decoded['id'] != null) {
            final created = AppointmentModel.fromJson(decoded);
            final existingIdx = _myAppointments.indexWhere((a) => a.id == created.id);
            if (existingIdx >= 0) {
              _myAppointments[existingIdx] = created;
            } else {
              _myAppointments = [created, ..._myAppointments];
            }
            _previousStatuses[created.id] = created.estado;
            _lastSnapshotSignature = _buildSnapshotSignature(_myAppointments);
            await _localDb.saveAppointments(_myAppointments);
          } else {
            await fetchMyAppointments(silent: true);
          }
        } catch (_) {
          await fetchMyAppointments(silent: true);
        }
        return true;
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        _requiresReauth = true;
        _error = 'No autorizado para registrar la cita (${response.statusCode}).';
        return false;
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
    } on TimeoutException {
      _error = 'Tiempo de espera agotado. Verifica tus citas antes de reintentar.';
      return false;
    } catch (e) {
      _error = 'Error de conexión con el servidor.';
      return false;
    } finally {
      _isSubmitting = false;
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
        await fetchMyAppointments(silent: true);
        return true;
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        _requiresReauth = true;
        _error = 'Error al cancelar la cita: ${response.statusCode}';
        return false;
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
      final response = await http
          .put(
            Uri.parse(uploadUrl),
            headers: {
              'Content-Type': 'audio/m4a',
              'x-app-client': 'barberia-smart-device',
            },
            body: audioBytes,
          )
          .timeout(const Duration(seconds: 15));

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
