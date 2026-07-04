import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
    selector: 'app-services',
    imports: [],
    templateUrl: './services.html',
    styleUrl: './services.css',
})
export class Services {
    private readonly platformId = inject(PLATFORM_ID);

    services = [
        {
            id: 1,
            name: 'Corte Clásico',
            price: 15,
            duration: 30,
            description: 'Corte de cabello tradicional con tijeras y máquina, adaptado a tu estilo personal.',
            image: '/corteClasico.png',
            icon: 'scissors'
        },
        {
            id: 2,
            name: 'Corte Premium',
            price: 25,
            duration: 45,
            description: 'Corte moderno con técnicas avanzadas; incluye lavado y acabado profesional.',
            image: '/cortePremium.png',
            icon: 'star'
        },
        {
            id: 3,
            name: 'Arreglo de Barba',
            price: 12,
            duration: 25,
            description: 'Perfilado, recorte y diseño de barba con toalla caliente y productos premium.',
            image: '/arregloBarba.png',
            icon: 'beard'
        },
        {
            id: 4,
            name: 'Paquete Completo',
            price: 35,
            duration: 60,
            description: 'Corte premium + arreglo de barba + tratamiento capilar. La experiencia completa.',
            image: '/paqueteCompleto.jpg',
            icon: 'crown'
        }
    ];

    stats = [
        {
            number: '10+',
            label: 'Años de Experiencia',
            color: '#ff9800'
        },
        {
            number: '5000+',
            label: 'Clientes Satisfechos',
            color: '#ff9800'
        },
        {
            number: '4.9★',
            label: 'Calificación Promedio',
            color: '#ff9800'
        }
    ];

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
}