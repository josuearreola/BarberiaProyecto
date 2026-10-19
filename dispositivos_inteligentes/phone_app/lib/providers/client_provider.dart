import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../models/appointment_model.dart';
import '../services/api_service.dart';

class ClientProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  
  List<AppointmentModel> _myAppointments = [];
  bool _isLoading = false;
  String _error = '';

  List<AppointmentModel> get myAppointments => _myAppointments;
  bool get isLoading => _isLoading;
  String get error => _error;

  Future<void> fetchMyAppointments() async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final response = await _apiService.get('/appointments/mis-citas');
      
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        _myAppointments = data.map((json) => AppointmentModel.fromJson(json)).toList();
      } else {
        _error = 'Error al cargar tus citas: ${response.statusCode}';
      }
    } catch (e) {
      _error = 'Error de conexión: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
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
  }) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

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

      final response = await _apiService.post('/appointments', body);

      if (response.statusCode == 201 || response.statusCode == 200) {
        await fetchMyAppointments();
        return true;
      } else {
        _error = 'No se pudo crear la cita: ${response.statusCode} - ${response.body}';
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

  Future<bool> cancelMyAppointment(int id) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final response = await _apiService.patch('/appointments/mis-citas/$id/cancelar', {});
      
      if (response.statusCode == 200) {
        await fetchMyAppointments();
        return true;
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
        if (fileName != null) 'fileName': fileName,
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
      final response = await http.put(
        Uri.parse(uploadUrl),
        headers: {
          'Content-Type': 'audio/m4a',
          'x-app-client': 'barberia-smart-device',
        },
        body: audioBytes,
      );

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
