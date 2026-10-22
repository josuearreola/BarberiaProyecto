import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../models/app_notification_model.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';

class NotificationProvider with ChangeNotifier {
  final _storage = const FlutterSecureStorage();
  final NotificationService _notificationService = NotificationService();
  
  IO.Socket? _socket;
  String? _currentUserEmail;
  String? _currentUserPhone;
  VoidCallback? _onAppointmentUpdated;

  List<AppNotificationModel> _notifications = [];
  bool _isLoading = false;

  final StreamController<AppNotificationModel> _inAppNotificationStream =
      StreamController<AppNotificationModel>.broadcast();

  Stream<AppNotificationModel> get inAppNotificationStream =>
      _inAppNotificationStream.stream;

  List<AppNotificationModel> get notifications => List.unmodifiable(_notifications);

  int get unreadCount => _notifications.where((n) => !n.isRead).length;

  bool get hasUnread => unreadCount > 0;

  bool get isLoading => _isLoading;

  NotificationProvider() {
    _loadStoredNotifications();
    _notificationService.initialize();
  }

  // Extraer la URL base del socket a partir de ApiService.baseUrl
  String _getSocketUrl() {
    String url = ApiService.baseUrl.trim();
    if (url.endsWith('/api')) {
      url = url.substring(0, url.length - 4);
    } else if (url.endsWith('/api/')) {
      url = url.substring(0, url.length - 5);
    }
    return url;
  }

  Future<void> _loadStoredNotifications() async {
    try {
      final raw = await _storage.read(key: 'user_notifications_cache');
      if (raw != null && raw.isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(raw);
        _notifications = decoded
            .map((item) => AppNotificationModel.fromJson(item))
            .toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('NotificationProvider: Error al cargar notificaciones guardadas ($e)');
    }
  }

  Future<void> _saveNotifications() async {
    try {
      final data = jsonEncode(_notifications.map((n) => n.toJson()).toList());
      await _storage.write(key: 'user_notifications_cache', value: data);
    } catch (e) {
      debugPrint('NotificationProvider: Error al guardar notificaciones ($e)');
    }
  }

  // Inicializar o actualizar suscripción Socket.IO con el usuario en sesión
  void updateSessionUser({
    required String? email,
    String? phone,
    VoidCallback? onAppointmentUpdated,
  }) {
    _currentUserEmail = email?.trim().toLowerCase();
    _currentUserPhone = phone?.trim();
    _onAppointmentUpdated = onAppointmentUpdated;

    _connectSocket();
  }

  void _connectSocket() {
    final socketUrl = _getSocketUrl();

    if (_socket != null && _socket!.connected) {
      debugPrint('NotificationProvider: Socket ya conectado a $socketUrl');
      return;
    }

    try {
      _socket = IO.io(socketUrl, <String, dynamic>{
        'transports': ['websocket'],
        'autoConnect': true,
      });

      _socket?.onConnect((_) {
        debugPrint('NotificationProvider: Conectado al canal Socket.IO para notificaciones');
      });

      _socket?.on('appointment_status_changed', (data) {
        _handleStatusChangeEvent(data);
      });

      _socket?.on('sync_appointment_broadcast', (data) {
        _handleStatusChangeEvent(data);
      });

      _socket?.onDisconnect((_) {
        debugPrint('NotificationProvider: Desconectado del canal Socket.IO');
      });
    } catch (e) {
      debugPrint('NotificationProvider: Error al conectar socket ($e)');
    }
  }

  void notifyStatusChange({
    required int appointmentId,
    required String estado,
    required String servicio,
    required String fechaCita,
    required String horaCita,
    String? nombreBarbero,
  }) {
    final estadoLower = estado.toLowerCase().trim();
    String title;
    String body;

    if (estadoLower == 'confirmada') {
      title = '¡Cita Confirmada! ✂️';
      body =
          'Tu cita de $servicio para el $fechaCita a las $horaCita ha sido confirmada por ${nombreBarbero ?? 'el barbero'}.';
    } else if (estadoLower == 'cancelada') {
      title = 'Cita Cancelada ⚠️';
      body =
          'Tu cita de $servicio programada para el $fechaCita a las $horaCita ha sido cancelada.';
    } else if (estadoLower == 'pendiente') {
      title = 'Cita en Estado Pendiente ⏳';
      body =
          'Tu cita de $servicio para el $fechaCita a las $horaCita está en revisión pendiente.';
    } else {
      title = 'Actualización de Cita 🔔';
      body =
          'Tu cita de $servicio para el $fechaCita $horaCita cambió a estado: ${estado.toUpperCase()}.';
    }

    // Evitar notificaciones duplicadas en ventana de 6 segundos para la misma cita y estado
    if (_notifications.isNotEmpty) {
      final first = _notifications.first;
      if (first.appointmentId == appointmentId &&
          first.estado == estadoLower &&
          DateTime.now().difference(first.timestamp).inSeconds < 6) {
        return;
      }
    }

    final newNotification = AppNotificationModel(
      id: '${appointmentId}_${DateTime.now().millisecondsSinceEpoch}',
      appointmentId: appointmentId,
      title: title,
      body: body,
      estado: estadoLower,
      servicio: servicio,
      fechaCita: fechaCita,
      horaCita: horaCita,
      nombreBarbero: nombreBarbero ?? 'Barbero',
      timestamp: DateTime.now(),
      isRead: false,
    );

    _notifications.insert(0, newNotification);
    _saveNotifications();

    // Disparar notificación nativa en la bandeja del sistema Android
    _notificationService.showNotification(
      id: appointmentId,
      title: title,
      body: body,
      payload: appointmentId.toString(),
    );

    // Enviar evento al stream para desplegar aviso in-app
    _inAppNotificationStream.add(newNotification);

    notifyListeners();
  }

  void _handleStatusChangeEvent(dynamic rawData) {
    try {
      Map<String, dynamic> data;
      if (rawData is String) {
        data = jsonDecode(rawData);
      } else if (rawData is Map) {
        data = Map<String, dynamic>.from(rawData);
      } else {
        return;
      }

      final correoCita = (data['correo'] ?? '').toString().trim().toLowerCase();
      final telefonoCita = (data['telefono'] ?? '').toString().trim();

      // Validar si la cita le pertenece al usuario conectado (si tiene email/teléfono)
      final bool belongsToUser = (_currentUserEmail != null &&
              _currentUserEmail!.isNotEmpty &&
              correoCita == _currentUserEmail) ||
          (_currentUserPhone != null &&
              _currentUserPhone!.isNotEmpty &&
              telefonoCita == _currentUserPhone);

      // Si no le pertenece y no estamos en un rol global, ignorar
      if (!belongsToUser && _currentUserEmail != null && correoCita.isNotEmpty) {
        debugPrint('NotificationProvider: Notificación ignorada (pertenece a $correoCita, usuario actual es $_currentUserEmail)');
        return;
      }

      final int appointmentId = data['id'] is int
          ? data['id']
          : int.tryParse(data['id']?.toString() ?? '0') ?? 0;
      final String estado = (data['estado'] ?? '').toString();
      final String servicio = data['servicio'] ?? 'Servicio de Barbería';
      final String fechaCita = data['fechaCita'] ?? '';
      final String horaCita = data['horaCita'] ?? '';
      final String nombreBarbero = data['nombreBarbero'] ?? 'Barbero';

      notifyStatusChange(
        appointmentId: appointmentId,
        estado: estado,
        servicio: servicio,
        fechaCita: fechaCita,
        horaCita: horaCita,
        nombreBarbero: nombreBarbero,
      );

      // Refrescar automáticamente la lista de citas del cliente
      _onAppointmentUpdated?.call();
    } catch (e) {
      debugPrint('NotificationProvider: Error procesando cambio de estado ($e)');
    }
  }

  void markAsRead(String id) {
    final index = _notifications.indexWhere((n) => n.id == id);
    if (index != -1 && !_notifications[index].isRead) {
      _notifications[index].isRead = true;
      _saveNotifications();
      notifyListeners();
    }
  }

  void markAllAsRead() {
    bool changed = false;
    for (var n in _notifications) {
      if (!n.isRead) {
        n.isRead = true;
        changed = true;
      }
    }
    if (changed) {
      _saveNotifications();
      notifyListeners();
    }
  }

  void clearAll() {
    _notifications.clear();
    _saveNotifications();
    notifyListeners();
  }

  void removeNotification(String id) {
    _notifications.removeWhere((n) => n.id == id);
    _saveNotifications();
    notifyListeners();
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _socket?.dispose();
    _inAppNotificationStream.close();
    super.dispose();
  }
}
