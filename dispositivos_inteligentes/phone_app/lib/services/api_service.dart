import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  // OPCIÓN 1: Producción en Render (Activo por defecto)
  static const String baseUrl = 'https://barberiaproyecto-f2wb.onrender.com/api';

  // OPCIÓN 2: Local en Emulador de Android Studio (10.0.2.2 equivale al localhost de tu PC)
  // static const String baseUrl = 'http://10.0.2.2:3000/api';

  // OPCIÓN 3: Local en Celular Físico vía Wi-Fi (Coloca la IP local de tu PC, ej. 192.168.1.85)
  // static const String baseUrl = 'http://192.168.1.85:3000/api';

  final _storage = const FlutterSecureStorage();

  Future<Map<String, String>> _getHeaders() async {
    final token = await _storage.read(key: 'jwt_token');
    return {
      'Content-Type': 'application/json',
      'x-app-client': 'barberia-smart-device',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<http.Response> post(String endpoint, Map<String, dynamic> body) async {
    final headers = await _getHeaders();
    return await http.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
      body: jsonEncode(body),
    );
  }

  Future<http.Response> get(String endpoint) async {
    final headers = await _getHeaders();
    return await http.get(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
    );
  }

  Future<http.Response> patch(String endpoint, Map<String, dynamic> body) async {
    final headers = await _getHeaders();
    return await http.patch(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
      body: jsonEncode(body),
    );
  }

  Future<http.Response> delete(String endpoint) async {
    final headers = await _getHeaders();
    return await http.delete(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
    );
  }
}
