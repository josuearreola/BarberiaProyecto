import 'package:flutter/material.dart';
import '../../theme.dart';
import 'home_tab.dart';
import 'booking_tab.dart';
import 'my_appointments_tab.dart';
import 'profile_tab.dart';
import 'device_link_screen.dart';

class ClientMainScreen extends StatefulWidget {
  const ClientMainScreen({super.key});

  @override
  State<ClientMainScreen> createState() => _ClientMainScreenState();
}

class _ClientMainScreenState extends State<ClientMainScreen> {
  int _currentIndex = 0;

  final List<Widget> _tabs = const [
    HomeTab(),
    BookingTab(),
    MyAppointmentsTab(),
    ProfileTab(),
  ];

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
            icon: const Icon(Icons.watch, color: AppColors.amarillo),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const DeviceLinkScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.notifications_none, color: AppColors.blanco),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('No tienes notificaciones nuevas')),
              );
            },
          )
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
          ],
        ),
      ),
    );
  }
}
