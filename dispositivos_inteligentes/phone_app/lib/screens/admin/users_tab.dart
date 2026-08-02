import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:ui';
import '../../providers/admin_provider.dart';
import '../../theme.dart';

class UsersTab extends StatefulWidget {
  const UsersTab({super.key});

  @override
  State<UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends State<UsersTab> {
  final Map<int, ExpansionTileController> _controllers = {};
  int _currentPage = 1;
  final int _itemsPerPage = 5; // Cambiado a 5 para forzar la vista del paginador

  @override
  Widget build(BuildContext context) {
    final admin = Provider.of<AdminProvider>(context);

    if (admin.isLoading && admin.users.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.amarillo));
    }

    if (admin.users.isEmpty) {
      return const Center(
        child: Text('No hay usuarios registrados', style: TextStyle(color: Colors.white54, fontSize: 16)),
      );
    }

    final int totalItems = admin.users.length;
    final int totalPages = (totalItems / _itemsPerPage).ceil();

    if (_currentPage > totalPages && totalPages > 0) _currentPage = totalPages;

    final paginatedUsers = admin.users
        .skip((_currentPage - 1) * _itemsPerPage)
        .take(_itemsPerPage)
        .toList();

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            color: AppColors.amarillo,
            onRefresh: () async {
              await admin.fetchDashboardData();
              setState(() => _currentPage = 1);
            },
            child: ListView.builder(
              padding: const EdgeInsets.all(15),
              itemCount: paginatedUsers.length,
              itemBuilder: (context, index) {
                final user = paginatedUsers[index];
                _controllers[user.id] ??= ExpansionTileController();

                final bool isAdmin = user.role == 'admin' || user.role == 'administrador';
                final bool isInactive = user.estado.toLowerCase() == 'inactivo';
                
                final Color roleColor = isAdmin ? AppColors.amarillo : Colors.blueAccent;

                return Card(
                  color: isInactive ? Colors.grey.shade900 : AppColors.azulOscuro,
                  elevation: 2,
                  margin: const EdgeInsets.only(bottom: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  child: ExpansionTile(
                    controller: _controllers[user.id],
                    onExpansionChanged: (isExpanded) {
                      if (isExpanded) {
                        _controllers.forEach((id, controller) {
                          if (id != user.id && controller.isExpanded) {
                            controller.collapse();
                          }
                        });
                      }
                    },
                    collapsedIconColor: isInactive ? Colors.white38 : AppColors.blanco,
                    iconColor: roleColor,
                    leading: CircleAvatar(
                      backgroundColor: isInactive ? Colors.grey : roleColor.withOpacity(0.2),
                      child: Text(
                        user.usuario.substring(0, 1).toUpperCase(),
                        style: TextStyle(
                          color: isInactive ? Colors.white54 : roleColor, 
                          fontWeight: FontWeight.bold
                        ),
                      ),
                    ),
                    title: Text(
                      user.usuario, 
                      style: TextStyle(
                        fontWeight: FontWeight.bold, 
                        color: isInactive ? Colors.white54 : Colors.white,
                        decoration: isInactive ? TextDecoration.lineThrough : null,
                      )
                    ),
                    subtitle: Text(
                      user.role.toUpperCase(), 
                      style: TextStyle(color: isInactive ? Colors.white38 : roleColor, fontWeight: FontWeight.bold, fontSize: 12)
                    ),
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                        child: Column(
                          children: [
                            _buildDetailRow(Icons.email, 'Correo:', user.email, isInactive),
                            const SizedBox(height: 10),
                            _buildDetailRow(Icons.phone, 'Teléfono:', user.telefono.isEmpty ? 'No registrado' : user.telefono, isInactive),
                            const SizedBox(height: 15),
                            Align(
                              alignment: Alignment.centerRight,
                              child: isInactive
                                  ? ElevatedButton.icon(
                                      onPressed: () => admin.restoreUser(user.id),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: AppColors.verdeExito.withOpacity(0.2),
                                        foregroundColor: AppColors.verdeExito,
                                        elevation: 0,
                                      ),
                                      icon: const Icon(Icons.restore),
                                      label: const Text('Restaurar Usuario'),
                                    )
                                  : ElevatedButton.icon(
                                      onPressed: () => _confirmDelete(context, user.id, admin),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: AppColors.rojo.withOpacity(0.2),
                                        foregroundColor: AppColors.rojo,
                                        elevation: 0,
                                      ),
                                      icon: const Icon(Icons.delete_outline),
                                      label: const Text('Eliminar Usuario'),
                                    ),
                            ),
                          ],
                        ),
                      )
                    ],
                  ),
                );
              },
            ),
          ),
        ),
        if (totalPages > 1)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
            color: Colors.black12,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios, color: AppColors.amarillo, size: 20),
                  onPressed: _currentPage > 1 ? () => setState(() => _currentPage--) : null,
                ),
                Text(
                  'Página $_currentPage de $totalPages',
                  style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.arrow_forward_ios, color: AppColors.amarillo, size: 20),
                  onPressed: _currentPage < totalPages ? () => setState(() => _currentPage++) : null,
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value, bool isInactive) {
    return Row(
      children: [
        Icon(icon, color: isInactive ? Colors.white38 : Colors.white54, size: 20),
        const SizedBox(width: 10),
        Text('$label ', style: TextStyle(fontWeight: FontWeight.bold, color: isInactive ? Colors.white38 : Colors.white54)),
        Expanded(
          child: Text(
            value, 
            style: TextStyle(
              color: isInactive ? Colors.white38 : Colors.white, 
              fontWeight: FontWeight.w500
            )
          )
        ),
      ],
    );
  }

  void _confirmDelete(BuildContext context, int userId, AdminProvider admin) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.azulOscuro,
        title: const Text('Eliminar Usuario', style: TextStyle(color: Colors.white)),
        content: const Text('¿Estás seguro que deseas eliminar este usuario?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () {
              admin.deleteUser(userId);
              Navigator.of(ctx).pop();
            },
            child: const Text('Eliminar', style: TextStyle(color: AppColors.rojo, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
