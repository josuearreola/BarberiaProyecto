import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'auth/login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  final _storage = const FlutterSecureStorage();

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    // Simula tiempo de carga visual para que se vea el logo
    await Future.delayed(const Duration(seconds: 2));
    
    final token = await _storage.read(key: 'jwt_token');
    final role = await _storage.read(key: 'user_role') ?? 'cliente';

    if (!mounted) return;

    if (token != null) {
      if (role == 'admin' || role == 'administrador') {
        Navigator.of(context).pushReplacementNamed('/admin');
      } else {
        Navigator.of(context).pushReplacementNamed('/client');
      }
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Aquí irá tu logo
            Image.asset(
              'assets/images/logo.png',
              width: 150,
              cacheWidth: 300, // Optimización de memoria
              errorBuilder: (context, error, stackTrace) =>
                  const Icon(Icons.cut, size: 100, color: Colors.white),
            ),
            const SizedBox(height: 30),
            const CircularProgressIndicator(color: Colors.amber),
          ],
        ),
      ),
    );
  }
}
