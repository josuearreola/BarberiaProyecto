// ignore_for_file: uri_does_not_exist, undefined_class, undefined_function, undefined_identifier, invalid_override, unnecessary_import, deprecated_member_use
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/io_client.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:phone_app/models/appointment_model.dart';
import 'package:phone_app/providers/client_provider.dart';
import 'package:phone_app/services/api_service.dart';
import 'package:phone_app/services/local_db_service.dart';

class _AllowRealHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context);
  }
}

class CountingLocalDb extends LocalDbService {
  int saveCalls = 0;
  int readCalls = 0;
  List<AppointmentModel> stored = [];

  CountingLocalDb() : super.forTesting();

  @override
  Future<void> saveAppointments(List<AppointmentModel> appointments) async {
    saveCalls++;
    stored = List<AppointmentModel>.from(appointments);
  }

  @override
  Future<List<AppointmentModel>> getCachedAppointments() async {
    readCalls++;
    return stored;
  }

  @override
  Future<void> clearAppointmentsCache() async {
    stored.clear();
  }
}

List<Map<String, dynamic>> buildDataset(int count) {
  return List.generate(count, (i) {
    final day = (i % 28 + 1).toString().padLeft(2, '0');
    final hour = (9 + (i % 9)).toString().padLeft(2, '0');
    return {
      'id': i + 1,
      'nombreCompleto': 'Cliente Prueba $i',
      'telefono': '449${(1000000 + i).toString()}',
      'correo': 'cliente$i@barberia.com',
      'servicio': i % 2 == 0 ? 'Corte Clasico' : 'Barba y Corte',
      'fechaCita': '2026-11-$day',
      'horaCita': '$hour:00',
      'estado': i % 3 == 0 ? 'pendiente' : 'confirmada',
      'notas': 'Nota extensa de prueba numero $i para medir deserializacion JSON y presion de memoria en lista',
      'nombreBarbero': 'Carlos Barber',
    };
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await initializeDateFormatting('es_ES', null);
  });

  test('Fase 6 Optimizado: Pooling HTTP Keep-Alive, Diffing SQLite/Notify, Isolate y cero GET redundante', () async {
    await HttpOverrides.runZoned(() async {
      final dataset100 = buildDataset(100);
      final payload100 = jsonEncode(dataset100);
      final dataset1500 = buildDataset(1500);
      final payload1500 = jsonEncode(dataset1500);

      int httpGetCount = 0;
      int httpPostCount = 0;
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest req) async {
        if (req.method == 'GET' && req.uri.path.endsWith('/mis-citas')) {
          httpGetCount++;
          req.response.statusCode = 200;
          req.response.headers.contentType = ContentType.json;
          req.response.write(payload100);
        } else if (req.method == 'POST' && req.uri.path.endsWith('/appointments')) {
          httpPostCount++;
          final bodyStr = await utf8.decoder.bind(req).join();
          final bodyMap = jsonDecode(bodyStr) as Map<String, dynamic>;
          req.response.statusCode = 201;
          req.response.headers.contentType = ContentType.json;
          req.response.write(jsonEncode({
            'id': 9000 + httpPostCount,
            ...bodyMap,
            'estado': 'pendiente',
          }));
        } else {
          req.response.statusCode = 404;
        }
        await req.response.close();
      });

      final startRssMb = ProcessInfo.currentRss / (1024 * 1024);

      // 1. Procesamiento pesado optimizado mediante Isolate secundario (compute)
      final swProc = Stopwatch()..start();
      int totalParsed = 0;
      for (int i = 0; i < 20; i++) {
        final models = await compute(parseAppointmentsJson, payload1500);
        totalParsed += models.length;
      }
      swProc.stop();
      final avgProcMs = swProc.elapsedMicroseconds / 1000.0 / 20.0;

      // 2. ClientProvider + ApiService optimizado (Keep-Alive IOClient + Diffing + Sin GET post-POST)
      final countingDb = CountingLocalDb();
      final persistentClient = IOClient(HttpClient()..idleTimeout = const Duration(seconds: 15));
      final apiService = ApiService(
        client: persistentClient,
        customBaseUrl: 'http://127.0.0.1:${server.port}',
        tokenReader: () async => 'mock-jwt-token',
      );
      final provider = ClientProvider(apiService: apiService, localDb: countingDb);

      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      // 50 consultas repetidas en modo silent (estado sin cambios -> 1 escritura SQLite y 1 notificación inicial)
      final swRead = Stopwatch()..start();
      for (int i = 0; i < 50; i++) {
        await provider.fetchMyAppointments(silent: true);
      }
      swRead.stop();

      final dbSavesAfterReads = countingDb.saveCalls;
      final notifiesAfterReads = notifyCount;

      // 20 escrituras createAppointment optimizadas (no hace GET redundante tras cada POST)
      final swWrite = Stopwatch()..start();
      for (int i = 0; i < 20; i++) {
        final ok = await provider.createAppointment(
          nombreCompleto: 'Test Write $i',
          telefono: '4491112233',
          correo: 'test@barberia.com',
          servicio: 'Corte',
          fechaCita: '2026-12-20',
          horaCita: '10:$i',
        );
        expect(ok, true);
      }
      swWrite.stop();

      final peakRssMb = ProcessInfo.maxRss / (1024 * 1024);
      final endRssMb = ProcessInfo.currentRss / (1024 * 1024);
      persistentClient.close();
      await server.close(force: true);

      final summary = {
        'phase': 'Fase 6 Optimized (Keep-Alive + Diffing + Optimistic Create + Isolate)',
        'heavyProcessing1500AvgMs': double.parse(avgProcMs.toStringAsFixed(2)),
        'heavyProcessingTotalParsed': totalParsed,
        'repeatedRead50TotalMs': double.parse((swRead.elapsedMicroseconds / 1000.0).toStringAsFixed(2)),
        'repeatedReadAvgMs': double.parse(((swRead.elapsedMicroseconds / 1000.0) / 50.0).toStringAsFixed(2)),
        'repeatedNotifyCount': notifiesAfterReads,
        'repeatedDbSaveCalls': dbSavesAfterReads,
        'write20TotalMs': double.parse((swWrite.elapsedMicroseconds / 1000.0).toStringAsFixed(2)),
        'write20AvgMs': double.parse(((swWrite.elapsedMicroseconds / 1000.0) / 20.0).toStringAsFixed(2)),
        'httpGetServed': httpGetCount,
        'httpPostServed': httpPostCount,
        'totalHttpCallsFor20WritesAnd50Reads': httpGetCount + httpPostCount,
        'ramStartMb': double.parse(startRssMb.toStringAsFixed(2)),
        'ramPeakMb': double.parse(peakRssMb.toStringAsFixed(2)),
        'ramEndMb': double.parse(endRssMb.toStringAsFixed(2)),
      };
      // ignore: avoid_print
      print('P12_OPTIMIZED_FLUTTER=${jsonEncode(summary)}');
      expect(httpGetCount, 50); // Bajó de 70 a 50 (-20 GET redundantes)
      expect(httpPostCount, 20);
      expect(dbSavesAfterReads, 1); // Bajó de 50 escrituras SQLite en lecturas a 1 sola!
      expect(notifiesAfterReads, 1); // Bajó de 50 rebuilds UI a 1 solo!
    }, createHttpClient: (_) => _AllowRealHttpOverrides().createHttpClient(null));
  });

  testWidgets('Fase 6 Optimized Navigation: Reutilizacion de tabs con IndexedStack sin reconstruccion completa', (tester) async {
    final items = buildDataset(120);
    int buildCounter = 0;
    final List<double> frameMs = [];
    final swNav = Stopwatch()..start();

    Widget buildTab(int idx) {
      return ListView.builder(
        key: PageStorageKey('tab_$idx'),
        itemCount: items.length,
        itemBuilder: (_, i) => ListTile(
          title: Text(items[i]['nombreCompleto'] as String),
          subtitle: Text('${items[i]['fechaCita']} ${items[i]['horaCita']}'),
        ),
      );
    }

    int activeTab = 0;
    late StateSetter setModalState;
    await tester.pumpWidget(
      MaterialApp(
        home: StatefulBuilder(
          builder: (context, setState) {
            setModalState = setState;
            buildCounter++;
            return Scaffold(
              appBar: AppBar(title: Text('Tab $activeTab')),
              body: IndexedStack(
                index: activeTab,
                children: [buildTab(0), buildTab(1), buildTab(2)],
              ),
            );
          },
        ),
      ),
    );

    for (int i = 1; i < 15; i++) {
      final fSw = Stopwatch()..start();
      setModalState(() => activeTab = i % 3);
      await tester.pump();
      fSw.stop();
      frameMs.add(fSw.elapsedMicroseconds / 1000.0);
    }
    swNav.stop();

    final maxFrame = frameMs.reduce((a, b) => a > b ? a : b);
    final avgFrame = frameMs.reduce((a, b) => a + b) / frameMs.length;
    final jankFrames = frameMs.where((m) => m > 16.67).length;

    // ignore: avoid_print
    print('P12_OPTIMIZED_NAV=${jsonEncode({
      'switches': 15,
      'buildCounter': buildCounter,
      'totalMs': double.parse((swNav.elapsedMicroseconds / 1000.0).toStringAsFixed(2)),
      'avgFrameMs': double.parse(avgFrame.toStringAsFixed(2)),
      'maxFrameMs': double.parse(maxFrame.toStringAsFixed(2)),
      'jankFramesOver16_67ms': jankFrames,
    })}');
    expect(maxFrame, lessThan(150.0));
  });
}
