import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/client_provider.dart';
import '../../providers/notification_provider.dart';
import '../../widgets/notifications_sheet.dart';
import 'home_tab.dart';
import 'booking_tab.dart';
import 'my_appointments_tab.dart';
import 'profile_tab.dart';
import 'device_link_screen.dart';
import 'consulta_web_screen.dart';

import '../../services/notification_service.dart';

class ClientMainScreen extends StatefulWidget {
  const ClientMainScreen({super.key});

  @override
  State<ClientMainScreen> createState() => _ClientMainScreenState();
}

class _ClientMainScreenState extends State<ClientMainScreen> {
  int _currentIndex = 0;
  StreamSubscription? _inAppSub;
  Timer? _pollTimer;

  final List<Widget> _tabs = const [
    HomeTab(),
    BookingTab(),
    MyAppointmentsTab(),
    ProfileTab(),
    ConsultaWebScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // Solicitar permisos de notificación nativos explícitamente en Android 13/14
      await NotificationService().requestPermission();

      if (!mounted) return;
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final client = Provider.of<ClientProvider>(context, listen: false);
      final notif = Provider.of<NotificationProvider>(context, listen: false);

      // Conectar detector de cambios de estado en las citas
      client.onStatusChanged = (appt, oldStatus, newStatus) {
        notif.notifyStatusChange(
          appointmentId: appt.id,
          estado: newStatus,
          servicio: appt.servicio,
          fechaCita: appt.fechaCita,
          horaCita: appt.horaCita,
          nombreBarbero: appt.nombreBarbero,
        );
      };

      notif.updateSessionUser(
        email: auth.user?.email,
        phone: auth.user?.telefono,
        onAppointmentUpdated: () {
          client.fetchMyAppointments(silent: true);
        },
      );

      // Carga inicial de citas del cliente
      client.fetchMyAppointments(silent: false);

      // Sincronización continua cada 4 segundos (para detectar de inmediato cambios del admin)
      _pollTimer?.cancel();
      _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) {
        if (mounted) {
          client.fetchMyAppointments(silent: true);
        }
      });

      _inAppSub = notif.inAppNotificationStream.listen((n) {
        if (!mounted) return;
        Color barColor = AppColors.azulOscuro;
        if (n.estado == 'confirmada') barColor = AppColors.verdeExito;
        if (n.estado == 'cancelada') barColor = AppColors.rojo;

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(
                  n.estado == 'confirmada'
                      ? Icons.check_circle
                      : (n.estado == 'cancelada' ? Icons.cancel : Icons.info),
                  color: Colors.white,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(n.title, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                      Text(n.body, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
            backgroundColor: barColor,
            duration: const Duration(seconds: 5),
            behavior: SnackBarBehavior.floating,
            action: SnackBarAction(
              label: 'VER',
              textColor: AppColors.amarillo,
              onPressed: () => NotificationsSheet.show(context),
            ),
          ),
        );
      });
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _inAppSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.negro,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Row(
          children: [
            Image.asset('assets/images/logo.png', height: 40, cacheHeight: 80, errorBuilder: (context, error, stackTrace) => const Icon(Icons.broken_image, color: Colors.white)),
            const SizedBox(width: 10),
            const Text(
              'Bienvenido',
              style: TextStyle(color: AppColors.blanco, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.public, color: AppColors.amarillo),
            tooltip: 'ConsultaWeb (Práctica 3)',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const ConsultaWebScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.watch, color: AppColors.amarillo),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const DeviceLinkScreen()),
              );
            },
          ),
          Consumer<NotificationProvider>(
            builder: (context, notifProvider, child) {
              final unread = notifProvider.unreadCount;
              return IconButton(
                icon: Badge(
                  isLabelVisible: unread > 0,
                  label: Text('$unread', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                  backgroundColor: AppColors.rojo,
                  child: Icon(
                    unread > 0 ? Icons.notifications_active : Icons.notifications_none,
                    color: unread > 0 ? AppColors.amarillo : AppColors.blanco,
                  ),
                ),
                tooltip: 'Notificaciones ($unread)',
                onPressed: () => NotificationsSheet.show(context),
              );
            },
          ),
        ],
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment.topCenter,
              radius: 1.5,
              colors: [
                AppColors.azulOscuro.withOpacity(0.8),
                AppColors.negro,
              ],
            ),
          ),
        ),
      ),
      body: _tabs[_currentIndex],
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 10, offset: const Offset(0, -2))
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
          backgroundColor: AppColors.azulOscuro,
          selectedItemColor: AppColors.amarillo,
          unselectedItemColor: Colors.white54,
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Inicio'),
            BottomNavigationBarItem(icon: Icon(Icons.calendar_month), label: 'Reservar'),
            BottomNavigationBarItem(icon: Icon(Icons.book_online), label: 'Mis Citas'),
            BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Perfil'),
            BottomNavigationBarItem(icon: Icon(Icons.public), label: 'ConsultaWeb'),
          ],
        ),
      ),
    );
  }
}
