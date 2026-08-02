import 'package:flutter_test/flutter_test.dart';
import 'package:phone_app/main.dart';

void main() {
  testWidgets('Carga inicial de la app de Barberia', (WidgetTester tester) async {
    // Construye nuestra aplicación y dispara un frame.
    await tester.pumpWidget(const BarberiaApp());

    // Verifica que cargue correctamente sin fallar.
    expect(find.byType(BarberiaApp), findsOneWidget);
  });
}
