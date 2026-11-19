// ignore_for_file: uri_does_not_exist, undefined_class, undefined_function, undefined_identifier, invalid_override, unnecessary_import, deprecated_member_use
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:phone_app/models/appointment_model.dart';
import 'package:phone_app/models/report_model.dart';
import 'package:phone_app/providers/client_provider.dart';
import 'package:phone_app/services/api_service.dart';
import 'package:phone_app/services/local_db_service.dart';
import 'package:phone_app/services/reports_repository.dart';

/// Doble de prueba (Fake) de ApiService para evaluar todos los caminos
/// de control (Statement, Branch, Condition, Valores Límite y Excepciones).
class WhiteboxFakeApiService extends ApiService {
  http.Response Function(String endpoint)? getHandler;
  http.Response Function(String endpoint, Map<String, dynamic> body)? postHandler;
  http.Response Function(String endpoint, Map<String, dynamic> body)? patchHandler;

  @override
  Future<http.Response> get(String endpoint) async {
    if (getHandler != null) return getHandler!(endpoint);
    return http.Response('[]', 200);
  }

  @override
  Future<http.Response> post(String endpoint, Map<String, dynamic> body) async {
    if (postHandler != null) return postHandler!(endpoint, body);
    return http.Response('{"id": 1}', 201);
  }

  @override
  Future<http.Response> patch(String endpoint, Map<String, dynamic> body) async {
    if (patchHandler != null) return patchHandler!(endpoint, body);
    return http.Response('{"id": 1, "estado": "cancelada"}', 200);
  }
}

/// Doble de prueba (Fake) de LocalDbService en memoria para evaluar ramas de respaldo SQLite.
class WhiteboxFakeLocalDbService extends LocalDbService {
  WhiteboxFakeLocalDbService() : super.forTesting();

  final List<AppointmentModel> storage = [];

  @override
  Future<void> saveAppointments(List<AppointmentModel> appointments) async {
    storage
      ..clear()
      ..addAll(appointments);
  }

  @override
  Future<List<AppointmentModel>> getCachedAppointments() async {
    return List<AppointmentModel>.from(storage);
  }

  @override
  Future<void> clearAppointmentsCache() async {
    storage.clear();
  }
}

void main() {
  // ===========================================================================
  // MÉTODO CRÍTICO 1: VALIDACIÓN Y REGLAS DE INTEGRIDAD
  // Clase/Método: ReportsRepository.addReport (y ciclo completo de ReportsRepository)
  // ===========================================================================
  group('MÉTODO 1 (Validación): ReportsRepository.addReport y operaciones asociadas', () {
    late ReportsRepository repository;

    setUp(() {
      repository = ReportsRepository();
    });

    test('[WB-M1-C1] Camino 1 (Condición C1a=True): Rechaza equipo vacío o solo espacios (Valor Límite: 0 chars tras trim)', () async {
      final invalidReport = ReportModel(
        id: 'REP-001',
        equipo: '    ', // Solo espacios en blanco -> trim().isEmpty == true
        descripcion: 'Falla en motor de rasuradora',
        prioridad: 'Alta',
        fecha: '2026-11-11T10:00:00Z',
      );

      await expectLater(
        () => repository.addReport(invalidReport),
        throwsA(isA<ReportValidationException>()),
      );
      expect(repository.lastStatusMessage, contains('Error de validación'));
    });

    test('[WB-M1-C2] Camino 2 (Condición C1a=False, C1b=True): Rechaza descripción vacía con equipo en límite mínimo (1 char)', () async {
      final invalidReport = ReportModel(
        id: 'REP-002',
        equipo: 'A', // Valor límite: longitud mínima válida = 1 carácter
        descripcion: '', // Vacío -> C1b = true
        prioridad: 'Media',
        fecha: '2026-11-11T10:00:00Z',
      );

      await expectLater(
        () => repository.addReport(invalidReport),
        throwsA(isA<ReportValidationException>()),
      );
    });

    test('[WB-M1-C3] Camino 3 (Condición C2a=True, C2b=True): Lanza DuplicateReportException si ID existe y está activo', () async {
      final report = ReportModel(
        id: 'REP-DUP',
        equipo: 'Sillón Hidráulico 1',
        descripcion: 'Palanca trabada',
        prioridad: 'Media',
        fecha: '2026-11-11T10:00:00Z',
        estado: 'activo',
      );

      await repository.addReport(report, isOnline: true);

      await expectLater(
        () => repository.addReport(report, isOnline: true),
        throwsA(isA<DuplicateReportException>()),
      );
      expect(repository.lastStatusMessage, contains('Conflicto: Ya existe un reporte con ID REP-DUP'));
    });

    test('[WB-M1-C4] Camino 4 (Condición C2a=True, C2b=False, D3=True): Permite re-registrar ID si estado previo era eliminado (Online)', () async {
      final initial = ReportModel(
        id: 'REP-REUSE',
        equipo: 'Esterilizador UV',
        descripcion: 'Foco fundido',
        prioridad: 'Baja',
        fecha: '2026-11-11T09:00:00Z',
        estado: 'activo',
      );

      final repoWithSeed = ReportsRepository(initialSeed: {'REP-REUSE': initial});
      final deleted = await repoWithSeed.deleteReport('REP-REUSE');
      expect(deleted, isTrue);
      expect(await repoWithSeed.getReportById('REP-REUSE'), isNull);

      // Ahora C2a (_memoryStore.containsKey) es True, pero C2b (estado != 'eliminado') es False
      final recreated = await repoWithSeed.addReport(initial, isOnline: true);
      expect(recreated.sincronizado, isTrue);
      expect(repoWithSeed.lastStatusMessage, contains('sincronizado con Neon Cloud'));
    });

    test('[WB-M1-C5] Camino 5 (Condición C2a=False, D3=False): Registro válido en modo Offline (sincronizado = false)', () async {
      final offlineReport = ReportModel(
        id: 'REP-OFFLINE',
        equipo: 'Secadora Profesional',
        descripcion: 'Cable con falso contacto',
        prioridad: 'Alta',
        fecha: '2026-11-11T11:00:00Z',
      );

      final saved = await repository.addReport(offlineReport, isOnline: false);
      expect(saved.sincronizado, isFalse);
      expect(repository.lastStatusMessage, contains('guardado localmente'));

      // Cubrir métodos complementarios de ReportsRepository y ReportModel
      final fetched = await repository.getReportById('REP-OFFLINE');
      expect(fetched, isNotNull);
      expect(await repository.getReportById('ID-INEXISTENTE'), isNull);
      expect(await repository.updatePriority('ID-INEXISTENTE', 'Alta'), isNull);

      final updated = await repository.updatePriority('REP-OFFLINE', 'Urgente');
      expect(updated?.prioridad, 'Urgente');
      expect(await repository.deleteReport('ID-INEXISTENTE'), isFalse);

      await repository.restartApp();
      expect(repository.getAllActiveReports().length, 1);
    });
  });

  // ===========================================================================
  // MÉTODO CRÍTICO 2: PROCESAMIENTO, NORMALIZACIÓN Y DETECCIÓN DE TRANSICIONES
  // Clase/Método: ClientProvider.fetchMyAppointments + AppointmentModel.fromJson
  // ===========================================================================
  group('MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments y AppointmentModel', () {
    late WhiteboxFakeApiService fakeApi;
    late WhiteboxFakeLocalDbService fakeDb;
    late ClientProvider provider;

    setUp(() {
      fakeApi = WhiteboxFakeApiService();
      fakeDb = WhiteboxFakeLocalDbService();
      provider = ClientProvider(apiService: fakeApi, localDb: fakeDb);
    });

    test('[WB-M2-C1] Camino 1: Primera carga exitosa (HTTP 200, silent=false, _previousStatuses vacío)', () async {
      fakeApi.getHandler = (_) => http.Response(
            jsonEncode([
              {
                'id': 10,
                'nombre_completo': 'Josué Cliente',
                'telefono': '4421112233',
                'servicio': 'Corte Clásico',
                'fecha_cita': '2026-11-20',
                'hora_cita': '10:00',
                'estado': 'pendiente',
              }
            ]),
            200,
          );

      await provider.fetchMyAppointments(silent: false);
      expect(provider.myAppointments.length, 1);
      expect(provider.myAppointments.first.nombreCompleto, 'Josué Cliente');
      expect(provider.error, isEmpty);
      expect(fakeDb.storage.length, 1);
    });

    test('[WB-M2-C2] Camino 2: Segunda carga con silent=true, transición de estado real vs cosmética y cita nueva', () async {
      // 1ra carga: semilla con cita 10 en 'pendiente' y cita 11 en 'pendiente'
      fakeApi.getHandler = (_) => http.Response(
            jsonEncode([
              {'id': 10, 'nombreCompleto': 'Cliente A', 'telefono': '111', 'servicio': 'Corte', 'fechaCita': '2026-11-20', 'horaCita': '10:00', 'estado': 'pendiente'},
              {'id': 11, 'nombreCompleto': 'Cliente B', 'telefono': '222', 'servicio': 'Barba', 'fechaCita': '2026-11-20', 'horaCita': '11:00', 'estado': 'pendiente'},
            ]),
            200,
          );
      await provider.fetchMyAppointments(silent: false);

      final List<String> transitions = [];
      provider.onStatusChanged = (appt, oldS, newS) {
        transitions.add('${appt.id}:$oldS->$newS');
      };

      // 2da carga (silent=true):
      // - Cita 10: ' PENDIENTE ' (cambio cosmético -> C4a=True, C4b=False)
      // - Cita 11: 'confirmada' (cambio real -> C4a=True, C4b=True)
      // - Cita 12: nueva cita (oldStatus == null -> C4a=False)
      fakeApi.getHandler = (_) => http.Response(
            jsonEncode([
              {'id': 10, 'nombreCompleto': 'Cliente A', 'telefono': '111', 'servicio': 'Corte', 'fechaCita': '2026-11-20', 'horaCita': '10:00', 'estado': ' PENDIENTE '},
              {'id': 11, 'nombreCompleto': 'Cliente B', 'telefono': '222', 'servicio': 'Barba', 'fechaCita': '2026-11-20', 'horaCita': '11:00', 'estado': 'confirmada'},
              {'id': 12, 'nombreCompleto': 'Cliente C', 'telefono': '333', 'servicio': 'Tinte', 'fechaCita': '2026-11-20', 'horaCita': '12:00'},
            ]),
            200,
          );

      await provider.fetchMyAppointments(silent: true);
      expect(transitions, ['11:pendiente->confirmada']);
      expect(provider.myAppointments.last.estado, 'pendiente'); // valor por defecto en fromJson
      expect(provider.myAppointments.last.toMap()['id'], 12);
    });

    test('[WB-M2-C3] Camino 3: Respuesta HTTP != 200 con caché SQLite disponible (D2=False, D5=True)', () async {
      await fakeDb.saveAppointments([
        AppointmentModel(
          id: 99,
          nombreCompleto: 'Respaldo Local',
          telefono: '4420000000',
          servicio: 'Corte Clásico',
          fechaCita: '2026-11-21',
          horaCita: '13:00',
          estado: 'confirmada',
        ),
      ]);

      fakeApi.getHandler = (_) => http.Response('Internal Server Error', 500);
      await provider.fetchMyAppointments();

      expect(provider.myAppointments.length, 1);
      expect(provider.myAppointments.first.id, 99);
      expect(provider.error, isEmpty);
    });

    test('[WB-M2-C4] Camino 4: Respuesta HTTP != 200 sin caché SQLite (D2=False, D5=False)', () async {
      fakeApi.getHandler = (_) => http.Response('Forbidden', 403);
      await provider.fetchMyAppointments();

      expect(provider.myAppointments, isEmpty);
      expect(provider.error, 'Error al cargar tus citas: 403');
    });

    test('[WB-M2-C5] Camino 5: Excepción de red (SocketException) con caché SQLite disponible (Catch -> D6=True)', () async {
      await fakeDb.saveAppointments([
        AppointmentModel(
          id: 77,
          nombreCompleto: 'Cita Offline',
          telefono: '4429998877',
          servicio: 'Paquete Completo',
          fechaCita: '2026-11-22',
          horaCita: '16:00',
          estado: 'pendiente',
        ),
      ]);

      fakeApi.getHandler = (_) => throw const SocketException('Network unreachable');
      await provider.fetchMyAppointments();

      expect(provider.myAppointments.length, 1);
      expect(provider.myAppointments.first.id, 77);
      expect(provider.error, isEmpty);
    });

    test('[WB-M2-C6] Camino 6: Excepción de red (SocketException) sin caché SQLite (Catch -> D6=False)', () async {
      fakeApi.getHandler = (_) => throw const SocketException('Connection refused');
      await provider.fetchMyAppointments();

      expect(provider.myAppointments, isEmpty);
      expect(provider.error, 'Modo sin conexión. No hay citas en caché local.');
    });
  });

  // ===========================================================================
  // MÉTODO CRÍTICO 3: COMUNICACIÓN CON SERVICIO API Y MANEJO DE ESTADOS HTTP
  // Clase/Método: ClientProvider.createAppointment (+ cancelMyAppointment y audio)
  // ===========================================================================
  group('MÉTODO 3 (Comunicación): ClientProvider.createAppointment y operaciones HTTP', () {
    late WhiteboxFakeApiService fakeApi;
    late WhiteboxFakeLocalDbService fakeDb;
    late ClientProvider provider;

    setUp(() {
      fakeApi = WhiteboxFakeApiService();
      fakeDb = WhiteboxFakeLocalDbService();
      provider = ClientProvider(apiService: fakeApi, localDb: fakeDb);
    });

    test('[WB-M3-C1] Camino 1: Creación exitosa HTTP 201 con notas no vacías (D1=True, C2a=True)', () async {
      Map<String, dynamic>? sentBody;
      fakeApi.postHandler = (endpoint, body) {
        sentBody = body;
        return http.Response(jsonEncode({'id': 501}), 201);
      };

      final ok = await provider.createAppointment(
        nombreCompleto: 'Cliente Uno',
        telefono: '4421234567',
        correo: 'uno@barberia.com',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-25',
        horaCita: '10:00',
        notas: 'uploads/audio/nota_1.m4a',
      );

      expect(ok, isTrue);
      expect(sentBody?['notas'], 'uploads/audio/nota_1.m4a');
      expect(provider.error, isEmpty);
    });

    test('[WB-M3-C2] Camino 2: Creación exitosa HTTP 200 con notas vacías (D1=False por isEmpty, C2b=True)', () async {
      Map<String, dynamic>? sentBody;
      fakeApi.postHandler = (endpoint, body) {
        sentBody = body;
        return http.Response(jsonEncode({'id': 502}), 200);
      };

      final ok = await provider.createAppointment(
        nombreCompleto: 'Cliente Dos',
        telefono: '4421234567',
        correo: 'dos@barberia.com',
        servicio: 'Perfilado de Barba',
        fechaCita: '2026-11-25',
        horaCita: '11:00',
        notas: '', // C1a=True (not null), C1b=False (isEmpty) -> no se incluye 'notas'
      );

      expect(ok, isTrue);
      expect(sentBody?.containsKey('notas'), isFalse);
    });

    test('[WB-M3-C3] Camino 3: Colisión de horario HTTP 409 con mensaje JSON del servidor (D3=True, D3a=True)', () async {
      fakeApi.postHandler = (_, _) => http.Response(
            jsonEncode({'statusCode': 409, 'message': 'La hora seleccionada ya esta ocupada'}),
            409,
          );

      final ok = await provider.createAppointment(
        nombreCompleto: 'Cliente Tres',
        telefono: '4421234567',
        correo: 'tres@barberia.com',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-25',
        horaCita: '10:00',
      );

      expect(ok, isFalse);
      expect(provider.error, 'La hora seleccionada ya esta ocupada');
    });

    test('[WB-M3-C4] Camino 4: Colisión HTTP 409 con JSON sin llave message (D3=True, D3a=False)', () async {
      fakeApi.postHandler = (_, _) => http.Response(jsonEncode({'statusCode': 409}), 409);

      final ok = await provider.createAppointment(
        nombreCompleto: 'Cliente Cuatro',
        telefono: '4421234567',
        correo: 'cuatro@barberia.com',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-25',
        horaCita: '10:00',
      );

      expect(ok, isFalse);
      expect(provider.error, contains('La hora seleccionada ya está ocupada'));
    });

    test('[WB-M3-C5] Camino 5: Error HTTP 400 con lista de errores de validación DTO (D4=True, D4a=True)', () async {
      fakeApi.postHandler = (_, _) => http.Response(
            jsonEncode({
              'statusCode': 400,
              'message': ['El correo electrónico no es válido', 'El teléfono es obligatorio']
            }),
            400,
          );

      final ok = await provider.createAppointment(
        nombreCompleto: 'Cliente Cinco',
        telefono: '',
        correo: 'invalido',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-25',
        horaCita: '10:00',
      );

      expect(ok, isFalse);
      expect(provider.error, 'El correo electrónico no es válido, El teléfono es obligatorio');
    });

    test('[WB-M3-C6] Camino 6: Error HTTP 400 con message tipo String simple y JSON sin message (D4a=False y D5)', () async {
      fakeApi.postHandler = (_, _) => http.Response(
            jsonEncode({'statusCode': 400, 'message': 'Solicitud mal estructurada'}),
            400,
          );

      final ok1 = await provider.createAppointment(
        nombreCompleto: 'Cliente Seis',
        telefono: '4421234567',
        correo: 'seis@barberia.com',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-25',
        horaCita: '10:00',
      );
      expect(ok1, isFalse);
      expect(provider.error, 'Solicitud mal estructurada');

      // Caso D5: JSON válido pero sin 'message'
      fakeApi.postHandler = (_, _) => http.Response(jsonEncode({'error': 'Bad Gateway'}), 502);
      final ok2 = await provider.createAppointment(
        nombreCompleto: 'Cliente Seis',
        telefono: '4421234567',
        correo: 'seis@barberia.com',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-25',
        horaCita: '10:00',
      );
      expect(ok2, isFalse);
      expect(provider.error, 'No se pudo crear la cita (502)');
    });

    test('[WB-M3-C7] Camino 7: Cuerpo de respuesta NO JSON en error 409 y 500 (Inner catch -> D6=True y D6=False)', () async {
      fakeApi.postHandler = (_, _) => http.Response('<html>409 Conflict</html>', 409);
      final ok409 = await provider.createAppointment(
        nombreCompleto: 'Cliente Siete',
        telefono: '4421234567',
        correo: 'siete@barberia.com',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-25',
        horaCita: '10:00',
      );
      expect(ok409, isFalse);
      expect(provider.error, 'La hora seleccionada ya está ocupada. Por favor elige otro horario.');

      fakeApi.postHandler = (_, _) => http.Response('<html>500 Internal Server Error</html>', 500);
      final ok500 = await provider.createAppointment(
        nombreCompleto: 'Cliente Siete',
        telefono: '4421234567',
        correo: 'siete@barberia.com',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-25',
        horaCita: '10:00',
      );
      expect(ok500, isFalse);
      expect(provider.error, 'Error al agendar cita en el servidor (500)');
    });

    test('[WB-M3-C8] Camino 8: Excepción de transporte SocketException en createAppointment, cancelMyAppointment y getAudioPresignedUrl', () async {
      fakeApi.postHandler = (_, _) => throw const SocketException('Host unreachable');
      final okCreate = await provider.createAppointment(
        nombreCompleto: 'Cliente Ocho',
        telefono: '4421234567',
        correo: 'ocho@barberia.com',
        servicio: 'Corte Clásico',
        fechaCita: '2026-11-25',
        horaCita: '10:00',
      );
      expect(okCreate, isFalse);
      expect(provider.error, 'Error de conexión con el servidor.');

      // cancelMyAppointment: rutas 200, !=200 y excepción
      fakeApi.patchHandler = (_, _) => http.Response('{"ok":true}', 200);
      expect(await provider.cancelMyAppointment(10), isTrue);

      fakeApi.patchHandler = (_, _) => http.Response('Conflict', 409);
      expect(await provider.cancelMyAppointment(10), isFalse);
      expect(provider.error, 'Error al cancelar la cita: 409');

      fakeApi.patchHandler = (_, _) => throw const SocketException('Timeout');
      expect(await provider.cancelMyAppointment(10), isFalse);
      expect(provider.error, contains('Error de conexión:'));

      // getAudioPresignedUrl: rutas 201, !=200 y excepción
      fakeApi.postHandler = (_, _) => http.Response('{"uploadUrl":"http://localhost/up"}', 201);
      final urlData = await provider.getAudioPresignedUrl(fileName: 'nota.m4a');
      expect(urlData?['uploadUrl'], 'http://localhost/up');

      fakeApi.postHandler = (_, _) => http.Response('Error', 500);
      expect(await provider.getAudioPresignedUrl(), isNull);

      fakeApi.postHandler = (_, _) => throw const SocketException('Disconnected');
      expect(await provider.getAudioPresignedUrl(), isNull);
    });
  });
}

