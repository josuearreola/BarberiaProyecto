import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:phone_app/main.dart';
import 'package:phone_app/providers/auth_provider.dart';
import 'package:phone_app/providers/admin_provider.dart';
import 'package:phone_app/providers/client_provider.dart';
import 'package:phone_app/providers/ble_provider.dart';
import 'package:phone_app/providers/notification_provider.dart';

void main() {
  testWidgets('Carga inicial de la app de Barberia', (WidgetTester tester) async {
    // Construye la aplicación dentro de sus MultiProviders reales
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => AdminProvider()),
          ChangeNotifierProvider(create: (_) => ClientProvider()),
          ChangeNotifierProvider(create: (_) => BleProvider()),
          ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ],
        child: const BarberiaApp(),
      ),
    );

    // Permitir transiciones iniciales
    await tester.pump(const Duration(milliseconds: 500));

    // Verifica que cargue correctamente sin fallar
    expect(find.byType(BarberiaApp), findsOneWidget);
  });
}
