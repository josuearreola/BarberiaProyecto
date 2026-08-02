import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_input.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nombreController = TextEditingController();
  final _emailController = TextEditingController();
  final _telefonoController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  
  String _errorMessage = '';
  bool _success = false;

  Future<void> _register() async {
    if (_formKey.currentState!.validate()) {
      if (_passwordController.text != _confirmPasswordController.text) {
        setState(() => _errorMessage = 'Las contraseñas no coinciden');
        return;
      }

      setState(() => _errorMessage = '');
      
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final success = await authProvider.register(
        usuario: _nombreController.text.trim(),
        email: _emailController.text.trim(),
        telefono: _telefonoController.text.trim(),
        password: _passwordController.text,
      );

      if (success) {
        setState(() {
          _success = true;
          _errorMessage = '';
        });
        
        // Esperamos un momento y devolvemos al login
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) Navigator.pop(context);
        });
      } else {
        if (mounted) {
          setState(() {
            _errorMessage = 'Ocurrió un error al registrarse. Intenta de nuevo.';
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = context.watch<AuthProvider>().isLoading;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Crear Cuenta'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                CustomInput(
                  label: 'Nombre completo',
                  controller: _nombreController,
                  prefixIcon: Icons.person_outline,
                  validator: (value) => value == null || value.isEmpty ? 'Requerido' : null,
                ),
                CustomInput(
                  label: 'Correo Electrónico',
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  prefixIcon: Icons.email_outlined,
                  validator: (value) => value == null || value.isEmpty ? 'Requerido' : null,
                ),
                CustomInput(
                  label: 'Teléfono',
                  controller: _telefonoController,
                  keyboardType: TextInputType.phone,
                  prefixIcon: Icons.phone_outlined,
                  validator: (value) => value == null || value.isEmpty ? 'Requerido' : null,
                ),
                CustomInput(
                  label: 'Contraseña',
                  controller: _passwordController,
                  isPassword: true,
                  prefixIcon: Icons.lock_outline,
                  validator: (value) => value == null || value.length < 6 ? 'Mínimo 6 caracteres' : null,
                ),
                CustomInput(
                  label: 'Confirmar Contraseña',
                  controller: _confirmPasswordController,
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
                  text: 'Registrarse',
                  onPressed: _success ? null : _register,
                  state: _success 
                      ? CustomButtonState.success 
                      : (isLoading ? CustomButtonState.loading : CustomButtonState.normal),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
