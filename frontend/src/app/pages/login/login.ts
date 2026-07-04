import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { catchError, finalize, timeout } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email = '';
  password = '';
  errorMessage = signal('');
  isSubmitting = signal(false);
  submitted = signal(false);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.submitted.set(true);
    this.errorMessage.set('');

    const email = this.email.trim();
    const password = this.password.trim();

    if (this.emailError || this.passwordError) {
      return;
    }

    this.isSubmitting.set(true);

    this.authService
      .login({ email, password })
      .pipe(
        timeout(4000),
        catchError((error) => {
          const isTimeout = error?.name === 'TimeoutError';
          this.errorMessage.set(isTimeout
            ? 'Tiempo de espera agotado. Intenta de nuevo.'
            : 'Credenciales invalidas.');
          return of(null);
        }),
        finalize(() => {
          this.isSubmitting.set(false);
        })
      )
      .subscribe((user) => {
        if (!user) {
          if (!this.errorMessage()) {
            this.errorMessage.set('Credenciales invalidas.');
          }
          return;
        }

        const target = user.role === 'admin' ? '/admin' : '/';
        this.router.navigate([target]);
      });
  }

  onFieldInput(): void {
    if (this.errorMessage()) {
      this.errorMessage.set('');
    }
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
}
