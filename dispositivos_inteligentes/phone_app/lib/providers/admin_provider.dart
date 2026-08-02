import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/appointment_model.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';

class AdminProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  
  bool _isLoading = false;
  bool get isLoading => _isLoading;

  List<AppointmentModel> _appointments = [];
  List<AppointmentModel> get appointments => _appointments;

  List<UserModel> _users = [];
  List<UserModel> get users => _users;

  int get totalAppointments => _appointments.length;
  int get pendingAppointments => _appointments.where((a) => a.estado == 'pendiente').length;
  int get confirmedAppointments => _appointments.where((a) => a.estado == 'confirmada').length;
  int get totalUsers => _users.length;

  Future<void> fetchDashboardData() async {
    _isLoading = true;
    // No usamos notifyListeners aquí si se llama desde un initState, lo haremos al final
    notifyListeners();

    try {
      // 1. Obtener Citas
      final respCitas = await _apiService.get('/appointments');
      if (respCitas.statusCode == 200) {
        final data = jsonDecode(respCitas.body);
        final List items = data['data'] ?? data; // Dependiendo de cómo lo envíe Nest
        _appointments = items.map((e) => AppointmentModel.fromJson(e)).toList();
      }

      // 2. Obtener Usuarios
      final respUsers = await _apiService.get('/users');
      if (respUsers.statusCode == 200) {
        final data = jsonDecode(respUsers.body);
        final List items = data['data'] ?? data;
        _users = items.map((e) => UserModel.fromJson(e)).toList();
      }

    } catch (e) {
      print('Error cargando dashboard: $e');
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> updateAppointmentStatus(int id, String newStatus, {String? nombreBarbero}) async {
    try {
      print('--- INTENTANDO ACTUALIZAR CITA $id A $newStatus ---');
      final body = {'estado': newStatus};
      if (nombreBarbero != null && nombreBarbero.isNotEmpty) {
        body['nombreBarbero'] = nombreBarbero;
      }
      final resp = await _apiService.patch('/appointments/$id/estado', body);
      print('RESPUESTA DEL SERVIDOR: ${resp.statusCode} - ${resp.body}');
      
      if (resp.statusCode == 200 || resp.statusCode == 201) {
        print('✅ CITA ACTUALIZADA CON EXITO');
        await fetchDashboardData();
      } else {
        print('❌ ERROR ACTUALIZANDO CITA. Codigo: ${resp.statusCode}');
      }
    } catch (e) {
      print('❌ EXCEPCION ACTUALIZANDO CITA: $e');
    }
  }

  Future<void> restoreUser(int id) async {
    try {
      print('--- INTENTANDO RESTAURAR USUARIO $id ---');
      final resp = await _apiService.patch('/users/$id', {'estado': 'activo'});
      print('RESPUESTA DEL SERVIDOR: ${resp.statusCode} - ${resp.body}');

      if (resp.statusCode == 200 || resp.statusCode == 204) {
        print('✅ USUARIO RESTAURADO CON EXITO');
        await fetchDashboardData();
      } else {
        print('❌ ERROR RESTAURANDO USUARIO. Codigo: ${resp.statusCode}');
      }
    } catch (e) {
      print('❌ EXCEPCION RESTAURANDO USUARIO: $e');
    }
  }

  Future<void> deleteUser(int id) async {
    try {
      print('--- INTENTANDO ELIMINAR USUARIO $id ---');
      final resp = await _apiService.delete('/users/$id');
      print('RESPUESTA DEL SERVIDOR: ${resp.statusCode} - ${resp.body}');

      if (resp.statusCode == 200 || resp.statusCode == 204) {
        print('✅ USUARIO ELIMINADO CON EXITO');
        await fetchDashboardData();
      } else {
        print('❌ ERROR ELIMINANDO USUARIO. Codigo: ${resp.statusCode}');
      }
    } catch (e) {
      print('❌ EXCEPCION ELIMINANDO USUARIO: $e');
    }
  }
}
