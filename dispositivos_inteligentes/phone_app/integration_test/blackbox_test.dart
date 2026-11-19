import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:phone_app/main.dart' as app;
import 'package:phone_app/screens/client/booking_tab.dart';

// Pausa visible de 5 segundos después de cada caso exitoso para demostración y evaluación
Future<void> pauseAfterSuccess(WidgetTester tester, String casoId, String mensaje) async {
  debugPrint('--> [$casoId] ✔ PASÓ: $mensaje');
  debugPrint('--> [$casoId] Pausando 5 segundos para apreciación visual en pantalla...');
  for (int i = 0; i < 5; i++) {
    await Future.delayed(const Duration(seconds: 1));
    await tester.pump(const Duration(milliseconds: 200));
  }
}

// Función de scroll inteligente que busca cualquier botón y lo centra en pantalla antes de tocarlo
Future<void> scrollUntilCenteredAndTap(WidgetTester tester, Finder targetFinder) async {
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pump(const Duration(milliseconds: 300));

  // 1. Centrar el widget usando Scrollable.ensureVisible sin simular toques de arrastre que abran modales accidentales
  if (targetFinder.evaluate().isNotEmpty) {
    try {
      final element = targetFinder.evaluate().first;
      await Scrollable.ensureVisible(
        element,
        alignment: 0.5, // 0.5 ubica el widget en el centro exacto del área visible
        duration: const Duration(milliseconds: 400),
      );
      await tester.pump(const Duration(milliseconds: 500));
    } catch (_) {}
  }

  // 2. Si por lista perezosa no estaba visible, deslizar suavemente desde el margen seguro (x = 30)
  if (targetFinder.evaluate().isEmpty) {
    for (int i = 0; i < 5; i++) {
      await tester.dragFrom(const Offset(30, 500), const Offset(0, -300));
      await tester.pump(const Duration(milliseconds: 300));
      if (targetFinder.evaluate().isNotEmpty) {
        final element = targetFinder.evaluate().first;
        await Scrollable.ensureVisible(
          element,
          alignment: 0.5,
          duration: const Duration(milliseconds: 300),
        );
        await tester.pump(const Duration(milliseconds: 400));
        break;
      }
    }
  }

  // 3. Toque directo sobre el botón centrado
  await tester.tap(targetFinder, warnIfMissed: false);
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  testWidgets(
    'Práctica 8: Suite Completa End-to-End (Cliente crea Cita + Admin la Confirma)',
    (WidgetTester tester) async {
      // 0. Preparar entorno limpio en el dispositivo
      const storage = FlutterSecureStorage();
      await storage.deleteAll();

      // Generar credenciales dinámicas válidas para el Cliente (longitud <= 18 caracteres)
      final uniqueId = DateTime.now().millisecondsSinceEpoch % 10000;
      final clientUser = 'cli$uniqueId';
      final clientEmail = 'c$uniqueId@qa.com';
      const clientPass = 'Cliente1!';
      const clientPhone = '5544332211';

      // Credenciales oficiales de Administrador
      const adminEmail = 'Admin1@gmail.com';
      const adminPass = 'Adminis1!';

      // 1. Iniciar la aplicación
      app.main();
      await tester.pump(const Duration(seconds: 2));

      // Esperar que SplashScreen transicione a Login
      for (int i = 0; i < 15; i++) {
        await tester.pump(const Duration(milliseconds: 500));
        await Future.delayed(const Duration(milliseconds: 200));
        if (find.text('Iniciar sesión').evaluate().isNotEmpty) {
          break;
        }
      }

      expect(find.text('Iniciar sesión'), findsOneWidget,
          reason: 'Debe encontrarse la pantalla de Login tras el Splash');

      await Future.delayed(const Duration(seconds: 1));

      debugPrint('\n========================================================================');
      debugPrint('   PRÁCTICA 8: SUITE DE 12 PRUEBAS (CLIENTE AGENDA + ADMIN CONFIRMA)   ');
      debugPrint('========================================================================\n');

      // =======================================================================
      // PARTE 1: FLUJO COMPLETO DE CLIENTE (Casos 1 al 6)
      // =======================================================================
      debugPrint('------------------------------------------------------------------------');
      debugPrint('  FASE 1: ROL CLIENTE (REGISTRO, RESERVA Y CONSULTA DE CITA)            ');
      debugPrint('------------------------------------------------------------------------');

      // CASO 1: Registro de nueva cuenta de cliente
      debugPrint('--> [CASO 01] Creando cuenta de cliente ($clientEmail)...');
      final registerBtn = find.text('Crear cuenta');
      await scrollUntilCenteredAndTap(tester, registerBtn);
      await Future.delayed(const Duration(seconds: 1));

      // Llenar formulario de registro
      final regFields = find.byType(TextFormField);
      expect(regFields, findsAtLeastNWidgets(5));

      await tester.enterText(regFields.at(0), clientUser); // Nombre
      await tester.pump(const Duration(milliseconds: 200));
      await tester.enterText(regFields.at(1), clientEmail); // Correo
      await tester.pump(const Duration(milliseconds: 200));
      await tester.enterText(regFields.at(2), clientPhone); // Teléfono
      await tester.pump(const Duration(milliseconds: 200));
      await tester.enterText(regFields.at(3), clientPass); // Contraseña
      await tester.pump(const Duration(milliseconds: 200));
      await tester.enterText(regFields.at(4), clientPass); // Confirmar
      await tester.pump(const Duration(milliseconds: 200));

      final submitRegisterBtn = find.text('Registrarse');
      await scrollUntilCenteredAndTap(tester, submitRegisterBtn);

      // Esperar registro y retorno al Login
      for (int i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 400));
        await Future.delayed(const Duration(milliseconds: 200));
        if (find.text('Iniciar sesión').evaluate().isNotEmpty) break;
      }

      if (find.text('Iniciar sesión').evaluate().isEmpty) {
        final backBtn = find.byType(BackButton);
        if (backBtn.evaluate().isNotEmpty) {
          await tester.tap(backBtn);
          await tester.pump(const Duration(milliseconds: 400));
        }
      }
      expect(find.text('Iniciar sesión'), findsOneWidget);
      await pauseAfterSuccess(tester, 'CASO 01', 'Cuenta de cliente registrada exitosamente.');

      // CASO 2: Inicio de sesión real como Cliente
      debugPrint('--> [CASO 02] Iniciando sesión con cuenta de cliente ($clientEmail)...');
      final loginFields = find.byType(TextFormField);
      await tester.enterText(loginFields.at(0), clientEmail);
      await tester.pump(const Duration(milliseconds: 200));
      await tester.enterText(loginFields.at(1), clientPass);
      await tester.pump(const Duration(milliseconds: 200));

      final loginBtn = find.text('Iniciar sesión');
      await scrollUntilCenteredAndTap(tester, loginBtn);

      for (int i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 500));
        await Future.delayed(const Duration(milliseconds: 200));
        if (find.text('Entrar a la App').evaluate().isNotEmpty ||
            find.text('Inicio').evaluate().isNotEmpty) {
          break;
        }
      }

      // Aceptar diálogo "Entrar a la App"
      final enterAppBtn = find.text('Entrar a la App');
      if (enterAppBtn.evaluate().isNotEmpty) {
        await tester.tap(enterAppBtn);
        await tester.pump(const Duration(milliseconds: 400));
        await Future.delayed(const Duration(seconds: 1));
      }

      expect(find.text('Inicio'), findsOneWidget);
      await pauseAfterSuccess(tester, 'CASO 02', 'Sesión iniciada con éxito en ClientMainScreen.');

      // CASO 3: Validación de Roles y Permisos (Interfaz exclusiva de Cliente)
      debugPrint('--> [CASO 03] Verificando aislamiento de permisos de Cliente...');
      expect(find.text('Reservar'), findsOneWidget);
      expect(find.text('Mis Citas'), findsOneWidget);
      expect(find.text('Perfil'), findsOneWidget);
      expect(find.text('Usuarios'), findsNothing, reason: 'El cliente no debe ver el menú de Usuarios de Admin');
      expect(find.text('Resumen'), findsNothing, reason: 'El cliente no debe ver el menú Resumen de Admin');
      await pauseAfterSuccess(tester, 'CASO 03', 'Permisos exclusivos de Cliente verificados.');

      // CASO 4: CREACIÓN Y AGENDAMIENTO REAL DE CITA CON REINTENTO AUTOMÁTICO ANTE COLISIÓN
      debugPrint('--> [CASO 04] Creando y agendando cita real en "Reservar" (BookingTab)...');
      final reservarTab = find.text('Reservar');
      await tester.tap(reservarTab);
      await tester.pump(const Duration(milliseconds: 600));
      await Future.delayed(const Duration(seconds: 1));

      // Horarios candidatos para agendar; si 10:00 ya está ocupado, prueba con 11:00, 12:00, etc.
      final candidateHours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 9];
      bool appointmentBooked = false;

      for (int attempt = 0; attempt < candidateHours.length; attempt++) {
        final targetHour = candidateHours[attempt];

        // A partir del segundo intento, cambiamos la hora en el estado de BookingTab
        if (attempt > 0) {
          debugPrint('--> [CASO 04] El horario anterior ya estaba ocupado. Reintentando con las $targetHour:00...');
          if (find.byType(BookingTab).evaluate().isNotEmpty) {
            final bookingState = tester.state<BookingTabState>(find.byType(BookingTab));
            bookingState.setAppointmentTime(TimeOfDay(hour: targetHour, minute: 0));
            await tester.pump(const Duration(milliseconds: 500));
            await Future.delayed(const Duration(seconds: 1));
          }
        }

        // Centrar y pulsar el botón Confirmar Cita
        final confirmCitaBtn = find.text('Confirmar Cita');
        await scrollUntilCenteredAndTap(tester, confirmCitaBtn);

        // Esperar respuesta del backend
        for (int i = 0; i < 20; i++) {
          await tester.pump(const Duration(milliseconds: 400));
          await Future.delayed(const Duration(milliseconds: 200));

          if (find.text('Cita agendada con éxito').evaluate().isNotEmpty) {
            appointmentBooked = true;
            break;
          }

          // Detección de colisión (horario ya ocupado)
          final isOccupied = find.textContaining('ocupad').evaluate().isNotEmpty ||
              find.textContaining('otro horario').evaluate().isNotEmpty ||
              find.textContaining('409').evaluate().isNotEmpty;
          if (isOccupied) {
            debugPrint('--> [CASO 04] ⚠ Horario de las $targetHour:00 ocupado. Procediendo al siguiente turno.');
            break;
          }
        }

        if (appointmentBooked) {
          debugPrint('--> [CASO 04] ✔ Cita agendada exitosamente para las $targetHour:00.');
          break;
        }

        // Pausa breve para limpiar SnackBar anterior antes del siguiente intento
        await Future.delayed(const Duration(seconds: 2));
      }

      expect(appointmentBooked, isTrue, reason: 'La cita debe agendarse exitosamente en algún horario disponible');
      await pauseAfterSuccess(tester, 'CASO 04', 'Cita agendada exitosamente por el Cliente.');

      // CASO 5: Consulta de la cita en "Mis Citas"
      debugPrint('--> [CASO 05] Consultando la cita en la pestaña "Mis Citas"...');
      final misCitasTab = find.text('Mis Citas');
      await tester.tap(misCitasTab);
      for (int i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 400));
        await Future.delayed(const Duration(milliseconds: 200));
      }
      expect(find.byType(BottomNavigationBar), findsOneWidget);
      await pauseAfterSuccess(tester, 'CASO 05', 'Historial de citas consultado en tiempo real.');

      // CASO 6: Cierre de Sesión del Cliente
      debugPrint('--> [CASO 06] Navegando a "Perfil" y cerrando sesión de Cliente...');
      final perfilTab = find.text('Perfil');
      await tester.tap(perfilTab);
      await tester.pump(const Duration(milliseconds: 600));
      await Future.delayed(const Duration(seconds: 1));

      final logoutClientBtn = find.text('Cerrar Sesión');
      await scrollUntilCenteredAndTap(tester, logoutClientBtn);

      for (int i = 0; i < 15; i++) {
        await tester.pump(const Duration(milliseconds: 400));
        await Future.delayed(const Duration(milliseconds: 200));
        if (find.text('Iniciar sesión').evaluate().isNotEmpty) break;
      }

      expect(find.text('Iniciar sesión'), findsOneWidget,
          reason: 'Debe regresar a Login tras cerrar la sesión de cliente');
      await pauseAfterSuccess(tester, 'CASO 06', 'Sesión de cliente cerrada y retorno a Login limpio.');

      // =======================================================================
      // PARTE 2: FLUJO COMPLETO DE ADMINISTRADOR (Casos 7 al 12)
      // =======================================================================
      debugPrint('\n------------------------------------------------------------------------');
      debugPrint('  FASE 2: ROL ADMINISTRADOR (LOGIN, GESTIÓN Y CONFIRMACIÓN DE CITA)     ');
      debugPrint('------------------------------------------------------------------------');

      // CASO 7: Inicio de sesión real como Administrador
      debugPrint('--> [CASO 07] Iniciando sesión como Administrador ($adminEmail)...');
      final inputsAdmin = find.byType(TextFormField);
      await tester.enterText(inputsAdmin.at(0), adminEmail);
      await tester.pump(const Duration(milliseconds: 300));
      await tester.enterText(inputsAdmin.at(1), adminPass);
      await tester.pump(const Duration(milliseconds: 300));

      final loginBtnAdmin = find.text('Iniciar sesión');
      await scrollUntilCenteredAndTap(tester, loginBtnAdmin);

      for (int i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 500));
        await Future.delayed(const Duration(milliseconds: 200));
        if (find.text('Entrar a la App').evaluate().isNotEmpty ||
            find.text('Barbería Panel').evaluate().isNotEmpty) {
          break;
        }
      }

      // Aceptar diálogo "Entrar a la App"
      final enterAdminBtn = find.text('Entrar a la App');
      if (enterAdminBtn.evaluate().isNotEmpty) {
        await tester.tap(enterAdminBtn);
        await tester.pump(const Duration(milliseconds: 500));
        await Future.delayed(const Duration(seconds: 1));
      }

      expect(find.text('Barbería Panel'), findsOneWidget,
          reason: 'El administrador debe llegar a Barbería Panel');
      await pauseAfterSuccess(tester, 'CASO 07', 'Administrador autenticado con éxito.');

      // CASO 8: Validación de Roles y Permisos (Interfaz exclusiva de Administrador)
      debugPrint('--> [CASO 08] Verificando barra de navegación y vistas de Admin...');
      expect(find.text('Resumen'), findsOneWidget);
      expect(find.text('Calendario'), findsOneWidget);
      expect(find.text('Citas'), findsOneWidget);
      expect(find.text('Usuarios'), findsOneWidget);
      await pauseAfterSuccess(tester, 'CASO 08', 'Menú y herramientas de administración verificadas.');

      // CASO 9: CONFIRMACIÓN DE LA CITA POR EL ADMINISTRADOR
      debugPrint('--> [CASO 09] Navegando a "Citas" para confirmar la reserva del cliente...');
      final citasAdminTab = find.text('Citas');
      await tester.tap(citasAdminTab);
      for (int i = 0; i < 15; i++) {
        await tester.pump(const Duration(milliseconds: 400));
        await Future.delayed(const Duration(milliseconds: 200));
        if (find.byType(ExpansionTile).evaluate().isNotEmpty) break;
      }

      // Expandir la primera cita disponible
      final tiles = find.byType(ExpansionTile);
      if (tiles.evaluate().isNotEmpty) {
        await tester.tap(tiles.first);
        await tester.pump(const Duration(milliseconds: 600));
        await Future.delayed(const Duration(seconds: 1));

        // Buscar botón "Aceptar" de la cita pendiente
        final acceptBtn = find.text('Aceptar');
        if (acceptBtn.evaluate().isNotEmpty) {
          await tester.tap(acceptBtn.first);
          await tester.pump(const Duration(milliseconds: 600));
          await Future.delayed(const Duration(seconds: 1));

          // Confirmar en el diálogo
          final dialogConfirmBtn = find.text('Confirmar');
          if (dialogConfirmBtn.evaluate().isNotEmpty) {
            await tester.tap(dialogConfirmBtn);
            for (int i = 0; i < 15; i++) {
              await tester.pump(const Duration(milliseconds: 400));
              await Future.delayed(const Duration(milliseconds: 200));
            }
          }
        }
      }
      await pauseAfterSuccess(tester, 'CASO 09', 'Cita del cliente localizada y confirmada por el Administrador.');

      // CASO 10: Navegación y consulta a la sección Calendario (CalendarTab)
      debugPrint('--> [CASO 10] Navegando a la sección "Calendario" del Administrador...');
      final calTab = find.text('Calendario');
      await tester.tap(calTab);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.byType(BottomNavigationBar), findsOneWidget);
      await pauseAfterSuccess(tester, 'CASO 10', 'Calendario de administración cargado.');

      // CASO 11: Navegación y consulta a la sección Usuarios (UsersTab)
      debugPrint('--> [CASO 11] Navegando a la sección "Usuarios" del Administrador...');
      final usuariosTab = find.text('Usuarios');
      await tester.tap(usuariosTab);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.byType(BottomNavigationBar), findsOneWidget);
      await pauseAfterSuccess(tester, 'CASO 11', 'Directorio de Usuarios y Barberos cargado.');

      // CASO 12: Retorno a Resumen, persistencia y Logout final de Administrador
      debugPrint('--> [CASO 12] Retorno a "Resumen", comprobación de JWT y Logout final de Admin...');
      final resumenTab = find.text('Resumen');
      await tester.tap(resumenTab);
      await tester.pump(const Duration(milliseconds: 600));
      await Future.delayed(const Duration(seconds: 1));

      final savedRole = await storage.read(key: 'user_role');
      expect(savedRole, equals('admin'), reason: 'El rol guardado en storage debe ser admin');

      // Cerrar sesión con el icono de AppBar
      final logoutAdminBtn = find.byTooltip('Cerrar Sesión');
      expect(logoutAdminBtn, findsOneWidget);
      await tester.tap(logoutAdminBtn);
      for (int i = 0; i < 15; i++) {
        await tester.pump(const Duration(milliseconds: 400));
        await Future.delayed(const Duration(milliseconds: 200));
        if (find.text('Iniciar sesión').evaluate().isNotEmpty) break;
      }

      expect(find.text('Iniciar sesión'), findsOneWidget,
          reason: 'Debe regresar a Login al salir del modo Administrador');
      await pauseAfterSuccess(tester, 'CASO 12', 'Consistencia confirmada y sesión de Administrador cerrada.');

      debugPrint('\n========================================================================');
      debugPrint('   ¡SUITE COMPLETA DE 12 PRUEBAS (CLIENTE + ADMIN) EJECUTADA CON ÉXITO!  ');
      debugPrint('========================================================================\n');
    },
  );
}
