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
  final _userController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  String _errorMessage = '';

  // =========================================================================
  // PARÁMETROS DE SEGURIDAD (Práctica 5: AccesoSeguro)
  // =========================================================================
  // Regla 3: Rechazar entradas que superen una longitud definida
  static const int _maxUserLength = 18;
  static const int _maxPasswordLength = 20;

  // Regla adicional: Comprobar que la contraseña tenga al menos 8 caracteres
  static const int _minPasswordLength = 8;

  @override
  void dispose() {
    _userController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  // Regla 7: Mostrar mensaje de acceso válido tras verificación del backend
  Future<void> _mostrarAccesoExitoso(String usuario) async {
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E2124),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Colors.greenAccent, width: 1.5),
        ),
        title: const Row(
          children: [
            Icon(Icons.verified_user_rounded, color: Colors.greenAccent, size: 28),
            SizedBox(width: 10),
            Text(
              'Acceso Concedido',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '¡Autenticación exitosa!',
              style: TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 8),
            Text(
              'Bienvenido, $usuario. Tus credenciales han sido verificadas correctamente por el servidor.',
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.greenAccent,
              foregroundColor: Colors.black,
            ),
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Entrar a la App', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _login() async {
    // Regla 2 y Regla 3: Validación visual en Frontend de entradas
    if (_formKey.currentState!.validate()) {
      setState(() => _errorMessage = '');

      final inputUser = _userController.text.trim();
      final inputPassword = _passwordController.text;

      // =====================================================================
      // Regla 6: NUNCA imprimir contraseñas ni datos confidenciales en Logcat
      // =====================================================================
      debugPrint('AccesoSeguro: Procesando solicitud de autenticación con el servidor.');

      // =====================================================================
      // VALIDACIÓN CON EL BACKEND (Autenticación real de contraseñas y correos)
      // =====================================================================
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final success = await authProvider.login(inputUser, inputPassword);

      if (success) {
        if (!mounted) return;

        // Regla 7: Mostrar mensaje de acceso cuando los datos sean válidos en el backend
        final displayName = authProvider.user?.usuario ?? authProvider.user?.email ?? inputUser;
        await _mostrarAccesoExitoso(displayName);

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
            // Regla 5: Mostrar mensajes de error genéricos, sin revelar datos sensibles
            // (Evita User Enumeration al no revelar si falló el correo o la contraseña en el backend)
            _errorMessage = 'Credenciales inválidas. Verifique sus datos e intente nuevamente.';
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
                const SizedBox(height: 50),
                // Logo de la Barbería
                Center(
                  child: Image.asset(
                    'assets/images/logo.png',
                    height: 120,
                    cacheHeight: 240,
                    errorBuilder: (context, error, stackTrace) {
                      return const Icon(Icons.cut, size: 80, color: Colors.white);
                    },
                  ),
                ),
                const SizedBox(height: 30),
                Text(
                  'Bienvenido de nuevo',
                  style: Theme.of(context).textTheme.displayMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                const Text(
                  'Acceso Seguro — Barbería Premium',
                  style: TextStyle(color: Colors.white60, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 35),

                // Regla 1: Campo para usuario / correo electrónico
                // Regla 2: Validar que contenga información y evitar solo espacios
                // Regla 3: Rechazar entradas que superen la longitud definida (_maxUserLength)
                CustomInput(
                  label: 'Correo Electrónico / Usuario',
                  hint: 'ej. cliente@gmail.com',
                  controller: _userController,
                  keyboardType: TextInputType.emailAddress,
                  prefixIcon: Icons.email_outlined,
                  maxLength: _maxUserLength,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'El correo/usuario es requerido y no puede contener solo espacios.';
                    }
                    if (value.trim().length > _maxUserLength) {
                      return 'El correo/usuario no debe superar los $_maxUserLength caracteres.';
                    }
                    return null;
                  },
                ),

                // Regla 1: Campo para contraseña
                // Regla 2: Validar que contenga información
                // Regla 3: Rechazar entradas que superen la longitud definida (_maxPasswordLength)
                // Regla 4: Ocultar los caracteres de la contraseña (isPassword: true)
                // Regla adicional: Comprobar que la contraseña tenga al menos 8 caracteres
                CustomInput(
                  label: 'Contraseña',
                  hint: 'Mínimo 8 caracteres',
                  controller: _passwordController,
                  isPassword: true,
                  prefixIcon: Icons.lock_outline,
                  maxLength: _maxPasswordLength,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'La contraseña es requerida.';
                    }
                    if (value.length < _minPasswordLength) {
                      return 'La contraseña debe tener al menos $_minPasswordLength caracteres.';
                    }
                    if (value.length > _maxPasswordLength) {
                      return 'La contraseña no debe superar los $_maxPasswordLength caracteres.';
                    }
                    return null;
                  },
                ),

                // Regla 5: Mensaje de error genérico sin exponer detalles técnicos
                if (_errorMessage.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.redAccent.withOpacity(0.5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: Colors.redAccent, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage,
                            style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                const SizedBox(height: 20),
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
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
