import 'dart:convert';
import '../models/report_model.dart';

class ReportValidationException implements Exception {
  final String message;
  ReportValidationException(this.message);
  @override
  String toString() => message;
}

class DuplicateReportException implements Exception {
  final String message;
  DuplicateReportException(this.message);
  @override
  String toString() => message;
}

/// Repositorio de Reportes para gestión documental con persistencia local y sincronización con Neon Cloud
class ReportsRepository {
  // Simulación de almacenamiento físico persistente (disco/documentos en almacenamiento local)
  final Map<String, String> _persistentDisk = {};

  // Memoria viva de la aplicación
  final Map<String, ReportModel> _memoryStore = {};

  // Bitácora de operaciones y estado
  String lastStatusMessage = '';

  ReportsRepository({Map<String, ReportModel>? initialSeed}) {
    if (initialSeed != null) {
      for (final entry in initialSeed.entries) {
        _memoryStore[entry.key] = entry.value;
        _persistentDisk[entry.key] = jsonEncode(entry.value.toJson());
      }
    }
  }

  /// TC01 y TC02 y TC03: Alta de reporte con validación de obligatoriedad e integridad de clave
  Future<ReportModel> addReport(ReportModel report, {bool isOnline = true}) async {
    // TC02: Validación de campos vacíos
    if (report.equipo.trim().isEmpty || report.descripcion.trim().isEmpty) {
      lastStatusMessage = 'Error de validación: Se requiere equipo y descripción.';
      throw ReportValidationException(lastStatusMessage);
    }

    // TC03: Verificación de identificador repetido para evitar sobrescritura accidental
    if (_memoryStore.containsKey(report.id) && _memoryStore[report.id]!.estado != 'eliminado') {
      lastStatusMessage = 'Conflicto: Ya existe un reporte con ID ${report.id}.';
      throw DuplicateReportException(lastStatusMessage);
    }

    // TC07: Manejo de conectividad
    final reportToSave = report.copyWith(
      sincronizado: isOnline,
    );

    // Guardado en memoria y persistencia
    _memoryStore[report.id] = reportToSave;
    _persistentDisk[report.id] = jsonEncode(reportToSave.toJson());

    if (isOnline) {
      lastStatusMessage = 'Reporte ${report.id} almacenado y sincronizado con Neon Cloud.';
    } else {
      lastStatusMessage = 'Sin conexión: Reporte ${report.id} guardado localmente (sincronización pendiente).';
    }

    return reportToSave;
  }

  /// TC06: Consulta de reporte por ID con manejo seguro de documentos inexistentes
  Future<ReportModel?> getReportById(String id) async {
    if (!_memoryStore.containsKey(id)) {
      lastStatusMessage = 'Documento no encontrado: El ID $id no existe en la colección.';
      return null; // Retorna null controlado sin bloquear la app
    }

    final item = _memoryStore[id]!;
    if (item.estado == 'eliminado') {
      lastStatusMessage = 'El reporte $id se encuentra marcado como eliminado.';
      return null;
    }

    lastStatusMessage = 'Reporte $id localizado exitosamente.';
    return item;
  }

  /// TC04: Actualización de prioridad
  Future<ReportModel?> updatePriority(String id, String newPriority) async {
    final existing = await getReportById(id);
    if (existing == null) {
      lastStatusMessage = 'No es posible actualizar: el reporte $id no existe.';
      return null;
    }

    final updated = existing.copyWith(
      prioridad: newPriority,
      fecha: DateTime.now().toIso8601String(),
    );

    _memoryStore[id] = updated;
    _persistentDisk[id] = jsonEncode(updated.toJson());
    lastStatusMessage = 'Prioridad de reporte $id actualizada de ${existing.prioridad} a $newPriority.';
    return updated;
  }

  /// TC05: Eliminación lógica o física del reporte
  Future<bool> deleteReport(String id) async {
    if (!_memoryStore.containsKey(id) || _memoryStore[id]!.estado == 'eliminado') {
      lastStatusMessage = 'El reporte $id no existe o ya estaba eliminado.';
      return false;
    }

    // Eliminación lógica consistente
    final deleted = _memoryStore[id]!.copyWith(estado: 'eliminado');
    _memoryStore[id] = deleted;
    _persistentDisk[id] = jsonEncode(deleted.toJson());
    lastStatusMessage = 'Reporte $id eliminado del registro activo.';
    return true;
  }

  /// TC08: Simulación de cierre y apertura de la aplicación (reinicio de memoria desde disco persistente)
  Future<void> restartApp() async {
    // 1. Limpiar memoria volátil (simula cierre de proceso móvil)
    _memoryStore.clear();

    // 2. Restaurar datos desde el almacenamiento persistente (disco)
    for (final entry in _persistentDisk.entries) {
      final jsonMap = jsonDecode(entry.value) as Map<String, dynamic>;
      _memoryStore[entry.key] = ReportModel.fromJson(jsonMap);
    }

    lastStatusMessage = 'Aplicación reiniciada: Datos restaurados desde almacenamiento persistente.';
  }

  /// Obtener todos los reportes activos
  List<ReportModel> getAllActiveReports() {
    return _memoryStore.values.where((r) => r.estado == 'activo').toList();
  }
}

