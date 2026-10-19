import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final _storage = const FlutterSecureStorage();
  
  UserModel? _user;
  bool _isLoading = false;

  UserModel? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiService.post('/auth/login', {
        'email': email,
        'password': password,
      });

      // REGLA 6: Evitar imprimir contraseñas, tokens u otros datos confidenciales en Logcat
      debugPrint('Auth: Intento de inicio de sesión procesado con código de estado: ${response.statusCode}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        _user = UserModel.fromJson(data);
        
        // Guardar el token de acceso y el rol
        if (data['accessToken'] != null) {
          await _storage.write(key: 'jwt_token', value: data['accessToken']);
          await _storage.write(key: 'user_role', value: _user?.role ?? 'cliente');
        }
        
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      // REGLA 6: Evitar volcado de excepciones técnicas con información interna sensible
      debugPrint('Auth: Ocurrió un error seguro durante la autenticación.');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<String?> getSavedRole() async {
    return await _storage.read(key: 'user_role');
  }

  Future<bool> register({
    required String usuario,
    required String email,
    required String telefono,
    required String password,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiService.post('/auth/register', {
        'usuario': usuario,
        'email': email,
        'telefono': telefono,
        'password': password,
      });

      // REGLA 6: Evitar imprimir contraseñas, tokens u otros datos confidenciales en Logcat
      debugPrint('Auth: Intento de registro procesado con código de estado: ${response.statusCode}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      // REGLA 6: Evitar volcado de excepciones técnicas con información interna sensible
      debugPrint('Auth: Ocurrió un error seguro durante el registro.');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: 'jwt_token');
    _user = null;
    notifyListeners();
  }
}
