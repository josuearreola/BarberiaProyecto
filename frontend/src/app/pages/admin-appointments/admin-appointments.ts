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
import {
  CreateUserPayload,
  UpdateUserPayload,
  UsersService,
} from '../../services/users.service';
import { AuthService } from '../../services/auth.service';
import { User, UserRole, UserStatus } from '../../models/user.model';

type AdminTab = 'appointments' | 'users';

type DeleteTarget = {
  kind: 'appointment' | 'user';
  id: number;
  label: string;
  nextStatus?: UserStatus;
};

@Component({
  selector: 'app-admin-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  users: User[] = [];
  userFilters: {
    search: string;
    role: UserRole | '';
    estado: UserStatus | '';
    sortBy: 'creadoEn' | 'usuario' | 'email' | 'role' | 'estado';
    sortDir: 'ASC' | 'DESC';
    page: number;
    limit: number;
  } = {
      search: '',
      role: '',
      estado: '',
      sortBy: 'creadoEn',
      sortDir: 'DESC',
      page: 1,
      limit: 10,
    };

  appointmentStatusOptions = ['pendiente', 'confirmada', 'completada', 'cancelada'];
  roleOptions: UserRole[] = ['admin', 'cliente'];
  userStatusOptions: UserStatus[] = ['activo', 'inactivo'];

  isLoading = false;
  isLoadingUsers = false;
  isSubmittingAppointment = false;
  isSubmittingUser = false;
  isSavingAppointment = false;
  isSavingUser = false;
  isConfirmingDelete = false;
  isCreateAppointmentModalOpen = false;
  isCreateUserModalOpen = false;
  errorMessage = '';
  successMessage = '';

  totalAppointments = 0;
  appointmentTotalPages = 1;
  totalUsers = 0;
  usersTotalPages = 1;

  editUserId: number | null = null;
  userEditForm: UpdateUserPayload = {};

  createUserForm: CreateUserPayload = {
    usuario: '',
    telefono: '',
    email: '',
    password: '',
    role: 'cliente',
    estado: 'activo',
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

  pendingUserIds = new Set<number>();
  pendingAppointmentIds = new Set<number>();
  loadedUsers = false;
  deleteTarget: DeleteTarget | null = null;

  constructor(
    private readonly appointmentService: AppointmentService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) { }

  ngOnInit(): void {
    this.loadAppointments();
  }

  setTab(tab: AdminTab): void {
    this.activeTab.set(tab);
    this.clearMessages();

    // Close all modals when switching tabs
    this.editId = null;
    this.editUserId = null;
    this.deleteTarget = null;
    this.isCreateAppointmentModalOpen = false;
    this.isCreateUserModalOpen = false;

    if (tab === 'users' && !this.loadedUsers) {
      this.loadUsers();
    }
  }

  onLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/login']);
      },
      error: () => {
        void this.router.navigate(['/login']);
      },
    });
  }

  loadAppointments(): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.appointmentService
      .getAppointments(this.appointmentFilters)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
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
    if (
      nextPage < 1 ||
      nextPage > this.appointmentTotalPages ||
      nextPage === this.appointmentFilters.page
    ) {
      return;
    }

    this.appointmentFilters.page = nextPage;
    this.loadAppointments();
  }

  createAppointment(): void {
    if (this.isSubmittingAppointment) {
      return;
    }

    this.clearMessages();
    const payload = this.normalizeAppointmentPayload(this.createAppointmentForm);
    const validationError = this.validateAppointmentPayload(payload, false);
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.isSubmittingAppointment = true;

    this.appointmentService
      .createAppointment(payload)
      .pipe(
        finalize(() => {
          this.isSubmittingAppointment = false;
        }),
      )
      .subscribe({
        next: (createdAppointment) => {
          this.successMessage = 'Cita creada correctamente.';
          this.resetCreateAppointmentForm();
          this.isCreateAppointmentModalOpen = false;

          if (!this.insertAppointmentInCurrentView(createdAppointment)) {
            this.loadAppointments();
          }
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
    if (this.isSubmittingAppointment) {
      return;
    }

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
    if (!this.editId || this.isSavingAppointment) {
      return;
    }

    this.clearMessages();
    const payload = this.normalizeAppointmentPayload(this.editForm);
    const validationError = this.validateAppointmentPayload(payload, true);
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }
    this.isSavingAppointment = true;

    this.appointmentService
      .updateAppointment(this.editId, payload)
      .pipe(
        finalize(() => {
          this.isSavingAppointment = false;
        }),
      )
      .subscribe({
        next: (updatedAppointment) => {
          this.successMessage = 'Cita actualizada.';
          this.editId = null;

          if (!this.updateAppointmentInCurrentView(updatedAppointment)) {
            this.loadAppointments();
          }
        },
        error: (error) => {
          this.errorMessage = this.extractErrorMessage(error, 'No se pudo actualizar la cita.');
        },
      });
  }

  openDeleteAppointment(appointment: Appointment): void {
    if (this.pendingAppointmentIds.has(appointment.id) || this.isConfirmingDelete) {
      return;
    }

    this.deleteTarget = {
      kind: 'appointment',
      id: appointment.id,
      label: `${appointment.nombreCompleto} - ${appointment.servicio}`,
    };
  }

  loadUsers(): void {
    if (this.isLoadingUsers) {
      return;
    }

    this.isLoadingUsers = true;
    this.errorMessage = '';

    this.usersService
      .getUsers(this.userFilters)
      .pipe(
        finalize(() => {
          this.isLoadingUsers = false;
        }),
      )
      .subscribe({
        next: (result) => {
          this.users = result.data;
          this.totalUsers = result.total;
          this.usersTotalPages = result.totalPages;
          this.userFilters.page = result.page;
          this.loadedUsers = true;
        },
        error: (error) => {
          this.errorMessage = this.extractErrorMessage(error, 'No se pudieron cargar los usuarios.');
        },
        complete: () => {
          // subscription complete
        },
      });
  }

  applyUserFilters(): void {
    this.userFilters.page = 1;
    this.loadUsers();
  }

  clearUserFilters(): void {
    this.userFilters = {
      search: '',
      role: '',
      estado: '',
      sortBy: 'creadoEn',
      sortDir: 'DESC',
      page: 1,
      limit: 10,
    };
    this.loadUsers();
  }

  changeUserPage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.usersTotalPages || nextPage === this.userFilters.page) {
      return;
    }

    this.userFilters.page = nextPage;
    this.loadUsers();
  }

  createUser(): void {
    if (this.isSubmittingUser) {
      return;
    }

    this.clearMessages();
    const validationError = this.validateCreateUserPayload(this.createUserForm);
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }
    this.isSubmittingUser = true;

    const payload: CreateUserPayload = {
      usuario: this.createUserForm.usuario.trim(),
      telefono: this.createUserForm.telefono.trim(),
      email: this.createUserForm.email.trim(),
      password: this.createUserForm.password.trim(),
      role: this.createUserForm.role,
      estado: this.createUserForm.estado,
    };

    this.usersService
      .createUser(payload)
      .pipe(
        finalize(() => {
          this.isSubmittingUser = false;
        }),
      )
      .subscribe({
        next: (createdUser) => {
          this.successMessage = 'Usuario creado.';
          this.resetCreateUserForm();
          this.isCreateUserModalOpen = false;

          if (!this.insertUserInCurrentView(createdUser)) {
            this.loadUsers();
          }
        },
        error: (error) => {
          this.errorMessage = this.extractErrorMessage(error, 'No se pudo crear el usuario.');
        },
      });
  }

  openCreateUserModal(): void {
    this.clearMessages();
    this.isCreateUserModalOpen = true;
  }

  closeCreateUserModal(): void {
    if (this.isSubmittingUser) {
      return;
    }

    this.isCreateUserModalOpen = false;
    this.resetCreateUserForm();
  }

  startUserEdit(user: User): void {
    this.editUserId = user.id;
    this.userEditForm = {
      usuario: user.usuario,
      telefono: user.telefono,
      email: user.email,
      role: user.role,
      estado: user.estado,
    };
  }

  cancelUserEdit(): void {
    this.editUserId = null;
    this.userEditForm = {};
  }

  saveUserEdit(): void {
    if (!this.editUserId || this.isSavingUser) {
      return;
    }

    this.clearMessages();
    const validationError = this.validateUpdateUserPayload(this.userEditForm);
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }
    this.isSavingUser = true;

    const payload: UpdateUserPayload = {
      usuario: this.userEditForm.usuario?.trim(),
      telefono: this.userEditForm.telefono?.trim(),
      email: this.userEditForm.email?.trim(),
      role: this.userEditForm.role,
      estado: this.userEditForm.estado,
    };

    this.usersService
      .updateUser(this.editUserId, payload)
      .pipe(
        finalize(() => {
          this.isSavingUser = false;
        }),
      )
      .subscribe({
        next: (updatedUser) => {
          this.successMessage = 'Usuario actualizado.';
          this.cancelUserEdit();

          if (!this.updateUserInCurrentView(updatedUser)) {
            this.loadUsers();
          }
        },
        error: (error) => {
          this.errorMessage = this.extractErrorMessage(error, 'No se pudo actualizar el usuario.');
        },
      });
  }

  openDeleteUser(user: User): void {
    if (this.pendingUserIds.has(user.id) || this.isConfirmingDelete) {
      return;
    }

    const nextStatus: UserStatus = user.estado === 'activo' ? 'inactivo' : 'activo';
    const actionLabel = nextStatus === 'inactivo' ? 'dar de baja' : 'reactivar';

    this.deleteTarget = {
      kind: 'user',
      id: user.id,
      label: `${actionLabel} a ${user.usuario}`,
      nextStatus,
    };
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  confirmDelete(): void {
    if (!this.deleteTarget || this.isConfirmingDelete) {
      return;
    }

    this.clearMessages();
    this.isConfirmingDelete = true;

    if (this.deleteTarget.kind === 'appointment') {
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
            if (!this.removeAppointmentFromCurrentView(appointmentId)) {
              this.loadAppointments();
            }
          },
          error: (error) => {
            this.errorMessage = this.extractErrorMessage(error, 'No se pudo eliminar la cita.');
          },
        });
      return;
    }

    const userId = this.deleteTarget.id;
    const nextStatus = this.deleteTarget.nextStatus;

    if (!nextStatus) {
      this.isConfirmingDelete = false;
      this.deleteTarget = null;
      this.errorMessage = 'No se pudo determinar el estado del usuario.';
      return;
    }

    this.pendingUserIds.add(userId);
    this.usersService
      .updateUser(userId, { estado: nextStatus })
      .pipe(
        finalize(() => {
          this.pendingUserIds.delete(userId);
          this.isConfirmingDelete = false;
          this.deleteTarget = null;
        }),
      )
      .subscribe({
        next: (updatedUser) => {
          this.successMessage =
            nextStatus === 'inactivo'
              ? 'Usuario dado de baja.'
              : 'Usuario reactivado.';

          if (!this.updateUserInCurrentView(updatedUser)) {
            this.loadUsers();
          }
        },
        error: (error) => {
          this.errorMessage = this.extractErrorMessage(error, 'No se pudo actualizar el estado del usuario.');
        },
      });
  }

  isAppointmentPending(id: number): boolean {
    return this.pendingAppointmentIds.has(id);
  }

  isUserPending(id: number): boolean {
    return this.pendingUserIds.has(id);
  }

  get canSubmitAppointment(): boolean {
    return !this.validateAppointmentPayload(
      this.normalizeAppointmentPayload(this.createAppointmentForm),
      false,
    );
  }

  get canSaveAppointmentEdit(): boolean {
    if (!this.editId) {
      return false;
    }

    return !this.validateAppointmentPayload(
      this.normalizeAppointmentPayload(this.editForm),
      true,
    );
  }

  get canSubmitUser(): boolean {
    return !this.validateCreateUserPayload(this.createUserForm);
  }

  get canSaveUserEdit(): boolean {
    if (!this.editUserId) {
      return false;
    }

    return !this.validateUpdateUserPayload(this.userEditForm);
  }

  private normalizeAppointmentPayload<T extends {
    nombreCompleto: string;
    telefono: string;
    correo?: string;
    servicio: string;
    fechaCita: string;
    horaCita: string;
    notas?: string;
    estado?: string;
  }>(payload: T): T {
    return {
      ...payload,
      correo: payload.correo?.trim() ? payload.correo.trim() : undefined,
      notas: payload.notas?.trim() ? payload.notas.trim() : undefined,
    };
  }

  private validateAppointmentPayload(
    payload: {
      nombreCompleto: string;
      telefono: string;
      correo?: string;
      servicio: string;
      fechaCita: string;
      horaCita: string;
      notas?: string;
      estado?: string;
    },
    requireEstado: boolean,
  ): string | null {
    if (!payload.nombreCompleto?.trim()) {
      return 'El nombre completo es obligatorio.';
    }

    if (!payload.telefono?.trim()) {
      return 'El telefono es obligatorio.';
    }

    if (!payload.servicio?.trim()) {
      return 'El servicio es obligatorio.';
    }

    if (!payload.fechaCita) {
      return 'La fecha de la cita es obligatoria.';
    }

    if (!payload.horaCita?.trim()) {
      return 'La hora de la cita es obligatoria.';
    }

    if (requireEstado && !payload.estado?.trim()) {
      return 'Selecciona un estado para la cita.';
    }

    if (payload.correo?.trim() && !this.isValidEmail(payload.correo.trim())) {
      return 'Ingresa un correo valido.';
    }

    return null;
  }

  private validateCreateUserPayload(payload: CreateUserPayload): string | null {
    if (!payload.usuario?.trim()) {
      return 'El usuario es obligatorio.';
    }

    if (!payload.telefono?.trim()) {
      return 'El telefono es obligatorio.';
    }

    if (!payload.email?.trim() || !this.isValidEmail(payload.email.trim())) {
      return 'Ingresa un email valido.';
    }

    if (!payload.password?.trim() || payload.password.trim().length < 6) {
      return 'La contrasena debe tener al menos 6 caracteres.';
    }

    if (!payload.role) {
      return 'Selecciona un rol.';
    }

    if (!payload.estado) {
      return 'Selecciona un estado.';
    }

    return null;
  }

  private validateUpdateUserPayload(payload: UpdateUserPayload): string | null {
    if (payload.email && !this.isValidEmail(payload.email.trim())) {
      return 'Ingresa un email valido.';
    }

    if (payload.telefono !== undefined && !payload.telefono.trim()) {
      return 'El telefono no puede estar vacio.';
    }

    if (payload.usuario !== undefined && !payload.usuario.trim()) {
      return 'El usuario no puede estar vacio.';
    }

    if (payload.estado !== undefined && !this.userStatusOptions.includes(payload.estado)) {
      return 'Selecciona un estado valido.';
    }

    return null;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private resetCreateAppointmentForm(): void {
    this.createAppointmentForm = {
      nombreCompleto: '',
      telefono: '',
      correo: '',
      servicio: '',
      fechaCita: '',
      horaCita: '',
      notas: '',
    };
  }

  private resetCreateUserForm(): void {
    this.createUserForm = {
      usuario: '',
      telefono: '',
      email: '',
      password: '',
      role: 'cliente',
      estado: 'activo',
    };
  }

  private insertAppointmentInCurrentView(appointment: Appointment): boolean {
    const isFirstPage = (this.appointmentFilters.page ?? 1) === 1;
    const isDefaultSort =
      this.appointmentFilters.sortBy === 'creadoEn' && this.appointmentFilters.sortDir === 'DESC';
    const hasFilters =
      !!this.appointmentFilters.search || !!this.appointmentFilters.fecha || !!this.appointmentFilters.estado;

    if (!isFirstPage || !isDefaultSort || hasFilters) {
      return false;
    }

    this.appointments = [appointment, ...this.appointments].slice(0, this.appointmentFilters.limit ?? 10);
    this.totalAppointments += 1;
    this.appointmentTotalPages = Math.max(
      1,
      Math.ceil(this.totalAppointments / (this.appointmentFilters.limit ?? 10)),
    );
    return true;
  }

  private updateAppointmentInCurrentView(appointment: Appointment): boolean {
    const index = this.appointments.findIndex((item) => item.id === appointment.id);
    if (index === -1) {
      return false;
    }

    this.appointments[index] = appointment;
    return true;
  }

  private removeAppointmentFromCurrentView(appointmentId: number): boolean {
    const next = this.appointments.filter((item) => item.id !== appointmentId);
    if (next.length === this.appointments.length) {
      return false;
    }

    this.appointments = next;
    this.totalAppointments = Math.max(0, this.totalAppointments - 1);
    this.appointmentTotalPages = Math.max(
      1,
      Math.ceil(this.totalAppointments / (this.appointmentFilters.limit ?? 10)),
    );

    return this.appointments.length > 0 || this.totalAppointments === 0;
  }

  private insertUserInCurrentView(user: User): boolean {
    const isFirstPage = this.userFilters.page === 1;
    const isDefaultSort = this.userFilters.sortBy === 'creadoEn' && this.userFilters.sortDir === 'DESC';
    const hasFilters = !!this.userFilters.search || !!this.userFilters.role || !!this.userFilters.estado;

    if (!isFirstPage || !isDefaultSort || hasFilters || !this.loadedUsers) {
      return false;
    }

    this.users = [user, ...this.users].slice(0, this.userFilters.limit);
    this.totalUsers += 1;
    this.usersTotalPages = Math.max(1, Math.ceil(this.totalUsers / this.userFilters.limit));
    return true;
  }

  private updateUserInCurrentView(user: User): boolean {
    const index = this.users.findIndex((item) => item.id === user.id);
    if (index === -1) {
      return false;
    }

    this.users[index] = user;
    return true;
  }

  private removeUserFromCurrentView(userId: number): boolean {
    const next = this.users.filter((item) => item.id !== userId);
    if (next.length === this.users.length) {
      return false;
    }

    this.users = next;
    this.totalUsers = Math.max(0, this.totalUsers - 1);
    this.usersTotalPages = Math.max(1, Math.ceil(this.totalUsers / this.userFilters.limit));
    return this.users.length > 0 || this.totalUsers === 0;
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const maybeError = error as { error?: { message?: string | string[] } };
    const message = maybeError?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }

    return message || fallback;
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }
}
