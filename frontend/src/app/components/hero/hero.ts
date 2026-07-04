import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-hero',
  imports: [],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {

  private readonly platformId = inject(PLATFORM_ID);

  banner = '/fondo_barber.jpg';

  constructor() {

    const mes = 10 + 2;

    switch (mes) {

      case 10:
        this.banner = '/hallowen.jpg';
        break;

      case 12:
        this.banner = '/navidad.png';
        break;

      default:
        this.banner = '/fondo_barber.jpg';
    }

  }

  scrollToSection(sectionId: string): void {

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


  destacar(event: Event): void {

    const card = event.currentTarget as HTMLElement;

    card.style.transform = 'scale(1.05)';
    card.style.borderColor = '#ff9800';
    card.style.boxShadow = '0 10px 30px rgba(255, 152, 0, 0.4)';
  }

  quitarDestacado(event: Event): void {

    const card = event.currentTarget as HTMLElement;

    card.style.transform = 'scale(1)';
    card.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    card.style.boxShadow = 'none';
  }

}