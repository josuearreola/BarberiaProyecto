import 'package:flutter_test/flutter_test.dart';
import 'package:phone_app/models/report_model.dart';
import 'package:phone_app/services/reports_repository.dart';

void main() {
  group('Práctica de Base de Datos y Persistencia Móvil (Colección Reportes / Neon Cloud)', () {
    late ReportsRepository repo;

    setUp(() {
      repo = ReportsRepository();
    });

    // =========================================================================
    // TC01: Alta válida
    // =========================================================================
    test('[TC01] Alta válida: Registrar un reporte con todos los campos correctos', () async {
      final reporte = ReportModel(
        id: 'REP001',
        equipo: 'Silla Barbería Hidráulica #2',
        descripcion: 'Falla en el pistón de elevación y fuga de líquido',
        prioridad: 'Media',
        fecha: '2026-10-29T10:30:00Z',
      );

      final resultado = await repo.addReport(reporte);
      expect(resultado.id, 'REP001');
      expect(repo.lastStatusMessage, contains('almacenado y sincronizado'));

      // Consultar para comprobar que se almacena y se recupera
      final guardado = await repo.getReportById('REP001');
      expect(guardado, isNotNull);
      expect(guardado!.equipo, 'Silla Barbería Hidráulica #2');
      expect(guardado.prioridad, 'Media');
      expect(guardado.sincronizado, isTrue);
    });

    // =========================================================================
    // TC02: Campos vacíos
    // =========================================================================
    test('[TC02] Campos vacíos: Intentar guardar un reporte sin equipo ni descripción', () async {
      final reporteInvalido = ReportModel(
        id: 'REP002',
        equipo: '   ', // Solo espacios
        descripcion: '', // Vacío
        prioridad: 'Baja',
        fecha: '2026-10-29T11:00:00Z',
      );

      // Debe rechazar y lanzar excepción de validación
      expect(
        () async => await repo.addReport(reporteInvalido),
        throwsA(isA<ReportValidationException>()),
      );

      expect(repo.lastStatusMessage, contains('Error de validación'));

      // Verificar que NO se insertó nada en la colección
      final consulta = await repo.getReportById('REP002');
      expect(consulta, isNull);
    });

    // =========================================================================
    // TC03: Identificador repetido
    // =========================================================================
    test('[TC03] Identificador repetido: Guardar dos veces el reporte con ID REP001', () async {
      // 1. Primer guardado exitoso
      final primerReporte = ReportModel(
        id: 'REP001',
        equipo: 'Máquina Trimmer Wahl Detailer',
        descripcion: 'Descalibración en cuchillas',
        prioridad: 'Alta',
        fecha: '2026-10-29T09:00:00Z',
      );
      await repo.addReport(primerReporte);

      // 2. Intento de guardar un segundo reporte con el mismo ID REP001
      final reporteDuplicado = ReportModel(
        id: 'REP001',
        equipo: 'Secadora Parlux 3800',
        descripcion: 'Cable con falso contacto',
        prioridad: 'Baja',
        fecha: '2026-10-29T12:00:00Z',
      );

      // Debe rechazar el duplicado para proteger la información original
      expect(
        () async => await repo.addReport(reporteDuplicado),
        throwsA(isA<DuplicateReportException>()),
      );

      // Verificar que los datos originales NO fueron sobrescritos
      final original = await repo.getReportById('REP001');
      expect(original!.equipo, 'Máquina Trimmer Wahl Detailer');
      expect(original.prioridad, 'Alta');
    });

    // =========================================================================
    // TC04: Actualización
    // =========================================================================
    test('[TC04] Actualización: Cambiar la prioridad de un reporte de Media a Alta', () async {
      final reporte = ReportModel(
        id: 'REP003',
        equipo: 'Lámpara de Afeitado LED',
        descripcion: 'Parpadeo intermitente de la luz blanca',
        prioridad: 'Media',
        fecha: '2026-10-29T13:00:00Z',
      );
      await repo.addReport(reporte);

      // Ejecutar actualización
      final actualizado = await repo.updatePriority('REP003', 'Alta');
      expect(actualizado, isNotNull);
      expect(actualizado!.prioridad, 'Alta');
      expect(repo.lastStatusMessage, contains('actualizada de Media a Alta'));

      // Volver a consultar para comprobar persistencia del cambio
      final reconsulta = await repo.getReportById('REP003');
      expect(reconsulta!.prioridad, 'Alta');
    });

    // =========================================================================
    // TC05: Eliminación
    // =========================================================================
    test('[TC05] Eliminación: Eliminar un reporte existente y consultarlo nuevamente', () async {
      final reporte = ReportModel(
        id: 'REP004',
        equipo: 'Espejo Central Estación 3',
        descripcion: 'Fisura en esquina superior derecha',
        prioridad: 'Baja',
        fecha: '2026-10-29T14:00:00Z',
      );
      await repo.addReport(reporte);

      // Eliminar el reporte
      final exitoEliminacion = await repo.deleteReport('REP004');
      expect(exitoEliminacion, isTrue);

      // Consultarlo nuevamente: ya no debe aparecer como registro activo
      final reconsulta = await repo.getReportById('REP004');
      expect(reconsulta, isNull);

      // Verificar que no aparezca en la lista de activos
      final activos = repo.getAllActiveReports();
      expect(activos.any((r) => r.id == 'REP004'), isFalse);
    });

    // =========================================================================
    // TC06: Documento inexistente
    // =========================================================================
    test('[TC06] Documento inexistente: Consultar el ID REP999 sin bloquear la app', () async {
      // Consultar un ID no registrado en la base de datos
      final resultado = await repo.getReportById('REP999');

      // Debe retornar null de manera segura y controlada sin lanzar excepciones fatales
      expect(resultado, isNull);
      expect(repo.lastStatusMessage, contains('REP999 no existe'));
    });

    // =========================================================================
    // TC07: Pérdida de conexión
    // =========================================================================
    test('[TC07] Pérdida de conexión: Escritura offline, estado de sincronización y consistencia', () async {
      final reporteOffline = ReportModel(
        id: 'REP005',
        equipo: 'Esterilizador UV de Toallas',
        descripcion: 'No calienta a temperatura requerida',
        prioridad: 'Alta',
        fecha: '2026-10-29T15:30:00Z',
      );

      // Guardar con conexión desactivada (isOnline: false)
      final guardadoOffline = await repo.addReport(reporteOffline, isOnline: false);

      // La app debe guardar localmente, marcar sincronizado = false y reportar el estado
      expect(guardadoOffline.id, 'REP005');
      expect(guardadoOffline.sincronizado, isFalse);
      expect(repo.lastStatusMessage, contains('Sin conexión'));
      expect(repo.lastStatusMessage, contains('guardado localmente'));

      // Verificar que los datos permanecen consistentes y accesibles
      final consultaOffline = await repo.getReportById('REP005');
      expect(consultaOffline, isNotNull);
      expect(consultaOffline!.sincronizado, isFalse);
    });

    // =========================================================================
    // TC08: Persistencia
    // =========================================================================
    test('[TC08] Persistencia: Cerrar y abrir la app; consultar un reporte guardado', () async {
      // 1. Guardar reporte antes de cerrar la app
      final reportePersistente = ReportModel(
        id: 'REP006',
        equipo: 'Climatizador / Aire Acondicionado',
        descripcion: 'Filtro sucio y goteo en unidad interior',
        prioridad: 'Media',
        fecha: '2026-10-29T16:00:00Z',
      );
      await repo.addReport(reportePersistente);

      // 2. Simular cierre y reapertura de la app (destrucción de memoria y recarga de almacenamiento físico)
      await repo.restartApp();

      // 3. Consultar reporte tras reinicio
      final recuperado = await repo.getReportById('REP006');
      expect(recuperado, isNotNull);
      expect(recuperado!.id, 'REP006');
      expect(recuperado.equipo, 'Climatizador / Aire Acondicionado');
      expect(recuperado.prioridad, 'Media');
      expect(recuperado.descripcion, contains('goteo en unidad interior'));
    });
  });
}
