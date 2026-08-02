class UserModel {
  final int id;
  final String usuario;
  final String email;
  final String telefono;
  final String role;
  final String estado;

  UserModel({
    required this.id,
    required this.usuario,
    required this.email,
    required this.telefono,
    required this.role,
    required this.estado,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      usuario: json['usuario'] ?? '',
      email: json['email'] ?? '',
      telefono: json['telefono'] ?? '',
      role: json['role'] ?? 'cliente',
      estado: json['estado'] ?? 'activo',
    );
  }
}
