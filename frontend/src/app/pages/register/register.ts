import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit {
  usuario = '';
  telefono = '';
  email = '';
  password = '';
  errorMessage = signal('');
  successMessage = signal('');
  isSubmitting = signal(false);
  submitted = signal(false);

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const verified = this.route.snapshot.queryParamMap.get('verified');
    if (verified === '0') {
      this.errorMessage.set(
        'El enlace de confirmacion es invalido, expiro o ya fue usado. Si ya confirmaste antes, inicia sesion.',
      );
      return;
    }

    if (verified === '1') {
      this.successMessage.set('Cuenta confirmada. Ya puedes iniciar sesion.');
    }
  }

  onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.submitted.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const usuario = this.usuario.trim();
    const telefono = this.telefono.trim();
    const email = this.email.trim();
    const password = this.password.trim();

    if (this.usuarioError || this.telefonoError || this.emailError || this.passwordError) {
      return;
    }

    this.isSubmitting.set(true);

    this.authService
      .register({
        usuario,
        telefono,
        email,
        password,
      })
      .pipe(
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            const backendMessage =
              (typeof error.error?.message === 'string' && error.error.message) ||
              (typeof error.error === 'string' && error.error) ||
              '';

            this.errorMessage.set(
              backendMessage ||
                'No se pudo iniciar el registro. Verifica tu conexion e intenta de nuevo.',
            );
          } else {
            this.errorMessage.set(
              'No se pudo iniciar el registro. Verifica tu conexion e intenta de nuevo.',
            );
          }

          return of(null);
        }),
        finalize(() => {
          this.isSubmitting.set(false);
        })
      )
      .subscribe((response) => {
        if (!response) {
          return;
        }

        this.usuario = '';
        this.telefono = '';
        this.email = '';
        this.password = '';
        this.submitted.set(false);
        // En modo local queremos que el registro se guarde directamente.
        // Se evita mostrar mensajes relacionados a confirmación por correo.
        this.successMessage.set(
          response.message ||
            'Cuenta creada correctamente. Ya puedes iniciar sesion.',
        );
      });
  }

  get usuarioError(): string | null {
    const value = this.usuario.trim();
    if (!value) {
      return this.submitted() ? 'El usuario es requerido.' : null;
    }

    return value.length >= 3 ? null : 'El usuario debe tener al menos 3 caracteres.';
  }

  get telefonoError(): string | null {
    const value = this.telefono.trim();
    if (!value) {
      return this.submitted() ? 'El telefono es requerido.' : null;
    }

    return this.isValidPhone(value) ? null : 'Ingresa un telefono valido.';
  }

  get emailError(): string | null {
    const value = this.email.trim();
    if (!value) {
      return this.submitted() ? 'El email es requerido.' : null;
    }

    return this.isValidEmail(value) ? null : 'Ingresa un email valido.';
  }

  get passwordError(): string | null {
    const value = this.password.trim();
    if (!value) {
      return this.submitted() ? 'La contrasena es requerida.' : null;
    }

    return value.length >= 6 ? null : 'La contrasena debe tener al menos 6 caracteres.';
  }

    private isValidEmail(value: string): boolean {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    private isValidPhone(value: string): boolean {
      return /^[+\d\s()-]{7,20}$/.test(value);
    }
}
