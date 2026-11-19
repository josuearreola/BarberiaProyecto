import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:phone_app/models/appointment_model.dart';
import 'package:phone_app/providers/client_provider.dart';
import 'package:phone_app/services/api_service.dart';
import 'package:phone_app/services/local_db_service.dart';

class FakeLocalDb extends LocalDbService {
  List<AppointmentModel> cached = [];
  int saveCount = 0;

  FakeLocalDb([List<AppointmentModel>? initial]) : super.forTesting() {
    if (initial != null) cached = List.from(initial);
  }

  @override
  Future<void> saveAppointments(List<AppointmentModel> appointments) async {
    saveCount++;
    cached = List.from(appointments);
  }

  @override
  Future<List<AppointmentModel>> getCachedAppointments() async {
    return List.from(cached);
  }

  @override
  Future<void> clearAppointmentsCache() async {
    cached.clear();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final sampleAppt = AppointmentModel(
    id: 501,
    nombreCompleto: 'Cliente Cacheado',
    telefono: '4491234567',
    correo: 'cache@test.com',
    servicio: 'Corte Clasico',
    fechaCita: '2026-12-01',
    horaCita: '10:00',
    estado: 'pendiente',
  );

  test('RES-01: Perdida de Internet durante consulta -> error controlado y fallback a SQLite local', () async {
    int attempts = 0;
    final mockClient = MockClient((request) async {
      attempts++;
      throw const SocketException('Network is unreachable');
    });

    final api = ApiService(
      client: mockClient,
      tokenReader: () async => 'jwt-demo',
      retryDelays: const [Duration(milliseconds: 5), Duration(milliseconds: 10)],
    );
    final provider = ClientProvider(apiService: api, localDb: FakeLocalDb([sampleAppt]));

    final sw = Stopwatch()..start();
    await provider.fetchMyAppointments();
    sw.stop();

    expect(attempts, 3); // 1 intento inicial + 2 reintentos exponenciales
    expect(provider.myAppointments.length, 1);
    expect(provider.myAppointments.first.id, 501);
    expect(provider.isLoading, false);
    // Verifica también rama sin caché -> mensaje controlado de modo sin conexión
    final providerNoCache = ClientProvider(apiService: api, localDb: FakeLocalDb());
    await providerNoCache.fetchMyAppointments();
    expect(providerNoCache.error.toLowerCase(), contains('sin conexión'));
    // ignore: avoid_print
    print('P12_RES_01={"attempts":$attempts,"elapsedMs":${sw.elapsedMilliseconds},"fallbackCount":${provider.myAppointments.length},"noCacheError":"${providerNoCache.error}"}');
  });

  test('RES-02: Perdida de Internet durante escritura -> no confirma falsamente el registro', () async {
    int attempts = 0;
    final mockClient = MockClient((request) async {
      attempts++;
      throw const SocketException('Connection reset by peer');
    });

    final api = ApiService(
      client: mockClient,
      tokenReader: () async => 'jwt-demo',
      retryDelays: const [Duration(milliseconds: 5), Duration(milliseconds: 10)],
    );
    final provider = ClientProvider(apiService: api, localDb: FakeLocalDb());

    final ok = await provider.createAppointment(
      nombreCompleto: 'Juan Perez',
      telefono: '4491112233',
      correo: 'juan@test.com',
      servicio: 'Corte',
      fechaCita: '2026-12-20',
      horaCita: '11:00',
    );

    expect(ok, false);
    expect(attempts, 3);
    expect(provider.myAppointments, isEmpty);
    expect(provider.error.toLowerCase(), contains('error de conexión'));
    expect(provider.isSubmitting, false);
    // ignore: avoid_print
    print('P12_RES_02={"ok":$ok,"attempts":$attempts,"error":"${provider.error}"}');
  });

  test('RES-03: Servidor sin respuesta -> timeout controlado sin colgar interfaz', () async {
    final mockClient = MockClient((request) async {
      await Future.delayed(const Duration(milliseconds: 300));
      return http.Response('[]', 200);
    });

    final api = ApiService(
      client: mockClient,
      tokenReader: () async => 'jwt-demo',
      requestTimeout: const Duration(milliseconds: 50),
      retryDelays: const [Duration(milliseconds: 5)],
    );
    final provider = ClientProvider(apiService: api, localDb: FakeLocalDb());

    final sw = Stopwatch()..start();
    await provider.fetchMyAppointments();
    sw.stop();

    expect(provider.error.toLowerCase(), contains('tiempo de espera agotado'));
    expect(provider.isLoading, false);
    expect(sw.elapsedMilliseconds, lessThan(250));
    // ignore: avoid_print
    print('P12_RES_03={"elapsedMs":${sw.elapsedMilliseconds},"timeoutConfiguredMs":50,"error":"${provider.error}"}');
  });

  test('RES-04: Respuesta HTTP 500 -> muestra error y conserva estabilidad', () async {
    final mockClient = MockClient((request) async {
      return http.Response(jsonEncode({'message': 'Internal Server Error'}), 500);
    });

    final api = ApiService(
      client: mockClient,
      tokenReader: () async => 'jwt-demo',
      retryDelays: const [Duration(milliseconds: 5)],
    );
    final provider = ClientProvider(apiService: api, localDb: FakeLocalDb());

    await provider.fetchMyAppointments();

    expect(provider.myAppointments, isEmpty);
    expect(provider.error, contains('500'));
    expect(provider.isLoading, false);
    // ignore: avoid_print
    print('P12_RES_04={"error":"${provider.error}","stableState":true}');
  });

  test('RES-05: Respuesta HTTP 401/403 -> sin reintentos inutiles, activa bandera de reautenticacion', () async {
    int attempts = 0;
    bool unauthorizedCallbackTriggered = false;
    final mockClient = MockClient((request) async {
      attempts++;
      return http.Response(jsonEncode({'message': 'Unauthorized'}), 401);
    });

    final api = ApiService(
      client: mockClient,
      tokenReader: () async => 'expired-token',
      retryDelays: const [Duration(milliseconds: 10), Duration(milliseconds: 20)],
      onUnauthorized: () => unauthorizedCallbackTriggered = true,
    );
    final provider = ClientProvider(apiService: api, localDb: FakeLocalDb([sampleAppt]));

    await provider.fetchMyAppointments();

    expect(attempts, 1); // 401 no debe reintentarse
    expect(unauthorizedCallbackTriggered, true);
    expect(provider.requiresReauth, true);
    expect(provider.error, contains('401'));
    // ignore: avoid_print
    print('P12_RES_05={"attempts":$attempts,"requiresReauth":${provider.requiresReauth},"callback":$unauthorizedCallbackTriggered}');
  });

  test('RES-06: Recuperacion de conexion tras fallos transitorios mediante exponential backoff', () async {
    int attempts = 0;
    final List<DateTime> timestamps = [];

    final mockClient = MockClient((request) async {
      attempts++;
      timestamps.add(DateTime.now());
      if (attempts <= 2) {
        throw const SocketException('Temporary network drop');
      }
      return http.Response(jsonEncode([sampleAppt.toMap()]), 200);
    });

    final api = ApiService(
      client: mockClient,
      tokenReader: () async => 'jwt-demo',
      retryDelays: const [Duration(milliseconds: 20), Duration(milliseconds: 60), Duration(milliseconds: 140)],
    );
    final provider = ClientProvider(apiService: api, localDb: FakeLocalDb());

    await provider.fetchMyAppointments();

    final gap1 = timestamps[1].difference(timestamps[0]).inMilliseconds;
    final gap2 = timestamps[2].difference(timestamps[1]).inMilliseconds;

    expect(attempts, 3);
    expect(provider.error, isEmpty);
    expect(provider.myAppointments.length, 1);
    expect(gap2, greaterThanOrEqualTo(gap1));
    // ignore: avoid_print
    print('P12_RES_06={"attemptsToRecover":$attempts,"backoffGap1Ms":$gap1,"backoffGap2Ms":$gap2,"recoveredItems":${provider.myAppointments.length}}');
  });

  test('RES-07: Reintento de escritura conserva Idempotency-Key y servidor evita registros duplicados', () async {
    final Map<String, Map<String, dynamic>> serverIdempotencyStore = {};
    final List<Map<String, dynamic>> persistedDb = [];
    int attemptCount = 0;

    final mockClient = MockClient((request) async {
      attemptCount++;
      final idemKey = request.headers['Idempotency-Key'] ?? '';
      expect(idemKey, isNotEmpty);

      if (attemptCount == 1) {
        // Simular que el servidor YA guardó el registro, pero la respuesta se perdió en red (Timeout/Drop)
        final created = {
          'id': 8801,
          ...jsonDecode(request.body) as Map<String, dynamic>,
          'estado': 'pendiente',
        };
        persistedDb.add(created);
        serverIdempotencyStore[idemKey] = created;
        throw const SocketException('Connection dropped after commit');
      }

      // En el reintento automático con el MISMO Idempotency-Key, el backend retorna la cita ya creada sin duplicar
      return http.Response(jsonEncode(serverIdempotencyStore[idemKey]), 201);
    });

    final api = ApiService(
      client: mockClient,
      tokenReader: () async => 'jwt-demo',
      retryDelays: const [Duration(milliseconds: 10), Duration(milliseconds: 30)],
    );
    final provider = ClientProvider(apiService: api, localDb: FakeLocalDb());

    final ok = await provider.createAppointment(
      nombreCompleto: 'Carlos Lopez',
      telefono: '4490001122',
      correo: 'carlos@test.com',
      servicio: 'Barba',
      fechaCita: '2026-12-22',
      horaCita: '15:00',
      idempotencyKey: 'idem-carlos-20261222-1500',
    );

    expect(ok, true);
    expect(attemptCount, 2);
    expect(persistedDb.length, 1); // CERO duplicados en BD pese al fallo tras commit
    expect(provider.myAppointments.length, 1);
    expect(provider.myAppointments.first.id, 8801);
    // ignore: avoid_print
    print('P12_RES_07={"attempts":$attemptCount,"dbRecordsCreated":${persistedDb.length},"clientConfirmed":$ok}');
  });

  test('RES-08: Respuesta tardia y doble toque concurrente no duplican ni corrompen el estado', () async {
    int postCalls = 0;
    final mockClient = MockClient((request) async {
      if (request.method == 'POST') {
        postCalls++;
        await Future.delayed(const Duration(milliseconds: 60));
        return http.Response(
          jsonEncode({
            'id': 9901,
            ...jsonDecode(request.body) as Map<String, dynamic>,
            'estado': 'pendiente',
          }),
          201,
        );
      }
      // Para probar respuestas tardías de GET: la primera tarda 80ms con dato obsoleto y la segunda tarda 10ms con dato fresco
      if (request.method == 'GET') {
        if (request.headers['x-seq'] == 'old') {
          await Future.delayed(const Duration(milliseconds: 80));
        }
        return http.Response('[]', 200);
      }
      return http.Response('{}', 200);
    });

    final api = ApiService(
      client: mockClient,
      tokenReader: () async => 'jwt-demo',
      retryDelays: const [],
    );
    final provider = ClientProvider(apiService: api, localDb: FakeLocalDb());

    // 1. Doble toque simultáneo sobre createAppointment -> solo debe enviarse 1 POST
    final f1 = provider.createAppointment(
      nombreCompleto: 'Ana Ruiz',
      telefono: '4493334455',
      correo: 'ana@test.com',
      servicio: 'Corte',
      fechaCita: '2026-12-23',
      horaCita: '16:00',
    );
    final f2 = provider.createAppointment(
      nombreCompleto: 'Ana Ruiz',
      telefono: '4493334455',
      correo: 'ana@test.com',
      servicio: 'Corte',
      fechaCita: '2026-12-23',
      horaCita: '16:00',
    );

    final results = await Future.wait([f1, f2]);
    expect(results[0], true);
    expect(results[1], false);
    expect(postCalls, 1);

    // 2. Descarte de respuesta tardía en lecturas concurrentes (_fetchSequence guard)
    int seqTestCalls = 0;
    final raceClient = MockClient((req) async {
      seqTestCalls++;
      if (seqTestCalls == 1) {
        await Future.delayed(const Duration(milliseconds: 80));
        return http.Response(jsonEncode([sampleAppt.toMap()]), 200); // Respuesta vieja y tardía
      }
      await Future.delayed(const Duration(milliseconds: 10));
      return http.Response(jsonEncode([
        {...sampleAppt.toMap(), 'id': 777, 'estado': 'confirmada'}
      ]), 200); // Respuesta más reciente
    });
    final providerRace = ClientProvider(
      apiService: ApiService(client: raceClient, tokenReader: () async => 'jwt', retryDelays: const []),
      localDb: FakeLocalDb(),
    );
    await Future.wait([
      providerRace.fetchMyAppointments(),
      providerRace.fetchMyAppointments(),
    ]);

    expect(providerRace.myAppointments.length, 1);
    expect(providerRace.myAppointments.first.id, 777); // Nunca fue sobrescrito por la respuesta tardía 501
    // ignore: avoid_print
    print('P12_RES_08={"doubleTapPostsSent":$postCalls,"lateResponseIgnored":true,"finalId":${providerRace.myAppointments.first.id}}');
  });
}
