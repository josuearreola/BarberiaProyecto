import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/appointment_model.dart';

class LocalDbService {
  static final LocalDbService instance = LocalDbService._internal();
  LocalDbService._internal();

  Database? _db;

  Future<Database?> get database async {
    if (_db != null) return _db;
    try {
      _db = await _initDatabase();
      return _db;
    } catch (e) {
      debugPrint('LocalDbService: SQLite nativo no inicializado o pendiente de recompilación ($e)');
      return null;
    }
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'barberia_cache.db');

    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE appointments_cache (
            id INTEGER PRIMARY KEY,
            nombreCompleto TEXT NOT NULL,
            telefono TEXT NOT NULL,
            correo TEXT,
            servicio TEXT NOT NULL,
            fechaCita TEXT NOT NULL,
            horaCita TEXT NOT NULL,
            estado TEXT NOT NULL,
            notas TEXT,
            nombreBarbero TEXT
          )
        ''');
      },
    );
  }

  // Guardar y refrescar el listado de citas en la base de datos local SQLite
  Future<void> saveAppointments(List<AppointmentModel> appointments) async {
    try {
      final db = await database;
      if (db == null) return;

      final batch = db.batch();
      batch.delete('appointments_cache');

      for (final appt in appointments) {
        batch.insert(
          'appointments_cache',
          appt.toMap(),
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }

      await batch.commit(noResult: true);
    } catch (e) {
      debugPrint('LocalDbService: Error al guardar en SQLite local ($e)');
    }
  }

  // Obtener citas almacenadas en SQLite local cuando no hay conexión a internet
  Future<List<AppointmentModel>> getCachedAppointments() async {
    try {
      final db = await database;
      if (db == null) return [];

      final List<Map<String, dynamic>> maps = await db.query(
        'appointments_cache',
        orderBy: 'fechaCita DESC, horaCita DESC',
      );

      return maps.map((item) => AppointmentModel.fromJson(item)).toList();
    } catch (e) {
      debugPrint('LocalDbService: Error al leer SQLite local ($e)');
      return [];
    }
  }

  // Limpiar base de datos local (por ejemplo al hacer logout)
  Future<void> clearAppointmentsCache() async {
    try {
      final db = await database;
      if (db == null) return;
      await db.delete('appointments_cache');
    } catch (e) {
      debugPrint('LocalDbService: Error al limpiar SQLite ($e)');
    }
  }
}
