import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:intl/intl.dart';
import '../../providers/admin_provider.dart';
import '../../theme.dart';
import '../../models/appointment_model.dart';

class CalendarTab extends StatefulWidget {
  const CalendarTab({super.key});

  @override
  State<CalendarTab> createState() => _CalendarTabState();
}

class _CalendarTabState extends State<CalendarTab> {
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    _selectedDay = _focusedDay;
  }

  List<AppointmentModel> _getAppointmentsForDay(DateTime day, List<AppointmentModel> allAppointments) {
    // Formatear el día seleccionado a 'YYYY-MM-DD' para compararlo con la BD
    final dateString = DateFormat('yyyy-MM-dd').format(day);
    return allAppointments
        .where((cita) => cita.fechaCita == dateString && cita.estado != 'cancelada')
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final admin = Provider.of<AdminProvider>(context);

    if (admin.isLoading && admin.appointments.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.amarillo));
    }

    final selectedCitas = _getAppointmentsForDay(_selectedDay ?? _focusedDay, admin.appointments);

    return Column(
      children: [
        Card(
          margin: const EdgeInsets.all(15),
          color: AppColors.azulOscuro,
          elevation: 4,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: TableCalendar(
              firstDay: DateTime.utc(2020, 10, 16),
              lastDay: DateTime.utc(2030, 3, 14),
              focusedDay: _focusedDay,
              selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
              eventLoader: (day) => _getAppointmentsForDay(day, admin.appointments),
              onDaySelected: (selectedDay, focusedDay) {
                setState(() {
                  _selectedDay = selectedDay;
                  _focusedDay = focusedDay;
                });
              },
              calendarStyle: const CalendarStyle(
                defaultTextStyle: TextStyle(color: Colors.white),
                weekendTextStyle: TextStyle(color: Colors.white54),
                selectedDecoration: BoxDecoration(color: AppColors.amarillo, shape: BoxShape.circle),
                selectedTextStyle: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                todayDecoration: BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
                // markers se renderizan manualmente abajo
              ),
              calendarBuilders: CalendarBuilders(
                markerBuilder: (context, date, events) {
                  if (events.isEmpty) return const SizedBox();
                  return Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: events.take(4).map((dynamic event) {
                      final cita = event as AppointmentModel;
                      Color markerColor = Colors.grey;
                      if (cita.estado == 'pendiente') markerColor = Colors.orangeAccent;
                      if (cita.estado == 'confirmada') markerColor = AppColors.verdeExito;

                      return Container(
                        margin: const EdgeInsets.symmetric(horizontal: 1.5, vertical: 5),
                        width: 7.0,
                        height: 7.0,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: markerColor,
                        ),
                      );
                    }).toList(),
                  );
                },
              ),
              headerStyle: const HeaderStyle(
                formatButtonVisible: false,
                titleCentered: true,
                titleTextStyle: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                leftChevronIcon: Icon(Icons.chevron_left, color: AppColors.amarillo),
                rightChevronIcon: Icon(Icons.chevron_right, color: AppColors.amarillo),
              ),
              daysOfWeekStyle: const DaysOfWeekStyle(
                weekdayStyle: TextStyle(color: AppColors.amarillo, fontWeight: FontWeight.bold),
                weekendStyle: TextStyle(color: Colors.white54, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Citas del Día',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ),
        ),
        Expanded(
          child: selectedCitas.isEmpty
              ? const Center(
                  child: Text('No hay citas para esta fecha', style: TextStyle(color: Colors.white54)),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 15),
                  itemCount: selectedCitas.length,
                  itemBuilder: (context, index) {
                    final cita = selectedCitas[index];
                    final isConfirmed = cita.estado == 'confirmada';
                    final stateColor = isConfirmed ? AppColors.verdeExito : Colors.orangeAccent;

                    return Card(
                      color: AppColors.azulOscuro,
                      elevation: 3,
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(color: stateColor.withOpacity(0.5), width: 1),
                      ),
                      child: ListTile(
                        leading: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              cita.horaCita,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          ],
                        ),
                        title: Text(cita.nombreCompleto, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                        subtitle: Text(cita.servicio, style: const TextStyle(color: Colors.white70)),
                        trailing: Icon(
                          isConfirmed ? Icons.check_circle : Icons.pending_actions,
                          color: stateColor,
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
