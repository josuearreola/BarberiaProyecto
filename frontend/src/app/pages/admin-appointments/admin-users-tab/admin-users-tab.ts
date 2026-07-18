import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  UsersService,
  CreateUserPayload,
  UpdateUserPayload,
  PaginatedResult,
} from '../../../services/users.service';
import { User, UserRole, UserStatus } from '../../../models/user.model';

type ModalState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; userId: number }
  | { kind: 'password'; userId: number; userName: string }
  | { kind: 'confirm'; userId: number; label: string; nextStatus: UserStatus };

@Component({
  selector: 'app-admin-users-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users-tab.html',
  styleUrl: './admin-users-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersTab implements OnInit {
  /* ── State ── */
  readonly users = signal<User[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(1);
  readonly isLoading = signal(false);
  readonly isBusy = signal(false);
  readonly modal = signal<ModalState>({ kind: 'closed' });
  readonly errorMsg = signal('');
  readonly successMsg = signal('');

  /* ── Filters (writable signals for two-way binding via ngModel) ── */
  readonly search = signal('');
  readonly roleFilter = signal<UserRole | ''>('');
  readonly estadoFilter = signal<UserStatus | ''>('');
  readonly sortBy = signal<'creadoEn' | 'usuario' | 'email' | 'role' | 'estado'>('creadoEn');
  readonly sortDir = signal<'ASC' | 'DESC'>('DESC');
  readonly page = signal(1);
  readonly limit = signal(10);

  /* ── Computed ── */
  readonly isModalOpen = computed(() => this.modal().kind !== 'closed');
  readonly modalKind = computed(() => this.modal().kind);
  readonly confirmLabel = computed(() => {
    const m = this.modal();
    return m.kind === 'confirm' ? m.label : '';
  });

  /* ── Form state (plain objects — only used inside modals) ── */
  form: CreateUserPayload = this.emptyCreateForm();
  editForm: UpdateUserPayload = {};
  newPassword = '';

  /* ── Options ── */
  readonly roleOptions: UserRole[] = ['admin', 'cliente'];
  readonly statusOptions: UserStatus[] = ['activo', 'inactivo'];

  private readonly pendingIds = new Set<number>();

  constructor(private readonly usersService: UsersService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  /* ═══════════════════════════════════════════════
   *  DATA LOADING
   * ═══════════════════════════════════════════════ */

  loadUsers(): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.usersService
      .getUsers({
        search: this.search() || undefined,
        role: this.roleFilter() || undefined,
        estado: this.estadoFilter() || undefined,
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
        page: this.page(),
        limit: this.limit(),
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res: PaginatedResult<User>) => {
          this.users.set(res.data);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
          this.page.set(res.page);
        },
        error: (err) => {
          this.errorMsg.set(this.extractError(err, 'No se pudieron cargar los usuarios.'));
        },
      });
  }

  /* ═══════════════════════════════════════════════
   *  FILTERS
   * ═══════════════════════════════════════════════ */

  applyFilters(): void {
    this.page.set(1);
    this.loadUsers();
  }

  clearFilters(): void {
    this.search.set('');
    this.roleFilter.set('');
    this.estadoFilter.set('');
    this.sortBy.set('creadoEn');
    this.sortDir.set('DESC');
    this.page.set(1);
    this.limit.set(10);
    this.loadUsers();
  }

  changePage(next: number): void {
    if (next < 1 || next > this.totalPages() || next === this.page()) return;
    this.page.set(next);
    this.loadUsers();
  }

  /* ═══════════════════════════════════════════════
   *  MODAL OPENERS
   * ═══════════════════════════════════════════════ */

  openCreate(): void {
    this.clearMessages();
    this.form = this.emptyCreateForm();
    this.modal.set({ kind: 'create' });
  }

  openEdit(user: User): void {
    this.clearMessages();
    this.editForm = {
      usuario: user.usuario,
      telefono: user.telefono,
      email: user.email,
      role: user.role,
      estado: user.estado,
    };
    this.modal.set({ kind: 'edit', userId: user.id });
  }

  openPassword(user: User): void {
    this.clearMessages();
    this.newPassword = '';
    this.modal.set({ kind: 'password', userId: user.id, userName: user.usuario });
  }

  openToggle(user: User): void {
    if (this.pendingIds.has(user.id) || this.isBusy()) return;
    this.clearMessages();
    const nextStatus: UserStatus = user.estado === 'activo' ? 'inactivo' : 'activo';
    const action = nextStatus === 'inactivo' ? 'dar de baja' : 'reactivar';
    this.modal.set({
      kind: 'confirm',
      userId: user.id,
      label: `${action} a ${user.usuario}`,
      nextStatus,
    });
  }

  closeModal(): void {
    if (this.isBusy()) return;
    this.modal.set({ kind: 'closed' });
    this.errorMsg.set('');
  }

  /* ═══════════════════════════════════════════════
   *  CRUD ACTIONS
   * ═══════════════════════════════════════════════ */

  createUser(): void {
    if (this.isBusy()) return;
    this.clearMessages();

    const err = this.validateCreate(this.form);
    if (err) { this.errorMsg.set(err); return; }

    this.isBusy.set(true);
    const payload: CreateUserPayload = {
      usuario: this.form.usuario.trim(),
      telefono: this.form.telefono.trim(),
      email: this.form.email.trim(),
      password: this.form.password.trim(),
      role: this.form.role,
      estado: this.form.estado,
    };

    this.usersService.createUser(payload)
      .pipe(finalize(() => this.isBusy.set(false)))
      .subscribe({
        next: () => {
          this.successMsg.set('Usuario creado correctamente.');
          this.modal.set({ kind: 'closed' });
          this.loadUsers();
        },
        error: (e) => this.errorMsg.set(this.extractError(e, 'No se pudo crear el usuario.')),
      });
  }

  saveEdit(): void {
    const m = this.modal();
    if (m.kind !== 'edit' || this.isBusy()) return;
    this.clearMessages();

    const err = this.validateEdit(this.editForm);
    if (err) { this.errorMsg.set(err); return; }

    this.isBusy.set(true);
    const payload: UpdateUserPayload = {
      usuario: this.editForm.usuario?.trim(),
      telefono: this.editForm.telefono?.trim(),
      email: this.editForm.email?.trim(),
      role: this.editForm.role,
      estado: this.editForm.estado,
    };

    this.usersService.updateUser(m.userId, payload)
      .pipe(finalize(() => this.isBusy.set(false)))
      .subscribe({
        next: (updated) => {
          this.successMsg.set('Usuario actualizado.');
          this.modal.set({ kind: 'closed' });
          this.patchUserInPlace(updated);
        },
        error: (e) => this.errorMsg.set(this.extractError(e, 'No se pudo actualizar el usuario.')),
      });
  }

  changePassword(): void {
    const m = this.modal();
    if (m.kind !== 'password' || this.isBusy()) return;
    this.clearMessages();

    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!regex.test(this.newPassword)) {
      this.errorMsg.set('Mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 símbolo.');
      return;
    }

    this.isBusy.set(true);
    this.usersService.changePassword(m.userId, this.newPassword)
      .pipe(finalize(() => this.isBusy.set(false)))
      .subscribe({
        next: () => {
          this.successMsg.set('Contraseña actualizada correctamente.');
          this.modal.set({ kind: 'closed' });
        },
        error: (e) => this.errorMsg.set(this.extractError(e, 'No se pudo cambiar la contraseña.')),
      });
  }

  confirmToggle(): void {
    const m = this.modal();
    if (m.kind !== 'confirm' || this.isBusy()) return;
    this.clearMessages();
    this.isBusy.set(true);

    this.pendingIds.add(m.userId);

    this.usersService.updateUser(m.userId, { estado: m.nextStatus })
      .pipe(finalize(() => {
        this.pendingIds.delete(m.userId);
        this.isBusy.set(false);
        this.modal.set({ kind: 'closed' });
      }))
      .subscribe({
        next: (updated) => {
          this.successMsg.set(
            m.nextStatus === 'inactivo' ? 'Usuario dado de baja.' : 'Usuario reactivado.'
          );
          this.patchUserInPlace(updated);
        },
        error: (e) => this.errorMsg.set(this.extractError(e, 'No se pudo cambiar el estado.')),
      });
  }

  isPending(id: number): boolean {
    return this.pendingIds.has(id);
  }

  /* ═══════════════════════════════════════════════
   *  VALIDATION
   * ═══════════════════════════════════════════════ */

  get canCreate(): boolean {
    return !this.validateCreate(this.form);
  }

  get canSaveEdit(): boolean {
    return !this.validateEdit(this.editForm);
  }

  private validateCreate(f: CreateUserPayload): string | null {
    if (!f.usuario?.trim()) return 'El usuario es obligatorio.';
    if (!f.telefono?.trim()) return 'El teléfono es obligatorio.';
    if (!f.email?.trim() || !this.isEmail(f.email)) return 'Ingresa un email válido.';
    if (!f.password?.trim() || f.password.trim().length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!f.role) return 'Selecciona un rol.';
    if (!f.estado) return 'Selecciona un estado.';
    return null;
  }

  private validateEdit(f: UpdateUserPayload): string | null {
    if (f.usuario !== undefined && !f.usuario.trim()) return 'El usuario no puede estar vacío.';
    if (f.telefono !== undefined && !f.telefono.trim()) return 'El teléfono no puede estar vacío.';
    if (f.email && !this.isEmail(f.email.trim())) return 'Ingresa un email válido.';
    return null;
  }

  private isEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  /* ═══════════════════════════════════════════════
   *  HELPERS
   * ═══════════════════════════════════════════════ */

  /** Patch a user in-place to avoid a full reload */
  private patchUserInPlace(updated: User): void {
    const list = this.users();
    const idx = list.findIndex((u) => u.id === updated.id);
    if (idx !== -1) {
      const next = [...list];
      next[idx] = updated;
      this.users.set(next);
    } else {
      this.loadUsers();
    }
  }

  private emptyCreateForm(): CreateUserPayload {
    return { usuario: '', telefono: '', email: '', password: '', role: 'cliente', estado: 'activo' };
  }

  private extractError(error: unknown, fallback: string): string {
    const e = error as { error?: { message?: string | string[] } };
    const msg = e?.error?.message;
    return Array.isArray(msg) ? msg.join(' ') : msg || fallback;
  }

  private clearMessages(): void {
    this.errorMsg.set('');
    this.successMsg.set('');
  }
}
