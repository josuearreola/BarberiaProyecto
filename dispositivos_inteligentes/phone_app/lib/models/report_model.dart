class ReportModel {
  final String id;
  final String equipo;
  final String descripcion;
  final String prioridad; // 'Baja', 'Media', 'Alta'
  final String fecha;
  final String estado; // 'activo', 'eliminado'
  final bool sincronizado;

  ReportModel({
    required this.id,
    required this.equipo,
    required this.descripcion,
    required this.prioridad,
    required this.fecha,
    this.estado = 'activo',
    this.sincronizado = true,
  });

  ReportModel copyWith({
    String? id,
    String? equipo,
    String? descripcion,
    String? prioridad,
    String? fecha,
    String? estado,
    bool? sincronizado,
  }) {
    return ReportModel(
      id: id ?? this.id,
      equipo: equipo ?? this.equipo,
      descripcion: descripcion ?? this.descripcion,
      prioridad: prioridad ?? this.prioridad,
      fecha: fecha ?? this.fecha,
      estado: estado ?? this.estado,
      sincronizado: sincronizado ?? this.sincronizado,
    );
  }

  factory ReportModel.fromJson(Map<String, dynamic> json) {
    return ReportModel(
      id: json['id'] ?? '',
      equipo: json['equipo'] ?? '',
      descripcion: json['descripcion'] ?? '',
      prioridad: json['prioridad'] ?? 'Media',
      fecha: json['fecha'] ?? '',
      estado: json['estado'] ?? 'activo',
      sincronizado: json['sincronizado'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'equipo': equipo,
      'descripcion': descripcion,
      'prioridad': prioridad,
      'fecha': fecha,
      'estado': estado,
      'sincronizado': sincronizado,
    };
  }
}

