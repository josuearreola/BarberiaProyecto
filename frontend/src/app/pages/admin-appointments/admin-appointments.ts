import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import {
  Appointment,
  AppointmentFilters,
  AppointmentService,
} from '../../services/appointment.service';
import { AuthService } from '../../services/auth.service';
import { AdminRoles } from '../admin-roles/admin-roles';
import { AdminAudit } from '../admin-audit/admin-audit';
import { AdminUsersTab } from './admin-users-tab/admin-users-tab';

type AdminTab = 'appointments' | 'users' | 'roles' | 'audit';

type DeleteTarget = {
  kind: 'appointment';
  id: number;
  label: string;
};

@Component({
  selector: 'app-admin-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminRoles, AdminAudit, AdminUsersTab],
  templateUrl: './admin-appointments.html',
  styleUrl: './admin-appointments.css',
})
export class AdminAppointments implements OnInit {
  activeTab = signal<AdminTab>('appointments');

  appointments: Appointment[] = [];
  appointmentFilters: AppointmentFilters = {
    search: '',
    fecha: '',
    estado: '',
    sortBy: 'creadoEn',
    sortDir: 'DESC',
    page: 1,
    limit: 10,
  };

  appointmentStatusOptions = ['pendiente', 'confirmada', 'completada', 'cancelada'];

  isLoading = false;
  isSubmittingAppointment = false;
  isSavingAppointment = false;
  isConfirmingDelete = false;
  isCreateAppointmentModalOpen = false;
  errorMessage = '';
  successMessage = '';

  totalAppointments = 0;
  appointmentTotalPages = 1;

  editId: number | null = null;
  editForm = {
    nombreCompleto: '',
    telefono: '',
    correo: '',
    servicio: '',
    fechaCita: '',
    horaCita: '',
    notas: '',
    estado: 'pendiente',
  };

  createAppointmentForm = {
    nombreCompleto: '',
    telefono: '',
    correo: '',
    servicio: '',
    fechaCita: '',
    horaCita: '',
    notas: '',
  };

  pendingAppointmentIds = new Set<number>();
  deleteTarget: DeleteTarget | null = null;

  constructor(
    private readonly appointmentService: AppointmentService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadAppointments();
  }

  setTab(tab: AdminTab): void {
    this.activeTab.set(tab);
    this.clearMessages();
    this.editId = null;
    this.deleteTarget = null;
    this.isCreateAppointmentModalOpen = false;
  }

  onLogout(): void {
    this.authService.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }

  openProfileModal(): void {
    this.authService.isProfileModalOpen.set(true);
  }

  /* ═══════════════════════════════════════════════
   *  APPOINTMENTS — CRUD
   * ═══════════════════════════════════════════════ */

  loadAppointments(): void {
    if (this.isLoading) return;
    this.isLoading = true;
    this.errorMessage = '';

    this.appointmentService
      .getAppointments(this.appointmentFilters)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (result) => {
          this.appointments = result.data;
          this.totalAppointments = result.total;
          this.appointmentTotalPages = result.totalPages;
          this.appointmentFilters.page = result.page;
        },
        error: (error) => {
          this.errorMessage = this.extractErrorMessage(error, 'No se pudieron cargar las citas.');
        },
      });
  }

  applyFilters(): void {
    this.appointmentFilters.page = 1;
    this.loadAppointments();
  }

  clearFilters(): void {
    this.appointmentFilters = {
      search: '',
      fecha: '',
      estado: '',
      sortBy: 'creadoEn',
      sortDir: 'DESC',
      page: 1,
      limit: 10,
    };
    this.loadAppointments();
  }

  changeAppointmentPage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.appointmentTotalPages || nextPage === this.appointmentFilters.page) return;
    this.appointmentFilters.page = nextPage;
    this.loadAppointments();
  }

  createAppointment(): void {
    if (this.isSubmittingAppointment) return;
    this.clearMessages();

    const payload = this.normalizeAppointmentPayload(this.createAppointmentForm);
    const validationError = this.validateAppointmentPayload(payload, false);
    if (validationError) { this.errorMessage = validationError; return; }

    this.isSubmittingAppointment = true;
    this.appointmentService
      .createAppointment(payload)
      .pipe(finalize(() => (this.isSubmittingAppointment = false)))
      .subscribe({
        next: (created) => {
          this.successMessage = 'Cita creada correctamente.';
          this.resetCreateAppointmentForm();
          this.isCreateAppointmentModalOpen = false;
          if (!this.insertAppointmentInCurrentView(created)) this.loadAppointments();
        },
        error: (error) => {
          this.errorMessage = this.extractErrorMessage(error, 'No se pudo crear la cita.');
        },
      });
  }

  openCreateAppointmentModal(): void {
    this.clearMessages();
    this.isCreateAppointmentModalOpen = true;
  }

  closeCreateAppointmentModal(): void {
    if (this.isSubmittingAppointment) return;
    this.isCreateAppointmentModalOpen = false;
    this.resetCreateAppointmentForm();
  }

  startEdit(appointment: Appointment): void {
    this.editId = appointment.id;
    this.editForm = {
      nombreCompleto: appointment.nombreCompleto,
      telefono: appointment.telefono,
      correo: appointment.correo || '',
      servicio: appointment.servicio,
      fechaCita: appointment.fechaCita,
      horaCita: appointment.horaCita,
      notas: appointment.notas || '',
      estado: appointment.estado,
    };
  }

  cancelEdit(): void {
    this.editId = null;
  }

  saveEdit(): void {
    if (!this.editId || this.isSavingAppointment) return;
    this.clearMessages();

    const payload = this.normalizeAppointmentPayload(this.editForm);
    const validationError = this.validateAppointmentPayload(payload, true);
    if (validationError) { this.errorMessage = validationError; return; }

    this.isSavingAppointment = true;
    this.appointmentService
      .updateAppointment(this.editId, payload)
      .pipe(finalize(() => (this.isSavingAppointment = false)))
      .subscribe({
        next: (updated) => {
          this.successMessage = 'Cita actualizada.';
          this.editId = null;
          if (!this.updateAppointmentInCurrentView(updated)) this.loadAppointments();
        },
        error: (error) => {
          this.errorMessage = this.extractErrorMessage(error, 'No se pudo actualizar la cita.');
        },
      });
  }

  openDeleteAppointment(appointment: Appointment): void {
    if (this.pendingAppointmentIds.has(appointment.id) || this.isConfirmingDelete) return;
    this.deleteTarget = {
      kind: 'appointment',
      id: appointment.id,
      label: `${appointment.nombreCompleto} - ${appointment.servicio}`,
    };
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  confirmDelete(): void {
    if (!this.deleteTarget || this.isConfirmingDelete) return;
    this.clearMessages();
    this.isConfirmingDelete = true;

    const appointmentId = this.deleteTarget.id;
    this.pendingAppointmentIds.add(appointmentId);

    this.appointmentService
      .deleteAppointment(appointmentId)
      .pipe(
        finalize(() => {
          this.pendingAppointmentIds.delete(appointmentId);
          this.isConfirmingDelete = false;
          this.deleteTarget = null;
        }),
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Cita eliminada.';
          if (!this.removeAppointmentFromCurrentView(appointmentId)) this.loadAppointments();
        },
        error: (error) => {
          this.errorMessage = this.extractErrorMessage(error, 'No se pudo eliminar la cita.');
        },
      });
  }

  isAppointmentPending(id: number): boolean {
    return this.pendingAppointmentIds.has(id);
  }

  get canSubmitAppointment(): boolean {
    return !this.validateAppointmentPayload(this.normalizeAppointmentPayload(this.createAppointmentForm), false);
  }

  get canSaveAppointmentEdit(): boolean {
    if (!this.editId) return false;
    return !this.validateAppointmentPayload(this.normalizeAppointmentPayload(this.editForm), true);
  }

  /* ═══════════════════════════════════════════════
   *  PRIVATE HELPERS
   * ═══════════════════════════════════════════════ */

  private normalizeAppointmentPayload<T extends {
    nombreCompleto: string; telefono: string; correo?: string;
    servicio: string; fechaCita: string; horaCita: string;
    notas?: string; estado?: string;
  }>(payload: T): T {
    return {
      ...payload,
      correo: payload.correo?.trim() ? payload.correo.trim() : undefined,
      notas: payload.notas?.trim() ? payload.notas.trim() : undefined,
    };
  }

  private validateAppointmentPayload(
    payload: { nombreCompleto: string; telefono: string; correo?: string; servicio: string; fechaCita: string; horaCita: string; notas?: string; estado?: string },
    requireEstado: boolean,
  ): string | null {
    if (!payload.nombreCompleto?.trim()) return 'El nombre completo es obligatorio.';
    if (!payload.telefono?.trim()) return 'El telefono es obligatorio.';
    if (!payload.servicio?.trim()) return 'El servicio es obligatorio.';
    if (!payload.fechaCita) return 'La fecha de la cita es obligatoria.';
    if (!payload.horaCita?.trim()) return 'La hora de la cita es obligatoria.';
    if (requireEstado && !payload.estado?.trim()) return 'Selecciona un estado para la cita.';
    if (payload.correo?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo.trim())) return 'Ingresa un correo valido.';
    return null;
  }

  private resetCreateAppointmentForm(): void {
    this.createAppointmentForm = { nombreCompleto: '', telefono: '', correo: '', servicio: '', fechaCita: '', horaCita: '', notas: '' };
  }

  private insertAppointmentInCurrentView(appointment: Appointment): boolean {
    const isFirstPage = (this.appointmentFilters.page ?? 1) === 1;
    const isDefaultSort = this.appointmentFilters.sortBy === 'creadoEn' && this.appointmentFilters.sortDir === 'DESC';
    const hasFilters = !!this.appointmentFilters.search || !!this.appointmentFilters.fecha || !!this.appointmentFilters.estado;
    if (!isFirstPage || !isDefaultSort || hasFilters) return false;

    this.appointments = [appointment, ...this.appointments].slice(0, this.appointmentFilters.limit ?? 10);
    this.totalAppointments += 1;
    this.appointmentTotalPages = Math.max(1, Math.ceil(this.totalAppointments / (this.appointmentFilters.limit ?? 10)));
    return true;
  }

  private updateAppointmentInCurrentView(appointment: Appointment): boolean {
    const index = this.appointments.findIndex((item) => item.id === appointment.id);
    if (index === -1) return false;
    this.appointments[index] = appointment;
    return true;
  }

  private removeAppointmentFromCurrentView(appointmentId: number): boolean {
    const next = this.appointments.filter((item) => item.id !== appointmentId);
    if (next.length === this.appointments.length) return false;
    this.appointments = next;
    this.totalAppointments = Math.max(0, this.totalAppointments - 1);
    this.appointmentTotalPages = Math.max(1, Math.ceil(this.totalAppointments / (this.appointmentFilters.limit ?? 10)));
    return this.appointments.length > 0 || this.totalAppointments === 0;
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const e = error as { error?: { message?: string | string[] } };
    const msg = e?.error?.message;
    return Array.isArray(msg) ? msg.join(' ') : msg || fallback;
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }
}
