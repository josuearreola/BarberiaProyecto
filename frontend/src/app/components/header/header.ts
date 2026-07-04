import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-header',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {

  searchQuery: string = '';

  // NUEVO
  showServicesMenu = false;

  readonly user$: Observable<User | null>;
  private readonly platformId = inject(PLATFORM_ID);

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {
    this.user$ = this.authService.user$;
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  private readonly searchableSections = [
    { id: 'inicio', keywords: ['inicio', 'principal'] },
    { id: 'servicios', keywords: ['servicios', 'cortes', 'barba', 'afeitado', 'services'] },
    { id: 'agendar', keywords: ['agendar', 'cita', 'reservar', 'appointment', 'reserva'] },
    { id: 'galeria', keywords: ['galeria'] }
  ];

  onLogout(user: User | null): void {
    if (!user) {
      return;
    }

    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/']);
      },
      error: () => {
        void this.router.navigate(['/']);
      },
    });
  }

  onSearch(): void {
    if (this.searchQuery.length < 2) return;

    const query = this.searchQuery.toLowerCase().trim();

    const foundSection = this.searchableSections.find(section =>
      section.keywords.some(keyword => keyword.includes(query))
    );

    if (foundSection) {
      this.scrollToSection(foundSection.id);
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  private scrollToSection(sectionId: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const element = document.getElementById(sectionId);

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }
}