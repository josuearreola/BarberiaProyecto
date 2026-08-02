import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_input.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  String _errorMessage = '';

  Future<void> _login() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _errorMessage = '');
      
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final success = await authProvider.login(
        _emailController.text.trim(),
        _passwordController.text,
      );

      if (success) {
        if (!mounted) return;
        
        final role = authProvider.user?.role ?? 'cliente';
        if (role == 'admin' || role == 'administrador') {
          Navigator.of(context).pushReplacementNamed('/admin');
        } else {
          Navigator.of(context).pushReplacementNamed('/client');
        }
      } else {
        if (mounted) {
          setState(() {
            _errorMessage = 'Credenciales incorrectas o error de conexión.';
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = context.watch<AuthProvider>().isLoading;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 60),
                // Logo placeholder o imagen
                Center(
                  child: Image.asset(
                    'assets/images/logo.png',
                    height: 120,
                    cacheHeight: 240, // Optimización para evitar crasheo al abrir el teclado (ANR)
                    errorBuilder: (context, error, stackTrace) {
                      return const Icon(Icons.cut, size: 80, color: Colors.white);
                    },
                  ),
                ),
                const SizedBox(height: 40),
                Text(
                  'Bienvenido de nuevo',
                  style: Theme.of(context).textTheme.displayMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 40),
                CustomInput(
                  label: 'Correo Electrónico',
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  prefixIcon: Icons.email_outlined,
                  validator: (value) => value == null || value.isEmpty ? 'Requerido' : null,
                ),
                CustomInput(
                  label: 'Contraseña',
                  controller: _passwordController,
                  isPassword: true,
                  prefixIcon: Icons.lock_outline,
                  validator: (value) => value == null || value.isEmpty ? 'Requerido' : null,
                ),
                if (_errorMessage.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    _errorMessage,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                    textAlign: TextAlign.center,
                  ),
                ],
                const SizedBox(height: 24),
                CustomButton(
                  text: 'Iniciar sesión',
                  onPressed: _login,
                  state: isLoading ? CustomButtonState.loading : CustomButtonState.normal,
                ),
                const SizedBox(height: 16),
                CustomButton(
                  text: 'Crear cuenta',
                  isSecondary: true,
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const RegisterScreen()),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
