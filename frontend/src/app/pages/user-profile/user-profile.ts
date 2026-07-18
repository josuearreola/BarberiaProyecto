import { Component, OnInit, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css'
})
export class UserProfile implements OnInit {
  @Output() close = new EventEmitter<void>();
  currentUser = signal<User | null>(null);

  onClose(): void {
    this.close.emit();
  }
  
  // Formulario Perfil
  formUsuario = '';
  formTelefono = '';
  formEmail = '';

  // Formulario Contraseña
  contrasenaActual = '';
  contrasenaNueva = '';
  contrasenaNuevaConfirm = '';

  successMessage = signal('');
  errorMessage = signal('');

  successPasswordMessage = signal('');
  errorPasswordMessage = signal('');

  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.authService.user$.subscribe((user) => {
      if (user) {
        this.currentUser.set(user);
        this.formUsuario = user.usuario;
        this.formTelefono = user.telefono;
        this.formEmail = user.email;
      }
    });
  }

  updateProfile(): void {
    this.successMessage.set('');
    this.errorMessage.set('');

    const payload = {
      usuario: this.formUsuario.trim(),
      telefono: this.formTelefono.trim(),
      email: this.formEmail.trim()
    };

    if (!payload.usuario || !payload.telefono || !payload.email) {
      this.errorMessage.set('Todos los campos son obligatorios.');
      return;
    }

    this.authService.updateOwnProfile(payload).pipe(
      catchError((err) => {
        this.errorMessage.set(err.error?.message || 'Error al actualizar el perfil.');
        return of(null);
      })
    ).subscribe((res) => {
      if (res) {
        this.successMessage.set('Perfil actualizado correctamente.');
      }
    });
  }

  updatePassword(): void {
    this.successPasswordMessage.set('');
    this.errorPasswordMessage.set('');

    if (!this.contrasenaActual || !this.contrasenaNueva || !this.contrasenaNuevaConfirm) {
      this.errorPasswordMessage.set('Complete todos los campos de contraseña.');
      return;
    }

    if (this.contrasenaNueva !== this.contrasenaNuevaConfirm) {
      this.errorPasswordMessage.set('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    // Validar políticas de contraseña segura
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!regex.test(this.contrasenaNueva)) {
      this.errorPasswordMessage.set(
        'La contraseña debe tener al menos 8 caracteres, incluir una mayúscula, una minúscula, un número y un carácter especial.'
      );
      return;
    }

    this.authService.changeOwnPassword(this.contrasenaActual, this.contrasenaNueva).pipe(
      catchError((err) => {
        this.errorPasswordMessage.set(err.error?.message || 'Error al cambiar la contraseña.');
        return of(null);
      })
    ).subscribe((res) => {
      if (res) {
        this.successPasswordMessage.set('Contraseña cambiada con éxito.');
        this.contrasenaActual = '';
        this.contrasenaNueva = '';
        this.contrasenaNuevaConfirm = '';
      }
    });
  }
}
