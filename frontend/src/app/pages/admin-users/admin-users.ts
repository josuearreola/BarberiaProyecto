import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UsersService, CreateUserPayload, UpdateUserPayload } from '../../services/users.service';
import { User, UserRole, UserStatus } from '../../models/user.model';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css'
})
export class AdminUsers implements OnInit {
  users = signal<User[]>([]);
  totalUsers = signal(0);
  page = signal(1);
  limit = signal(10);
  search = signal('');
  roleFilter = signal<UserRole | ''>('');
  estadoFilter = signal<UserStatus | ''>('');
  
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  // Modales y control de edición/creación
  showFormModal = signal(false);
  showPasswordModal = signal(false);
  isEditing = signal(false);
  selectedUserId = signal<number | null>(null);

  // Formulario de Usuario
  formUsuario = '';
  formTelefono = '';
  formEmail = '';
  formPassword = '';
  formRole: UserRole = 'cliente';
  formEstado: UserStatus = 'activo';

  // Formulario de contraseña
  newPassword = '';

  constructor(private readonly usersService: UsersService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.usersService.getUsers({
      search: this.search(),
      role: this.roleFilter() || undefined,
      estado: this.estadoFilter() || undefined,
      page: this.page(),
      limit: this.limit(),
      sortBy: 'creadoEn',
      sortDir: 'DESC'
    }).pipe(
      catchError((err) => {
        this.errorMessage.set('Error al cargar la lista de usuarios.');
        return of({ data: [], total: 0 });
      }),
      finalize(() => this.isLoading.set(false))
    ).subscribe((res) => {
      this.users.set(res.data);
      this.totalUsers.set(res.total);
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadUsers();
  }

  clearFilters(): void {
    this.search.set('');
    this.roleFilter.set('');
    this.estadoFilter.set('');
    this.page.set(1);
    this.loadUsers();
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.selectedUserId.set(null);
    this.formUsuario = '';
    this.formTelefono = '';
    this.formEmail = '';
    this.formPassword = '';
    this.formRole = 'cliente';
    this.formEstado = 'activo';
    this.showFormModal.set(true);
  }

  openEditModal(user: User): void {
    this.isEditing.set(true);
    this.selectedUserId.set(user.id);
    this.formUsuario = user.usuario;
    this.formTelefono = user.telefono;
    this.formEmail = user.email;
    this.formPassword = '';
    this.formRole = user.role;
    this.formEstado = user.estado;
    this.showFormModal.set(true);
  }

  openPasswordModal(user: User): void {
    this.selectedUserId.set(user.id);
    this.newPassword = '';
    this.showPasswordModal.set(true);
  }

  closeModals(): void {
    this.showFormModal.set(false);
    this.showPasswordModal.set(false);
    this.errorMessage.set('');
  }

  saveUser(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.isEditing()) {
      const payload: UpdateUserPayload = {
        usuario: this.formUsuario.trim(),
        telefono: this.formTelefono.trim(),
        email: this.formEmail.trim(),
        role: this.formRole,
        estado: this.formEstado
      };

      this.usersService.updateUser(this.selectedUserId()!, payload).pipe(
        catchError((err) => {
          this.errorMessage.set(err.error?.message || 'Error al actualizar el usuario.');
          return of(null);
        })
      ).subscribe((res) => {
        if (res) {
          this.successMessage.set('Usuario actualizado con éxito.');
          this.closeModals();
          this.loadUsers();
        }
      });
    } else {
      // Validar políticas de contraseña en creación
      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!regex.test(this.formPassword)) {
        this.errorMessage.set('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.');
        return;
      }

      const payload: CreateUserPayload = {
        usuario: this.formUsuario.trim(),
        telefono: this.formTelefono.trim(),
        email: this.formEmail.trim(),
        password: this.formPassword,
        role: this.formRole,
        estado: this.formEstado
      };

      this.usersService.createUser(payload).pipe(
        catchError((err) => {
          this.errorMessage.set(err.error?.message || 'Error al crear el usuario.');
          return of(null);
        })
      ).subscribe((res) => {
        if (res) {
          this.successMessage.set('Usuario creado con éxito.');
          this.closeModals();
          this.loadUsers();
        }
      });
    }
  }

  updatePassword(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!regex.test(this.newPassword)) {
      this.errorMessage.set('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.');
      return;
    }

    this.usersService.changePassword(this.selectedUserId()!, this.newPassword).pipe(
      catchError((err) => {
        this.errorMessage.set(err.error?.message || 'Error al cambiar la contraseña.');
        return of(null);
      })
    ).subscribe((res) => {
      if (res) {
        this.successMessage.set('Contraseña modificada con éxito.');
        this.closeModals();
      }
    });
  }

  toggleUserStatus(user: User): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    const newStatus = user.estado === 'activo' ? 'inactivo' : 'activo';

    this.usersService.updateUser(user.id, { estado: newStatus }).pipe(
      catchError((err) => {
        this.errorMessage.set('No se pudo cambiar el estado del usuario.');
        return of(null);
      })
    ).subscribe((res) => {
      if (res) {
        this.successMessage.set(`Usuario ${newStatus === 'activo' ? 'activado' : 'desactivado'} con éxito.`);
        this.loadUsers();
      }
    });
  }

  deleteUser(user: User): void {
    if (!confirm(`¿Estás seguro de eliminar lógicamente al usuario ${user.usuario}?`)) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');

    this.usersService.deleteUser(user.id).pipe(
      catchError((err) => {
        this.errorMessage.set('No se pudo eliminar al usuario.');
        return of(null);
      })
    ).subscribe(() => {
      this.successMessage.set('Usuario eliminado lógicamente (inactivado).');
      this.loadUsers();
    });
  }

  get totalPages(): number {
    return Math.ceil(this.totalUsers() / this.limit());
  }

  changePage(dir: number): void {
    const next = this.page() + dir;
    if (next >= 1 && next <= this.totalPages) {
      this.page.set(next);
      this.loadUsers();
    }
  }
}
