import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'package:phone_app/models/appointment_model.dart';
import 'package:phone_app/models/user_model.dart';
import 'package:phone_app/providers/auth_provider.dart';
import 'package:phone_app/providers/client_provider.dart';
import 'package:phone_app/screens/client/booking_tab.dart';
import 'package:phone_app/services/api_service.dart';
import 'package:phone_app/services/local_db_service.dart';

/// Permite conexiones HTTP reales a localhost en el entorno de pruebas de Flutter
class _RealHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context);
  }
}

/// Cliente HTTP real configurado para apuntar al servidor HTTP local
class LocalLoopbackApiService extends ApiService {
  final int port;
  LocalLoopbackApiService(this.port);

  @override
  Future<http.Response> post(String endpoint, Map<String, dynamic> body, {String? idempotencyKey}) async {
    final url = Uri.parse('http://127.0.0.1:$port$endpoint');
    return await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'x-app-client': 'barberia-smart-device',
      },
      body: jsonEncode(body),
    );
  }

  @override
  Future<http.Response> get(String endpoint) async {
    final url = Uri.parse('http://127.0.0.1:$port$endpoint');
    return await http.get(
      url,
      headers: {
        'Content-Type': 'application/json',
        'x-app-client': 'barberia-smart-device',
      },
    );
  }
}

/// Doble de ApiService para pruebas UI de integración controlada
class MockApiServiceForUI extends ApiService {
  int postCallCount = 0;
  http.Response Function(String endpoint, Map<String, dynamic> body)? postHandler;
  http.Response Function(String endpoint)? getHandler;

  @override
  Future<http.Response> post(String endpoint, Map<String, dynamic> body, {String? idempotencyKey}) async {
    postCallCount++;
    if (postHandler != null) return postHandler!(endpoint, body);
    return http.Response(jsonEncode({'id': 1}), 201);
  }

  @override
  Future<http.Response> get(String endpoint) async {
    if (getHandler != null) return getHandler!(endpoint);
    return http.Response('[]', 200);
  }
}

/// Almacenamiento local simple en memoria
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
    return List.from(_cache);
  }
}

/// AuthProvider con usuario pre-autenticado para permitir la carga de BookingTab
class FakeAuthProvider extends AuthProvider {
  @override
  UserModel? get user => UserModel(
        id: 1,
        usuario: 'Cliente Test',
        email: 'cliente@test.com',
        telefono: '5511223344',
        role: 'cliente',
        estado: 'activo',
      );
}

void main() {
  setUpAll(() async {
    HttpOverrides.global = _RealHttpOverrides();
    await initializeDateFormatting('es', null);
  });

  group('Fase 3: Pruebas de Integración entre Componentes Reales', () {
    // =========================================================================
    // INTEGRACIÓN REAL 1: Cliente HTTP / Provider <--> Servidor HTTP Local Real
    // =========================================================================
    group('Sub-Suite A: Integración Cliente HTTP y Servidor REST Real (Sockets TCP)', () {
      late HttpServer realServer;
      late LocalLoopbackApiService realApiClient;
      late ClientProvider clientProvider;

      tearDown(() async {
        await realServer.close(force: true);
      });

      test('[INT-01] Flujo Correcto: Comunicación TCP real, cabeceras x-app-client y respuesta 201 Created', () async {
        realServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
        final port = realServer.port;
        realApiClient = LocalLoopbackApiService(port);
        clientProvider = ClientProvider(
          apiService: realApiClient,
          localDb: InMemoryLocalDbService(),
        );

        realServer.listen((HttpRequest request) async {
          if (request.method == 'POST' && request.uri.path == '/appointments') {
            expect(request.headers.value('x-app-client'), 'barberia-smart-device');

            final bodyStr = await utf8.decodeStream(request);
            final bodyJson = jsonDecode(bodyStr);
            expect(bodyJson['nombreCompleto'], 'Integración Real');
            expect(bodyJson['servicio'], 'Corte Clásico');

            request.response
              ..statusCode = HttpStatus.created
              ..headers.contentType = ContentType.json
              ..write(jsonEncode({'id': 505, 'estado': 'pendiente'}))
              ..close();
          } else if (request.method == 'GET' && request.uri.path == '/appointments/mis-citas') {
            request.response
              ..statusCode = HttpStatus.ok
              ..headers.contentType = ContentType.json
              ..write(jsonEncode([
                {
                  'id': 505,
                  'nombreCompleto': 'Integración Real',
                  'telefono': '5599887766',
                  'servicio': 'Corte Clásico',
                  'fechaCita': '2026-11-05',
                  'horaCita': '10:00',
                  'estado': 'pendiente',
                }
              ]))
              ..close();
          }
        });

        final success = await clientProvider.createAppointment(
          nombreCompleto: 'Integración Real',
          telefono: '5599887766',
          correo: 'real@integration.test',
          servicio: 'Corte Clásico',
          fechaCita: '2026-11-05',
          horaCita: '10:00',
        );

        expect(success, isTrue, reason: 'La conexión TCP real y el handshake HTTP 201 deben resultar en éxito');
        expect(clientProvider.error, isEmpty);
        expect(clientProvider.myAppointments.length, 1);
      });

      test('[INT-02] Manejo de Error: Servidor HTTP real rechaza colisión de horario con HTTP 409 Conflict', () async {
        realServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
        final port = realServer.port;
        realApiClient = LocalLoopbackApiService(port);
        clientProvider = ClientProvider(
          apiService: realApiClient,
          localDb: InMemoryLocalDbService(),
        );

        realServer.listen((HttpRequest request) async {
          request.response
            ..statusCode = HttpStatus.conflict
            ..headers.contentType = ContentType.json
            ..write(jsonEncode({
              'statusCode': 409,
              'message': 'El turno seleccionado (10:00) ya se encuentra reservado por otro cliente.',
            }))
            ..close();
        });

        final success = await clientProvider.createAppointment(
          nombreCompleto: 'Cliente Colisión',
          telefono: '5511223344',
          correo: 'colision@real.test',
          servicio: 'Corte Clásico',
          fechaCita: '2026-11-05',
          horaCita: '10:00',
        );

        expect(success, isFalse, reason: 'HTTP 409 real debe ser interpretado como fallo');
        expect(clientProvider.error, contains('ya se encuentra reservado'));
      });
    });

    // =========================================================================
    // INTEGRACIÓN REAL 2: Widget BookingTab <--> ClientProvider <--> FormState
    // =========================================================================
    group('Sub-Suite B: Integración Formulario UI BookingTab y Gestor de Estado', () {
      Widget buildBookingScreen({required ClientProvider clientProvider, required AuthProvider authProvider}) {
        return MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
            ChangeNotifierProvider<ClientProvider>.value(value: clientProvider),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: BookingTab(),
            ),
          ),
        );
      }

      testWidgets('[INT-03] Validación de Entrada: Formulario real rechaza campos vacíos e impide envío', (WidgetTester tester) async {
        final authProvider = FakeAuthProvider();
        final clientProvider = ClientProvider(
          localDb: InMemoryLocalDbService(),
        );

        await tester.pumpWidget(buildBookingScreen(
          clientProvider: clientProvider,
          authProvider: authProvider,
        ));
        await tester.pumpAndSettle();

        final textFields = find.byType(TextFormField);
        expect(textFields, findsNWidgets(2));

        // Borrar nombre y teléfono
        await tester.enterText(textFields.at(0), '');
        await tester.enterText(textFields.at(1), '');
        await tester.pump();

        // Pulsar botón Confirmar Cita
        final confirmButton = find.text('Confirmar Cita');
        expect(confirmButton, findsOneWidget);
        await tester.ensureVisible(confirmButton);
        await tester.tap(confirmButton);
        await tester.pump();

        // Comprobar que los mensajes de error del FormState se desplegaron en la UI real
        expect(find.text('Requerido'), findsNWidgets(2),
            reason: 'Ambos campos deben desplegar el texto de error Requerido');
        expect(clientProvider.isLoading, isFalse,
            reason: 'El formulario no debe activar el provider si la validación falla');
      });

      testWidgets('[INT-04] Flujo Correcto UI: Formulario rellena datos, procesa envío y muestra SnackBar de éxito', (WidgetTester tester) async {
        final authProvider = FakeAuthProvider();

        final mockApi = MockApiServiceForUI();
        mockApi.postHandler = (endpoint, body) => http.Response(jsonEncode({'id': 88}), 201);
        mockApi.getHandler = (endpoint) => http.Response('[]', 200);

        final clientProvider = ClientProvider(
          apiService: mockApi,
          localDb: InMemoryLocalDbService(),
        );

        await tester.pumpWidget(buildBookingScreen(
          clientProvider: clientProvider,
          authProvider: authProvider,
        ));
        await tester.pumpAndSettle();

        final textFields = find.byType(TextFormField);
        await tester.enterText(textFields.at(0), 'Fernando Alonso');
        await tester.enterText(textFields.at(1), '5566778899');
        await tester.pump();

        final confirmButton = find.text('Confirmar Cita');
        await tester.ensureVisible(confirmButton);
        await tester.tap(confirmButton);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        // Verificar llamada y SnackBar en pantalla
        expect(mockApi.postCallCount, 1);
        expect(find.text('Cita agendada con éxito'), findsOneWidget);
      });
    });
  });
}
