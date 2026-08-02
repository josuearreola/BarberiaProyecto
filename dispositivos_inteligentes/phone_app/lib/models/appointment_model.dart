class AppointmentModel {
  final int id;
  final String nombreCompleto;
  final String telefono;
  final String? correo;
  final String servicio;
  final String fechaCita;
  final String horaCita;
  final String estado;
  final String? notas;
  final String? nombreBarbero;

  AppointmentModel({
    required this.id,
    required this.nombreCompleto,
    required this.telefono,
    this.correo,
    required this.servicio,
    required this.fechaCita,
    required this.horaCita,
    required this.estado,
    this.notas,
    this.nombreBarbero,
  });

  factory AppointmentModel.fromJson(Map<String, dynamic> json) {
    return AppointmentModel(
      id: json['id'],
      nombreCompleto: json['nombreCompleto'] ?? json['nombre_completo'] ?? '',
      telefono: json['telefono'] ?? '',
      correo: json['correo'],
      servicio: json['servicio'] ?? '',
      fechaCita: json['fechaCita'] ?? json['fecha_cita'] ?? '',
      horaCita: json['horaCita'] ?? json['hora_cita'] ?? '',
      estado: json['estado'] ?? 'pendiente',
      notas: json['notas'],
      nombreBarbero: json['nombreBarbero'] ?? json['nombre_barbero'],
    );
  }
}
