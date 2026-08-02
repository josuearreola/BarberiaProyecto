import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:ui';
import '../../providers/admin_provider.dart';
import '../../theme.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  @override
  void initState() {
    super.initState();
    // Cargamos los datos al inicializar la pestaña
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AdminProvider>(context, listen: false).fetchDashboardData();
    });
  }

  @override
  Widget build(BuildContext context) {
    final admin = Provider.of<AdminProvider>(context);

    if (admin.isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.amarillo));
    }

    return RefreshIndicator(
      color: AppColors.amarillo,
      onRefresh: () => admin.fetchDashboardData(),
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Resumen General',
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 20),
          _buildGlassCard(
            context,
            title: 'Total de Citas',
            value: admin.totalAppointments.toString(),
            icon: Icons.calendar_month,
            color: AppColors.amarillo,
          ),
          const SizedBox(height: 15),
          Row(
            children: [
              Expanded(
                child: _buildGlassCard(
                  context,
                  title: 'Pendientes',
                  value: admin.pendingAppointments.toString(),
                  icon: Icons.pending_actions,
                  color: Colors.orangeAccent,
                ),
              ),
              const SizedBox(width: 15),
              Expanded(
                child: _buildGlassCard(
                  context,
                  title: 'Confirmadas',
                  value: admin.confirmedAppointments.toString(),
                  icon: Icons.check_circle_outline,
                  color: AppColors.verdeExito,
                ),
              ),
            ],
          ),
          const SizedBox(height: 15),
          _buildGlassCard(
            context,
            title: 'Usuarios Registrados',
            value: admin.totalUsers.toString(),
            icon: Icons.people_alt_outlined,
            color: Colors.blueAccent,
          ),
        ],
      ),
    );
  }

  Widget _buildGlassCard(BuildContext context,
      {required String title, required String value, required IconData icon, required Color color}) {
    return Card(
      color: AppColors.azulOscuro,
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: color, size: 28),
                ),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: AppColors.blanco,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 15),
            Text(
              title,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.white70,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
