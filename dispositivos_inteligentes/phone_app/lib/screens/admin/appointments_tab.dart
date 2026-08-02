import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:ui';
import '../../providers/admin_provider.dart';
import '../../theme.dart';

class AppointmentsTab extends StatefulWidget {
  const AppointmentsTab({super.key});

  @override
  State<AppointmentsTab> createState() => _AppointmentsTabState();
}

class _AppointmentsTabState extends State<AppointmentsTab> {
  final Map<int, ExpansionTileController> _controllers = {};
  int _currentPage = 1;
  final int _itemsPerPage =
      5; // Cambiado a 5 para forzar la vista del paginador

  @override
  Widget build(BuildContext context) {
    final admin = Provider.of<AdminProvider>(context);

    if (admin.isLoading && admin.appointments.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.amarillo),
      );
    }

    if (admin.appointments.isEmpty) {
      return const Center(
        child: Text(
          'No hay citas registradas',
          style: TextStyle(color: Colors.white54, fontSize: 16),
        ),
      );
    }

    // Paginación Local
    final int totalItems = admin.appointments.length;
    final int totalPages = (totalItems / _itemsPerPage).ceil();

    // Asegurar que la pagina actual no exceda el maximo si se borran items
    if (_currentPage > totalPages && totalPages > 0) _currentPage = totalPages;

    final paginatedAppointments = admin.appointments
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
              itemCount: paginatedAppointments.length,
              itemBuilder: (context, index) {
                final cita = paginatedAppointments[index];
                _controllers[cita.id] ??= ExpansionTileController();

                Color stateColor = Colors.grey;
                IconData stateIcon = Icons.access_time;
                if (cita.estado == 'pendiente') {
                  stateColor = Colors.orangeAccent;
                  stateIcon = Icons.pending_actions;
                } else if (cita.estado == 'confirmada') {
                  stateColor = AppColors.verdeExito;
                  stateIcon = Icons.check_circle;
                } else if (cita.estado == 'cancelada') {
                  stateColor = AppColors.rojo;
                  stateIcon = Icons.cancel;
                }

                return Card(
                  color: AppColors.azulOscuro,
                  elevation: 3,
                  margin: const EdgeInsets.only(bottom: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: ExpansionTile(
                    controller: _controllers[cita.id],
                    onExpansionChanged: (isExpanded) {
                      if (isExpanded) {
                        _controllers.forEach((id, controller) {
                          if (id != cita.id && controller.isExpanded) {
                            controller.collapse();
                          }
                        });
                      }
                    },
                    collapsedIconColor: AppColors.blanco,
                    iconColor: AppColors.amarillo,
                    title: Text(
                      '${cita.fechaCita} a las ${cita.horaCita}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Colors.white,
                      ),
                    ),
                    subtitle: Text(
                      cita.servicio,
                      style: const TextStyle(color: Colors.white70),
                    ),
                    leading: CircleAvatar(
                      backgroundColor: stateColor.withOpacity(0.15),
                      child: Icon(stateIcon, color: stateColor, size: 22),
                    ),
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(15.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildDetailRow('Cliente:', cita.nombreCompleto),
                            _buildDetailRow('Teléfono:', cita.telefono),
                            _buildDetailRow(
                              'Estado:',
                              cita.estado.toUpperCase(),
                              color: stateColor,
                            ),
                            const SizedBox(height: 15),
                            if (cita.estado == 'pendiente')
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceEvenly,
                                children: [
                                  ElevatedButton.icon(
                                    onPressed: () =>
                                        admin.updateAppointmentStatus(
                                          cita.id,
                                          'cancelada',
                                        ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.rojo
                                          .withOpacity(0.2),
                                      foregroundColor: AppColors.rojo,
                                      elevation: 0,
                                      side: BorderSide(
                                        color: AppColors.rojo.withOpacity(0.5),
                                      ),
                                    ),
                                    icon: const Icon(Icons.close),
                                    label: const Text('Rechazar'),
                                  ),
                                  ElevatedButton.icon(
                                    onPressed: () => _mostrarDialogoConfirmar(
                                      context,
                                      admin,
                                      cita.id,
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.verdeExito
                                          .withOpacity(0.2),
                                      foregroundColor: AppColors.verdeExito,
                                      elevation: 0,
                                      side: BorderSide(
                                        color: AppColors.verdeExito.withOpacity(
                                          0.5,
                                        ),
                                      ),
                                    ),
                                    icon: const Icon(Icons.check),
                                    label: const Text('Aceptar'),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
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
                  icon: const Icon(
                    Icons.arrow_back_ios,
                    color: AppColors.amarillo,
                    size: 20,
                  ),
                  onPressed: _currentPage > 1
                      ? () => setState(() => _currentPage--)
                      : null,
                ),
                Text(
                  'Página $_currentPage de $totalPages',
                  style: const TextStyle(
                    color: Colors.white70,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  icon: const Icon(
                    Icons.arrow_forward_ios,
                    color: AppColors.amarillo,
                    size: 20,
                  ),
                  onPressed: _currentPage < totalPages
                      ? () => setState(() => _currentPage++)
                      : null,
                ),
              ],
            ),
          ),
      ],
    );
  }

  void _mostrarDialogoConfirmar(
    BuildContext context,
    AdminProvider admin,
    int citaId,
  ) {
    final TextEditingController _barberController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.azulOscuro,
        title: const Text(
          'Confirmar Cita',
          style: TextStyle(color: Colors.white),
        ),
        content: TextField(
          controller: _barberController,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'Nombre del Barbero asignado',
            labelStyle: TextStyle(color: Colors.white70),
            enabledBorder: UnderlineInputBorder(
              borderSide: BorderSide(color: Colors.white24),
            ),
            focusedBorder: UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.amarillo),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(
              'Cancelar',
              style: TextStyle(color: Colors.white70),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              admin.updateAppointmentStatus(
                citaId,
                'confirmada',
                nombreBarbero: _barberController.text.trim(),
              );
              Navigator.of(ctx).pop();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.verdeExito,
            ),
            child: const Text(
              'Confirmar',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(
    String label,
    String value, {
    Color color = Colors.white,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Text(
            '$label ',
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: Colors.white54,
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(color: color, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
