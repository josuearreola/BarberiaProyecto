import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:phone_app/models/appointment_model.dart';
import 'package:phone_app/providers/client_provider.dart';
import 'package:phone_app/services/api_service.dart';
import 'package:phone_app/services/local_db_service.dart';

/// Doble de prueba (Fake) de ApiService para pruebas unitarias aisladas
class FakeApiService extends ApiService {
  int getCallCount = 0;
  int postCallCount = 0;
  String? lastEndpoint;
  Map<String, dynamic>? lastPostBody;

  http.Response Function(String endpoint)? getHandler;
  http.Response Function(String endpoint, Map<String, dynamic> body)? postHandler;

  @override
  Future<http.Response> get(String endpoint) async {
    getCallCount++;
    lastEndpoint = endpoint;
    if (getHandler != null) {
      return getHandler!(endpoint);
    }
    return http.Response('[]', 200);
  }

  @override
  Future<http.Response> post(String endpoint, Map<String, dynamic> body, {String? idempotencyKey}) async {
    postCallCount++;
    lastEndpoint = endpoint;
    lastPostBody = body;
    if (postHandler != null) {
      return postHandler!(endpoint, body);
    }
    return http.Response('{"id": 101, "status": "creado"}', 201);
  }
}

/// Doble de prueba (Fake) de LocalDbService para almacenamiento en memoria
class FakeLocalDbService extends LocalDbService {
  FakeLocalDbService() : super.forTesting();

  final List<AppointmentModel> inMemoryDb = [];
  int saveCount = 0;
  int getCount = 0;

  @override
  Future<void> saveAppointments(List<AppointmentModel> appointments) async {
    saveCount++;
    inMemoryDb.clear();
    inMemoryDb.addAll(appointments);
  }

  @override
  Future<List<AppointmentModel>> getCachedAppointments() async {
    getCount++;
    return List<AppointmentModel>.from(inMemoryDb);
  }

  @override
  Future<void> clearAppointmentsCache() async {
    inMemoryDb.clear();
  }
}

void main() {
  group('Fase 2: Pruebas Unitarias de Lógica de Negocio (Citas y Reservaciones)', () {
    late FakeApiService fakeApi;
    late FakeLocalDbService fakeDb;
    late ClientProvider clientProvider;

    setUp(() {
      fakeApi = FakeApiService();
      fakeDb = FakeLocalDbService();
      clientProvider = ClientProvider(apiService: fakeApi, localDb: fakeDb);
    });

    // =========================================================================
    // 1. CASO VÁLIDO
    // =========================================================================
    test('[UNIT-01] Caso Válido: Creación exitosa de cita con parámetros completos y respuesta 201', () async {
      // Configurar respuesta exitosa de la API
      fakeApi.postHandler = (endpoint, body) {
        expect(endpoint, '/appointments');
        expect(body['nombreCompleto'], 'Carlos Santana');
        expect(body['telefono'], '5512345678');
        expect(body['servicio'], 'Corte Clásico');
        expect(body['fechaCita'], '2026-11-15');
        expect(body['horaCita'], '11:00');
        return http.Response(jsonEncode({'id': 1, 'mensaje': 'Cita creada exitosamente'}), 201);
      };

      // Ejecutar la acción
      final resultado = await clientProvider.createAppointment(
        nombreCompleto: 'Carlos Santana',
        telefono: '5512345678',
        correo: 'carlos@test.com',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-15',
        horaCita: '11:00',
        notas: 'Nota opcional de corte',
      );

      // Verificaciones esperadas
      expect(resultado, isTrue, reason: 'createAppointment debe retornar true ante HTTP 201');
      expect(clientProvider.error, isEmpty, reason: 'El mensaje de error debe permanecer vacío');
      expect(clientProvider.isLoading, isFalse, reason: 'El estado de carga debe finalizar en false');
      expect(fakeApi.postCallCount, 1, reason: 'Debe realizar exactamente una petición POST a la API');
    });

    test('[UNIT-02] Caso Válido: Serialización íntegra y bidireccional de AppointmentModel (fromJson / toMap)', () {
      final jsonOriginal = {
        'id': 42,
        'nombreCompleto': 'Mariana López',
        'telefono': '5588776655',
        'correo': 'mariana@test.com',
        'servicio': 'Perfilado de Barba',
        'fechaCita': '2026-12-01',
        'horaCita': '15:30',
        'estado': 'confirmada',
        'notas': 'https://s3.amazonaws.com/audio.m4a',
        'nombreBarbero': 'Barbero Juan',
      };

      final appointment = AppointmentModel.fromJson(jsonOriginal);
      final mapaExportado = appointment.toMap();

      expect(appointment.id, 42);
      expect(appointment.nombreCompleto, 'Mariana López');
      expect(appointment.estado, 'confirmada');
      expect(appointment.nombreBarbero, 'Barbero Juan');
      expect(mapaExportado['servicio'], 'Perfilado de Barba');
      expect(mapaExportado['notas'], 'https://s3.amazonaws.com/audio.m4a');
    });

    // =========================================================================
    // 2. CASOS LÍMITE (BOUNDARY CASES)
    // =========================================================================
    test('[UNIT-03] Caso Límite: Parseo tolerante de JSON con llaves snake_case, campos nulos y estado por defecto', () {
      // JSON proveniente de base de datos SQL o servicios legacy que usan snake_case y omiten campos
      final jsonSnakeCase = {
        'id': 99,
        'nombre_completo': 'Roberto Gómez',
        'telefono': '5544332211',
        'servicio': 'Tinte / Decoloración',
        'fecha_cita': '2026-11-20',
        'hora_cita': '16:00',
        // 'correo' es nulo u omitido
        // 'estado' es nulo u omitido (debe asignar 'pendiente')
        // 'notas' es nulo u omitido
        'nombre_barbero': 'Barbero Pedro',
      };

      final appointment = AppointmentModel.fromJson(jsonSnakeCase);

      expect(appointment.id, 99);
      expect(appointment.nombreCompleto, 'Roberto Gómez', reason: 'Debe mapear nombre_completo si nombreCompleto está ausente');
      expect(appointment.fechaCita, '2026-11-20', reason: 'Debe mapear fecha_cita si fechaCita está ausente');
      expect(appointment.horaCita, '16:00', reason: 'Debe mapear hora_cita si horaCita está ausente');
      expect(appointment.nombreBarbero, 'Barbero Pedro', reason: 'Debe mapear nombre_barbero si nombreBarbero está ausente');
      expect(appointment.estado, 'pendiente', reason: 'Cuando estado es nulo, el valor por omisión debe ser pendiente');
      expect(appointment.correo, isNull);
      expect(appointment.notas, isNull);
    });

    test('[UNIT-04] Caso Límite: Normalización de estados y disparo selectivo de onStatusChanged', () async {
      // 1. Simular carga inicial con una cita en estado 'pendiente'
      fakeApi.getHandler = (_) => http.Response(
        jsonEncode([
          {
            'id': 10,
            'nombreCompleto': 'Cliente Test',
            'telefono': '5511223344',
            'servicio': 'Corte Clásico',
            'fechaCita': '2026-11-10',
            'horaCita': '10:00',
            'estado': 'pendiente',
          }
        ]),
        200,
      );

      bool callbackDisparado = false;
      String? estadoPrevioCapturado;
      String? nuevoEstadoCapturado;

      clientProvider.onStatusChanged = (appt, oldStatus, newStatus) {
        callbackDisparado = true;
        estadoPrevioCapturado = oldStatus;
        nuevoEstadoCapturado = newStatus;
      };

      await clientProvider.fetchMyAppointments();
      expect(callbackDisparado, isFalse, reason: 'En la primera carga de citas no debe disparar alerta de cambio');

      // 2. Simular respuesta con variación puramente cosmética de mayúsculas y espacios (' PENDIENTE ')
      fakeApi.getHandler = (_) => http.Response(
        jsonEncode([
          {
            'id': 10,
            'nombreCompleto': 'Cliente Test',
            'telefono': '5511223344',
            'servicio': 'Corte Clásico',
            'fechaCita': '2026-11-10',
            'horaCita': '10:00',
            'estado': ' PENDIENTE ',
          }
        ]),
        200,
      );
      await clientProvider.fetchMyAppointments(silent: true);
      expect(callbackDisparado, isFalse, reason: 'Espacios o mayúsculas en el mismo estado NO deben disparar alerta falsa');

      // 3. Simular cambio real de estado de negocio a 'confirmada'
      fakeApi.getHandler = (_) => http.Response(
        jsonEncode([
          {
            'id': 10,
            'nombreCompleto': 'Cliente Test',
            'telefono': '5511223344',
            'servicio': 'Corte Clásico',
            'fechaCita': '2026-11-10',
            'horaCita': '10:00',
            'estado': 'confirmada',
          }
        ]),
        200,
      );
      await clientProvider.fetchMyAppointments(silent: true);
      expect(callbackDisparado, isTrue, reason: 'Debe disparar onStatusChanged cuando el estado cambia de verdad');
      expect(estadoPrevioCapturado?.toLowerCase().trim(), 'pendiente');
      expect(nuevoEstadoCapturado?.toLowerCase().trim(), 'confirmada');
    });

    // =========================================================================
    // 3. CASOS INVÁLIDOS Y MANEJO DE ERRORES DE NEGOCIO
    // =========================================================================
    test('[UNIT-05] Caso Inválido: Detección de colisión de horario (HTTP 409 Conflict / Double Booking)', () async {
      fakeApi.postHandler = (endpoint, body) {
        return http.Response(
          jsonEncode({
            'statusCode': 409,
            'message': 'La hora seleccionada ya está ocupada. Por favor elige otro horario.',
            'error': 'Conflict',
          }),
          409,
        );
      };

      final resultado = await clientProvider.createAppointment(
        nombreCompleto: 'Prueba Colisión',
        telefono: '5500000000',
        correo: 'colision@test.com',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-15',
        horaCita: '11:00',
      );

      expect(resultado, isFalse, reason: 'Ante colisión 409 la función debe indicar fallo retornando false');
      expect(clientProvider.error, contains('ocupada'), reason: 'Debe guardar el mensaje descriptivo del conflicto');
      expect(clientProvider.isLoading, isFalse);
    });

    test('[UNIT-06] Caso de Error: Falla de conexión a la API sin datos en caché SQLite local', () async {
      // Simular que la API lanza excepción de socket/timeout
      fakeApi.getHandler = (_) => throw Exception('Connection refused / Sin internet');

      await clientProvider.fetchMyAppointments();

      expect(clientProvider.myAppointments, isEmpty, reason: 'Sin caché previa, la lista debe quedar vacía');
      expect(clientProvider.error, contains('Modo sin conexión'), reason: 'Debe notificar modo sin conexión amigable al usuario');
      expect(clientProvider.isLoading, isFalse);
    });

    // =========================================================================
    // 4. DEFECTO REPRODUCIBLE EN VALIDACIÓN DE ENTRADAS
    // =========================================================================
    test('[UNIT-07] Defecto Reproducible: Entrada de solo espacios en blanco elude validación con isEmpty', () {
      // Simulación de la regla actual en BookingTab:
      // validator: (val) => val == null || val.isEmpty ? 'Requerido' : null
      String? reglaActual(String? val) => val == null || val.isEmpty ? 'Requerido' : null;

      // Regla robusta corregida:
      // validator: (val) => val == null || val.trim().isEmpty ? 'Requerido' : null
      String? reglaCorregida(String? val) => val == null || val.trim().isEmpty ? 'Requerido' : null;

      const entradaConSoloEspacios = '     ';

      // DEMOSTRACIÓN DEL FALLO:
      // La regla actual evalúa "     ".isEmpty como FALSE y permite que continúe el formulario
      expect(reglaActual(entradaConSoloEspacios), isNull,
          reason: 'DEFECTO CONFIRMADO: La regla actual no detecta espacios en blanco y retorna null (válido)');

      // La regla corregida sí detecta el valor no representativo y exige el campo
      expect(reglaCorregida(entradaConSoloEspacios), 'Requerido',
          reason: 'La regla corregida rechaza strings de solo espacios como inválidos');
    });
  });
}

