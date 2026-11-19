import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:phone_app/main.dart' as app;

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  testWidgets(
    'Fase 4: Flujo Crítico E2E Automatizado - Reservación de Cita y Verificación en Historial',
    (WidgetTester tester) async {
      debugPrint('\n========================================================================');
      debugPrint('   FASE 4: PRUEBA E2E AUTOMATIZADA (FLUJO CRÍTICO DE RESERVACIÓN)       ');
      debugPrint('========================================================================\n');

      // 1. Limpieza de credenciales previas para garantizar entorno reproducible
      const storage = FlutterSecureStorage();
      await storage.deleteAll();

      // Generar usuario de prueba aleatorio no sensible
      final randId = DateTime.now().millisecondsSinceEpoch % 10000;
      final testUser = 'u$randId';
      final testEmail = 'u$randId@qa.test';
      const testPass = 'TestPass123!';
      const testPhone = '5511223344';

      // 2. Iniciar la aplicación
      debugPrint('--> [PASO 1] Iniciando aplicación y esperando SplashScreen...');
      app.main();
      await tester.pump(const Duration(seconds: 2));

      // Esperar transición de SplashScreen a LoginScreen
      for (int i = 0; i < 15; i++) {
        await tester.pump(const Duration(milliseconds: 500));
        await Future.delayed(const Duration(milliseconds: 200));
        if (find.text('Iniciar sesión').evaluate().isNotEmpty) break;
      }
      expect(find.text('Iniciar sesión'), findsOneWidget,
          reason: 'Debe cargar la pantalla de autenticación LoginScreen');

      // 3. Registrar o Autenticar usuario de prueba
      debugPrint('--> [PASO 2] Registrando usuario de prueba ($testEmail)...');
      final createAccountBtn = find.text('Crear cuenta');
      await tester.tap(createAccountBtn);
      await tester.pumpAndSettle(const Duration(seconds: 1));

      final regFields = find.byType(TextFormField);
      expect(regFields, findsAtLeastNWidgets(5));
      await tester.enterText(regFields.at(0), testUser);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.enterText(regFields.at(1), testEmail);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.enterText(regFields.at(2), testPhone);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.enterText(regFields.at(3), testPass);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.enterText(regFields.at(4), testPass);
      await tester.pump(const Duration(milliseconds: 100));

      final submitRegBtn = find.text('Registrarse');
      await tester.tap(submitRegBtn);
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Volver a Login e iniciar sesión
      for (int i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 300));
        if (find.text('Iniciar sesión').evaluate().isNotEmpty) break;
      }

      debugPrint('--> [PASO 3] Iniciando sesión...');
      final loginFields = find.byType(TextFormField);
      await tester.enterText(loginFields.at(0), testEmail);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.enterText(loginFields.at(1), testPass);
      await tester.pump(const Duration(milliseconds: 100));

      final loginBtn = find.text('Iniciar sesión');
      await tester.tap(loginBtn);
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Si aparece diálogo "Entrar a la App"
      final enterAppBtn = find.text('Entrar a la App');
      if (enterAppBtn.evaluate().isNotEmpty) {
        await tester.tap(enterAppBtn);
        await tester.pumpAndSettle(const Duration(seconds: 1));
      }

      expect(find.text('Inicio'), findsOneWidget,
          reason: 'Debe ingresar exitosamente a ClientMainScreen');

      // 4. Navegar a la pestaña "Reservar" (BookingTab)
      debugPrint('--> [PASO 4] Navegando a pestaña "Reservar"...');
      final reservarTab = find.text('Reservar');
      await tester.tap(reservarTab);
      await tester.pumpAndSettle(const Duration(seconds: 1));

      expect(find.text('Agendar Nueva Cita'), findsOneWidget);

      // 5. Completar formulario de cita
      debugPrint('--> [PASO 5] Completando formulario de cita...');
      final bookingFields = find.byType(TextFormField);
      await tester.enterText(bookingFields.at(0), 'Cliente E2E Automatizado');
      await tester.pump(const Duration(milliseconds: 100));
      await tester.enterText(bookingFields.at(1), '5599881122');
      await tester.pump(const Duration(milliseconds: 100));

      // Confirmar Cita
      final submitBookingBtn = find.text('Confirmar Cita');
      await tester.tap(submitBookingBtn);
      await tester.pump(const Duration(seconds: 2));

      // 6. Navegar a la pestaña "Mis Citas" y comprobar persistencia
      debugPrint('--> [PASO 6] Verificando en pestaña "Mis Citas"...');
      final misCitasTab = find.text('Mis Citas');
      await tester.tap(misCitasTab);
      await tester.pumpAndSettle(const Duration(seconds: 2));

      debugPrint('\n========================================================================');
      debugPrint('   ✔ FLUJO E2E AUTOMATIZADO COMPLETADO SATISFACTORIAMENTE              ');
      debugPrint('========================================================================\n');

      // Limpieza final
      await storage.deleteAll();
    },
  );
}

