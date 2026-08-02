import { Component, HostListener, OnInit, OnDestroy, LOCALE_ID } from '@angular/core';
import { CommonModule, DatePipe, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { io, Socket } from 'socket.io-client';

registerLocaleData(localeEs, 'es');

interface Turn {
  id: number;
  client: string;
  status: string;
  time: string;
  date: string;
  isPast?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  providers: [
    DatePipe,
    { provide: LOCALE_ID, useValue: 'es' }
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  // Estado 10-foot UI
  focusedIndex = 0; // 0: Turnos, 1: Servicios, 2: Promos, 3: Galería
  currentTime: Date = new Date();
  backgroundMedia = 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop';
  
  // Datos Reales
  turns: Turn[] = [];
  servicios: any[] = [];
  promociones: any[] = [];
  socket: Socket | undefined;
  timer: any;

  constructor(private datePipe: DatePipe) {}

  ngOnInit() {
    // Reloj
    this.timer = setInterval(() => {
      this.currentTime = new Date();
      // Evaluar si los turnos ya pasaron
      this.turns.forEach(turn => {
        if (turn.date && turn.time) {
          const dateParts = turn.date.split('-');
          const timeParts = turn.time.split(':');
          if (dateParts.length === 3 && timeParts.length >= 2) {
            const turnDate = new Date(
              parseInt(dateParts[0]), 
              parseInt(dateParts[1]) - 1, 
              parseInt(dateParts[2]), 
              parseInt(timeParts[0]), 
              parseInt(timeParts[1])
            );
            turn.isPast = turnDate < this.currentTime;
          }
        }
      });
    }, 1000);

    // Cargar citas existentes de HOY desde la API
    this.loadTodayAppointments();
    // Cargar servicios y promociones desde la API
    this.loadServicios();
    this.loadPromociones();

    // Socket
    this.socket = io('https://barberiaproyecto-f2wb.onrender.com', {
      transports: ['websocket'],
    });

    this.socket.on('new_appointment_broadcast', (data: any) => {
      // Agregamos como turno en espera
      const newTurn: Turn = {
        id: data?.id || this.turns.length + 1,
        client: data?.client || 'Cliente (Privado)',
        status: data?.status || 'En Espera',
        time: data?.time || this.datePipe.transform(new Date(), 'HH:mm') || '12:00',
        date: data?.date ? data.date.split('T')[0] : this.datePipe.transform(new Date(), 'yyyy-MM-dd') || '2026-08-02'
      };
      
      // Evitar duplicados (por si llega dos veces)
      if (!this.turns.find(t => t.id === newTurn.id)) {
        this.turns = [newTurn, ...this.turns].slice(0, 10);
      }
    });

    this.socket.on('cancel_appointment_broadcast', (data: any) => {
      if (data?.id) {
        this.turns = this.turns.filter(t => t.id !== data.id);
      }
    });
  }

  loadTodayAppointments() {
    const today = this.datePipe.transform(new Date(), 'yyyy-MM-dd') || '';
    fetch(`https://barberiaproyecto-f2wb.onrender.com/api/appointments/by-date/${today}`)
      .then(res => res.json())
      .then((appointments: any[]) => {
        const newTurns: Turn[] = appointments
          .filter((a: any) => a.estado === 'pendiente' || a.estado === 'confirmada')
          .map((a: any) => ({
            id: a.id,
            client: a.nombreCompleto || 'Cliente',
            status: a.estado === 'pendiente' ? 'pendiente' : 'confirmada',
            time: a.horaCita || '00:00',
            date: a.fechaCita ? a.fechaCita.split('T')[0] : today
          }));
        // Combinar con los que ya existan por socket, sin duplicar
        const existingIds = new Set(this.turns.map(t => t.id));
        for (const t of newTurns) {
          if (!existingIds.has(t.id)) {
            this.turns.push(t);
          }
        }
        // Ordenar por hora
        this.turns.sort((a, b) => a.time.localeCompare(b.time));
      })
      .catch(err => console.warn('Error cargando citas del día:', err));
  }

  loadServicios() {
    fetch('https://barberiaproyecto-f2wb.onrender.com/api/servicios')
      .then(res => res.json())
      .then((data: any[]) => {
        this.servicios = data;
      })
      .catch(err => console.warn('Error cargando servicios:', err));
  }

  loadPromociones() {
    fetch('https://barberiaproyecto-f2wb.onrender.com/api/promociones')
      .then(res => res.json())
      .then((data: any[]) => {
        this.promociones = data;
      })
      .catch(err => console.warn('Error cargando promociones:', err));
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.socket?.disconnect();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp':
        if (this.focusedIndex > 1) this.focusedIndex -= 2;
        break;
      case 'ArrowDown':
        if (this.focusedIndex < 2) this.focusedIndex += 2;
        break;
      case 'ArrowLeft':
        if (this.focusedIndex % 2 !== 0) this.focusedIndex -= 1;
        break;
      case 'ArrowRight':
        if (this.focusedIndex % 2 === 0) this.focusedIndex += 1;
        break;
      case 'Enter':
        this.updateBackground();
        break;
    }
  }

  updateBackground() {
    // Cambia el multimedia contextual al seleccionar (Enter) (SA.2.C)
    switch(this.focusedIndex) {
      case 0:
        this.backgroundMedia = 'assets/bg-turnos.jpg';
        break;
      case 1:
        this.backgroundMedia = 'assets/bg-servicios.jpg';
        break;
      case 2:
        this.backgroundMedia = 'assets/bg-promos.jpg';
        break;
      case 3:
        this.backgroundMedia = 'assets/bg-galeria.jpg';
        break;
    }
  }
}
