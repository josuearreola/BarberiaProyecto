// ignore_for_file: uri_does_not_exist, undefined_class, undefined_function, undefined_identifier, invalid_override, unnecessary_import, deprecated_member_use
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:intl/date_symbol_data_local.dart';
import 'package:phone_app/models/appointment_model.dart';
import 'package:phone_app/providers/client_provider.dart';
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

  const secureStorageChannel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
    secureStorageChannel,
    (MethodCall call) async {
      if (call.method == 'read') return 'mock-jwt-token';
      return null;
    },
  );

  setUpAll(() async {
    await initializeDateFormatting('es_ES', null);
  });

  test('Fase 2 Baseline: Profiling CPU/RAM, consultas repetidas, HTTP unpooled y procesamiento', () async {
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

      // 1. Procesamiento pesado síncrono en isolate principal (1500 citas x 20 iteraciones)
      final swProc = Stopwatch()..start();
      int totalParsed = 0;
      for (int i = 0; i < 20; i++) {
        final raw = jsonDecode(payload1500) as List<dynamic>;
        final models = raw.map((e) => AppointmentModel.fromJson(e as Map<String, dynamic>)).toList();
        models.sort((a, b) => b.fechaCita.compareTo(a.fechaCita));
        totalParsed += models.length;
      }
      swProc.stop();
      final avgProcMs = swProc.elapsedMicroseconds / 1000.0 / 20.0;

      // 2. Patrón BASELINE de fetchMyAppointments (50 consultas idénticas: http.get nuevo socket + SQLite save + notify)
      final countingDb = CountingLocalDb();
      final provider = ClientProvider(localDb: countingDb);
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      final swRead = Stopwatch()..start();
      for (int i = 0; i < 50; i++) {
        // Simula exactamente ApiService.get actual: top-level http.get crea/cierra Client en cada llamada
        final resp = await http.get(Uri.parse('http://127.0.0.1:${server.port}/appointments/mis-citas'));
        if (resp.statusCode == 200) {
          final raw = jsonDecode(resp.body) as List<dynamic>;
          final models = raw.map((e) => AppointmentModel.fromJson(e as Map<String, dynamic>)).toList();
          await countingDb.saveAppointments(models);
          // ignore: invalid_use_of_protected_member, invalid_use_of_visible_for_testing_member
          provider.notifyListeners();
        }
      }
      swRead.stop();

      // 3. Patrón BASELINE de escritura (20 POST + 20 GET redundantes como hace createAppointment actual)
      final swWrite = Stopwatch()..start();
      for (int i = 0; i < 20; i++) {
        final postResp = await http.post(
          Uri.parse('http://127.0.0.1:${server.port}/appointments'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'nombreCompleto': 'Test Write $i',
            'telefono': '4491112233',
            'correo': 'test@barberia.com',
            'servicio': 'Corte',
            'fechaCita': '2026-12-20',
            'horaCita': '10:00',
          }),
        );
        if (postResp.statusCode == 201) {
          // Baseline ClientProvider llama fetchMyAppointments() completo tras cada POST
          final getResp = await http.get(Uri.parse('http://127.0.0.1:${server.port}/appointments/mis-citas'));
          final raw = jsonDecode(getResp.body) as List<dynamic>;
          final models = raw.map((e) => AppointmentModel.fromJson(e as Map<String, dynamic>)).toList();
          await countingDb.saveAppointments(models);
        }
      }
      swWrite.stop();

      final peakRssMb = ProcessInfo.maxRss / (1024 * 1024);
      final endRssMb = ProcessInfo.currentRss / (1024 * 1024);
      await server.close(force: true);

      final summary = {
        'phase': 'Fase 2 Baseline (Unoptimized)',
        'payload100Bytes': payload100.length,
        'payload1500Bytes': payload1500.length,
        'heavyProcessing1500AvgMs': double.parse(avgProcMs.toStringAsFixed(2)),
        'heavyProcessingTotalParsed': totalParsed,
        'repeatedRead50TotalMs': double.parse((swRead.elapsedMicroseconds / 1000.0).toStringAsFixed(2)),
        'repeatedReadAvgMs': double.parse(((swRead.elapsedMicroseconds / 1000.0) / 50.0).toStringAsFixed(2)),
        'repeatedNotifyCount': notifyCount,
        'repeatedDbSaveCalls': countingDb.saveCalls,
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
      print('P12_BASELINE_FLUTTER=${jsonEncode(summary)}');
      expect(httpGetCount, 70);
      expect(httpPostCount, 20);
    }, createHttpClient: (_) => _AllowRealHttpOverrides().createHttpClient(null));
  });

  testWidgets('Fase 2 Baseline Navigation: Medicion de frame build y rebuilds entre pestanas', (tester) async {
    final swNav = Stopwatch()..start();
    int buildCounter = 0;
    final List<double> frameMs = [];

    Widget buildTabScreen(int index) {
      buildCounter++;
      final items = buildDataset(120);
      return MaterialApp(
        home: Scaffold(
          appBar: AppBar(title: Text('Tab $index')),
          body: ListView.builder(
            itemCount: items.length,
            itemBuilder: (_, i) => ListTile(
              title: Text(items[i]['nombreCompleto'] as String),
              subtitle: Text('${items[i]['fechaCita']} ${items[i]['horaCita']}'),
            ),
          ),
        ),
      );
    }

    for (int i = 0; i < 15; i++) {
      final fSw = Stopwatch()..start();
      await tester.pumpWidget(buildTabScreen(i % 3));
      fSw.stop();
      frameMs.add(fSw.elapsedMicroseconds / 1000.0);
    }
    swNav.stop();

    final maxFrame = frameMs.reduce((a, b) => a > b ? a : b);
    final avgFrame = frameMs.reduce((a, b) => a + b) / frameMs.length;
    final jankFrames = frameMs.where((m) => m > 16.67).length;

    // ignore: avoid_print
    print('P12_BASELINE_NAV=${jsonEncode({
      'switches': 15,
      'buildCounter': buildCounter,
      'totalMs': double.parse((swNav.elapsedMicroseconds / 1000.0).toStringAsFixed(2)),
      'avgFrameMs': double.parse(avgFrame.toStringAsFixed(2)),
      'maxFrameMs': double.parse(maxFrame.toStringAsFixed(2)),
      'jankFramesOver16_67ms': jankFrames,
    })}');
    expect(buildCounter, 15);
  });
}
