import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService } from '../../services/users.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-roles.html',
  styleUrl: './admin-roles.css'
})
export class AdminRoles implements OnInit {
  permissionsMap = signal<Record<string, string[]>>({});
  roles = ['admin', 'cliente'];
  
  permissionTranslations: Record<string, string> = {
    'manage_users': 'Gestionar Usuarios',
    'manage_roles': 'Gestionar Roles y Permisos',
    'view_audit_logs': 'Ver Bitácora de Auditoría',
    'manage_appointments': 'Gestionar Citas',
    'edit_own_profile': 'Editar Perfil Propio'
  };

  translatePermission(permission: string): string {
    return this.permissionTranslations[permission] || permission;
  }
  
  // Para agregar nuevos permisos
  newPermissionRole = 'admin';
  newPermissionName = '';

  successMessage = signal('');
  errorMessage = signal('');

  constructor(private readonly usersService: UsersService) {}

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    this.usersService.getPermissionsMap().pipe(
      catchError((err) => {
        this.errorMessage.set('Error al cargar la matriz de permisos.');
        return of({});
      })
    ).subscribe((map) => {
      this.permissionsMap.set(map);
    });
  }

  addPermission(): void {
    this.successMessage.set('');
    this.errorMessage.set('');

    const role = this.newPermissionRole;
    const permission = this.newPermissionName.trim().toLowerCase();

    if (!permission) {
      this.errorMessage.set('El nombre del permiso es requerido.');
      return;
    }

    this.usersService.addPermission(role, permission).pipe(
      catchError((err) => {
        this.errorMessage.set('No se pudo añadir el permiso.');
        return of(null);
      })
    ).subscribe((res) => {
      if (res) {
        this.successMessage.set(`Permiso '${permission}' añadido al rol '${role}' con éxito.`);
        this.newPermissionName = '';
        this.loadPermissions();
      }
    });
  }

  removePermission(role: string, permission: string): void {
    if (!confirm(`¿Estás seguro de quitar el permiso '${permission}' al rol '${role}'?`)) {
      return;
    }

    this.successMessage.set('');
    this.errorMessage.set('');

    this.usersService.removePermission(role, permission).pipe(
      catchError((err) => {
        this.errorMessage.set('No se pudo remover el permiso.');
        return of(null);
      })
    ).subscribe((res) => {
      if (res) {
        this.successMessage.set(`Permiso '${permission}' removido del rol '${role}'.`);
        this.loadPermissions();
      }
    });
  }

  getPermissionsForRole(role: string): string[] {
    return this.permissionsMap()[role] || [];
  }
}
