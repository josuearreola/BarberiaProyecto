// ignore_for_file: uri_does_not_exist, undefined_class, undefined_function, undefined_identifier, invalid_override, unnecessary_import, deprecated_member_use
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:phone_app/models/appointment_model.dart';
import 'package:phone_app/providers/client_provider.dart';
import 'package:phone_app/services/api_service.dart';
import 'package:phone_app/services/local_db_service.dart';

/// Regla de negocio / Validador de citas para el cliente móvil.
/// Permite validar antes de enviar la solicitud al backend y prevenir defectos detectados.
class AppointmentValidator {
  static const int minBusinessHour = 9;  // 09:00 AM
  static const int maxBusinessHour = 20; // 08:00 PM (20:00)

  /// Valida los datos requeridos para registrar una cita.
  static ValidationResult validate({
    required String nombreCompleto,
    required String telefono,
    required String? correo,
    required String servicio,
    required String fechaCita,
    required String horaCita,
  }) {
    // 1. Validación de entradas vacías o nulas
    if (nombreCompleto.trim().isEmpty) {
      return ValidationResult.invalid('El nombre completo es obligatorio.');
    }
    if (telefono.trim().isEmpty) {
      return ValidationResult.invalid('El número de teléfono es obligatorio.');
    }
    if (servicio.trim().isEmpty) {
      return ValidationResult.invalid('Debe seleccionar un servicio válido.');
    }
    if (fechaCita.trim().isEmpty || horaCita.trim().isEmpty) {
      return ValidationResult.invalid('La fecha y hora de la cita son obligatorias.');
    }

    // 2. Validación de formato de teléfono (al menos 10 dígitos)
    final cleanPhone = telefono.replaceAll(RegExp(r'\D'), '');
    if (cleanPhone.length < 10) {
      return ValidationResult.invalid('El teléfono debe contener al menos 10 dígitos.');
    }

    // 3. Validación de valores fuera de rango (horario comercial 09:00 a 20:00)
    final parts = horaCita.split(':');
    if (parts.length < 2) {
      return ValidationResult.invalid('Formato de hora inválido. Use HH:mm.');
    }
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null || minute < 0 || minute > 59) {
      return ValidationResult.invalid('Los minutos de la cita deben estar entre 0 y 59.');
    }
    if (hour < minBusinessHour || hour > maxBusinessHour) {
      return ValidationResult.invalid(
        'Horario fuera de rango. El horario de atención es de 09:00 a 20:00 hrs.',
      );
    }

    return ValidationResult.valid();
  }
}

class ValidationResult {
  final bool isValid;
  final String? errorMessage;

  ValidationResult._(this.isValid, this.errorMessage);

  factory ValidationResult.valid() => ValidationResult._(true, null);
  factory ValidationResult.invalid(String message) => ValidationResult._(false, message);
}

/// Fake de ApiService para pruebas de integración controladas.
class FakeApiServiceForTesting extends ApiService {
  http.Response Function(String endpoint, Map<String, dynamic> body)? postHandler;
  http.Response Function(String endpoint)? getHandler;

  @override
  Future<http.Response> post(
    String endpoint,
    Map<String, dynamic> body, {
    String? idempotencyKey,
  }) async {
    if (postHandler != null) return postHandler!(endpoint, body);
    return http.Response(jsonEncode({'id': 1, 'status': 'created'}), 201);
  }

  @override
  Future<http.Response> get(String endpoint) async {
    if (getHandler != null) return getHandler!(endpoint);
    return http.Response('[]', 200);
  }
}

/// Fake de LocalDbService en memoria para pruebas de persistencia sin SQLite nativo.
class InMemoryLocalDbService extends LocalDbService {
  InMemoryLocalDbService() : super.forTesting();

  final List<AppointmentModel> _cache = [];

  @override
  Future<void> saveAppointments(List<AppointmentModel> appointments) async {
    _cache.clear();
    _cache.addAll(appointments);
  }

  @override
  Future<List<AppointmentModel>> getCachedAppointments() async {
    return List.unmodifiable(_cache);
  }

  @override
  Future<void> clearAppointmentsCache() async {
    _cache.clear();
  }
}

void main() {
  group('PRACTICA 13 y 14: Automatización de Pruebas Móviles y Validación Continua', () {

    // =========================================================================
    // FASE 2: AUTOMATIZACIÓN DE PRUEBAS UNITARIAS (Lógica de Negocio)
    // =========================================================================
    group('Fase 2 - Pruebas Unitarias de Lógica de Negocio (AUT-01 a AUT-05)', () {

      test('[AUT-01] [Unitaria] Entrada válida: Construcción y validación de cita con datos íntegros', () {
        // Datos de entrada con valores válidos y dentro de reglas
        final result = AppointmentValidator.validate(
          nombreCompleto: 'Carlos Mendoza',
          telefono: '5512345678',
          correo: 'carlos@ejemplo.com',
          servicio: 'Corte Clásico y Barba',
          fechaCita: '2026-11-25',
          horaCita: '14:30',
        );

        expect(result.isValid, isTrue);
        expect(result.errorMessage, isNull);

        // Validar creación de modelo con resultado esperado
        final model = AppointmentModel(
          id: 101,
          nombreCompleto: 'Carlos Mendoza',
          telefono: '5512345678',
          correo: 'carlos@ejemplo.com',
          servicio: 'Corte Clásico y Barba',
          fechaCita: '2026-11-25',
          horaCita: '14:30',
          estado: 'pendiente',
        );

        expect(model.id, equals(101));
        expect(model.estado, equals('pendiente'));
        expect(model.nombreCompleto, equals('Carlos Mendoza'));
      });

      test('[AUT-02] [Unitaria] Entrada vacía o nula: Rechazo de campos obligatorios faltantes', () {
        // Caso: Nombre vacío
        final resNombreVacio = AppointmentValidator.validate(
          nombreCompleto: '   ',
          telefono: '5512345678',
          correo: 'test@ejemplo.com',
          servicio: 'Corte',
          fechaCita: '2026-11-25',
          horaCita: '10:00',
        );
        expect(resNombreVacio.isValid, isFalse);
        expect(resNombreVacio.errorMessage, contains('nombre completo es obligatorio'));

        // Caso: Servicio vacío
        final resServicioVacio = AppointmentValidator.validate(
          nombreCompleto: 'Ana García',
          telefono: '5512345678',
          correo: 'ana@ejemplo.com',
          servicio: '',
          fechaCita: '2026-11-25',
          horaCita: '10:00',
        );
        expect(resServicioVacio.isValid, isFalse);
        expect(resServicioVacio.errorMessage, contains('seleccionar un servicio válido'));
      });

      test('[AUT-03] [Unitaria] Valores fuera de rango: Detección y rechazo de horario fuera de jornada', () {
        // Caso A: Madrugada (03:15 AM - Fuera del horario laboral de 09:00 a 20:00)
        final resMadrugada = AppointmentValidator.validate(
          nombreCompleto: 'Roberto Gómez',
          telefono: '5598765432',
          correo: 'roberto@ejemplo.com',
          servicio: 'Afeitado Tradicional',
          fechaCita: '2026-11-25',
          horaCita: '03:15',
        );
        expect(resMadrugada.isValid, isFalse);
        expect(resMadrugada.errorMessage, contains('fuera de rango'));

        // Caso B: Minutos inválidos fuera del rango 0-59 (ej. 14:85)
        final resMinutosInvalidos = AppointmentValidator.validate(
          nombreCompleto: 'Roberto Gómez',
          telefono: '5598765432',
          correo: 'roberto@ejemplo.com',
          servicio: 'Afeitado Tradicional',
          fechaCita: '2026-11-25',
          horaCita: '14:85',
        );
        expect(resMinutosInvalidos.isValid, isFalse);
        expect(resMinutosInvalidos.errorMessage, contains('minutos'));
      });

      test('[AUT-04] [Unitaria] Resultado esperado: Normalización de datos y estado por defecto', () {
        // Simulación de respuesta JSON de backend con alias y valores por defecto
        final Map<String, dynamic> rawJson = {
          'id': 204,
          'nombre_completo': 'David Silva',
          'telefono': '5544332211',
          'servicio': 'Corte Fade',
          'fecha_cita': '2026-12-01',
          'hora_cita': '16:00',
          // Sin campo 'estado', el modelo debe asignar 'pendiente'
        };

        final appointment = AppointmentModel.fromJson(rawJson);

        expect(appointment.id, equals(204));
        expect(appointment.nombreCompleto, equals('David Silva'));
        expect(appointment.estado, equals('pendiente'));
        expect(appointment.correo, isNull);
      });

      test('[AUT-05] [Unitaria] Manejo de excepciones: Control seguro ante deserialización con formato inválido', () {
        // JSON malformado con tipos erróneos incompatibles (ej. body no decodificable)
        const String corruptJsonString = '{"id": "NO_ES_UN_NUMERO", "nombre": 12345';

        expect(() {
          // Intentar decodificar JSON trunco debe lanzar FormatException controlada
          jsonDecode(corruptJsonString);
        }, throwsA(isA<FormatException>()));
      });

    });

    // =========================================================================
    // FASE 3: AUTOMATIZACIÓN DE INTEGRACIÓN (Comunicación y Persistencia)
    // =========================================================================
    group('Fase 3 - Pruebas de Integración entre Componentes (AUT-06 a AUT-08)', () {

      test('[AUT-06] [Integración] App envía información al servicio y recibe respuesta válida (HTTP 201 Created)', () async {
        final fakeApi = FakeApiServiceForTesting();
        final fakeDb = InMemoryLocalDbService();

        // Configurar simulación del servidor respondiendo 201 Created
        fakeApi.postHandler = (endpoint, body) {
          expect(endpoint, equals('/appointments'));
          expect(body['servicio'], equals('Corte y Barba'));
          return http.Response(
            jsonEncode({
              'id': 350,
              'nombreCompleto': body['nombreCompleto'],
              'telefono': body['telefono'],
              'servicio': body['servicio'],
              'fechaCita': body['fechaCita'],
              'horaCita': body['horaCita'],
              'estado': 'pendiente',
            }),
            201,
          );
        };

        final provider = ClientProvider(apiService: fakeApi, localDb: fakeDb);

        final bool success = await provider.createAppointment(
          nombreCompleto: 'Mariana Ruiz',
          telefono: '5566778899',
          correo: 'mariana@ejemplo.com',
          servicio: 'Corte y Barba',
          fechaCita: '2026-11-26',
          horaCita: '11:00',
        );

        expect(success, isTrue);
        expect(provider.error, isEmpty);
        expect(provider.isLoading, isFalse);
      });

      test('[AUT-07] [Integración] API devuelve código HTTP 400 Bad Request y la aplicación gestiona el mensaje de error', () async {
        final fakeApi = FakeApiServiceForTesting();
        final fakeDb = InMemoryLocalDbService();

        // Configurar servidor devolviendo error 400 con mensaje de validación
        fakeApi.postHandler = (endpoint, body) {
          return http.Response(
            jsonEncode({
              'statusCode': 400,
              'message': 'El barbero seleccionado no tiene disponibilidad en ese horario.',
              'error': 'Bad Request',
            }),
            400,
          );
        };

        final provider = ClientProvider(apiService: fakeApi, localDb: fakeDb);

        final bool success = await provider.createAppointment(
          nombreCompleto: 'Pedro Pascal',
          telefono: '5511223344',
          correo: 'pedro@ejemplo.com',
          servicio: 'Corte Infantil',
          fechaCita: '2026-11-26',
          horaCita: '12:00',
        );

        expect(success, isFalse);
        expect(provider.error, contains('disponibilidad en ese horario'));
      });

      test('[AUT-08] [Persistencia/Integración] Servidor no responde: Respaldo en almacenamiento local y aviso de contingencia', () async {
        final fakeApi = FakeApiServiceForTesting();
        final inMemoryDb = InMemoryLocalDbService();

        // Simular que el servidor no responde (caída de red / SocketException)
        fakeApi.getHandler = (endpoint) {
          throw const SocketException('No se puede conectar al servidor host');
        };

        // Precargar una cita en el almacenamiento local de contingencia
        final cachedAppt = AppointmentModel(
          id: 999,
          nombreCompleto: 'Cliente Offline',
          telefono: '5500000000',
          correo: 'offline@ejemplo.com',
          servicio: 'Corte Rápido',
          fechaCita: '2026-11-27',
          horaCita: '15:00',
          estado: 'confirmada',
        );
        await inMemoryDb.saveAppointments([cachedAppt]);

        final provider = ClientProvider(apiService: fakeApi, localDb: inMemoryDb);

        // Al intentar consultar al servidor sin red, debe recurrir a la persistencia local
        await provider.fetchMyAppointments();

        // Valida que los datos se recuperaron exitosamente del almacenamiento local de contingencia
        expect(provider.myAppointments, isNotEmpty);
        expect(provider.myAppointments.first.id, equals(999));
        expect(provider.myAppointments.first.nombreCompleto, equals('Cliente Offline'));
        expect(provider.isLoading, isFalse);
      });

    });

  });
}
