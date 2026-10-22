class AppNotificationModel {
  final String id;
  final int appointmentId;
  final String title;
  final String body;
  final String estado;
  final String servicio;
  final String fechaCita;
  final String horaCita;
  final String nombreBarbero;
  final DateTime timestamp;
  bool isRead;

  AppNotificationModel({
    required this.id,
    required this.appointmentId,
    required this.title,
    required this.body,
    required this.estado,
    required this.servicio,
    required this.fechaCita,
    required this.horaCita,
    required this.nombreBarbero,
    required this.timestamp,
    this.isRead = false,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'appointmentId': appointmentId,
        'title': title,
        'body': body,
        'estado': estado,
        'servicio': servicio,
        'fechaCita': fechaCita,
        'horaCita': horaCita,
        'nombreBarbero': nombreBarbero,
        'timestamp': timestamp.toIso8601String(),
        'isRead': isRead,
      };

  factory AppNotificationModel.fromJson(Map<String, dynamic> json) =>
      AppNotificationModel(
        id: json['id']?.toString() ?? '',
        appointmentId: json['appointmentId'] is int
            ? json['appointmentId']
            : int.tryParse(json['appointmentId']?.toString() ?? '0') ?? 0,
        title: json['title'] ?? '',
        body: json['body'] ?? '',
        estado: (json['estado'] ?? '').toString().toLowerCase(),
        servicio: json['servicio'] ?? '',
        fechaCita: json['fechaCita'] ?? '',
        horaCita: json['horaCita'] ?? '',
        nombreBarbero: json['nombreBarbero'] ?? '',
        timestamp: json['timestamp'] != null
            ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
            : DateTime.now(),
        isRead: json['isRead'] == true,
      );
}
