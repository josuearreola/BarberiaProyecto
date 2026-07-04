import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppointmentService } from '../../services/appointment.service';

@Component({
    selector: 'app-booking',
    imports: [FormsModule],
    templateUrl: './booking.html',
    styleUrl: './booking.css',
})
export class Booking {



    private readonly appointmentsStorageKey = 'dom_demo_appointments';
    private editingAppointmentId: string | null = null;

    bookingForm = {
        fullName: '',
        phone: '',
        email: '',
        service: '',
        date: '',
        time: ''
    };

    isSubmitting = signal(false);
    submitMessage = signal('');
    submitError = signal(false);
    submitted = signal(false);

    services = [
        { name: 'Corte Clásico', price: 15 },
        { name: 'Corte Premium', price: 25 },
        { name: 'Arreglo de Barba', price: 12 },
        { name: 'Paquete Completo', price: 35 }
    ];

    // All time slots in 24h format for internal logic
    allTimeSlots = [
        { display: '9:00 AM', value: '09:00' },
        { display: '9:30 AM', value: '09:30' },
        { display: '10:00 AM', value: '10:00' },
        { display: '10:30 AM', value: '10:30' },
        { display: '11:00 AM', value: '11:00' },
        { display: '11:30 AM', value: '11:30' },
        { display: '12:00 PM', value: '12:00' },
        { display: '12:30 PM', value: '12:30' },
        { display: '1:00 PM', value: '13:00' },
        { display: '1:30 PM', value: '13:30' },
        { display: '2:00 PM', value: '14:00' },
        { display: '2:30 PM', value: '14:30' },
        { display: '3:00 PM', value: '15:00' },
        { display: '3:30 PM', value: '15:30' },
        { display: '4:00 PM', value: '16:00' },
        { display: '4:30 PM', value: '16:30' },
        { display: '5:00 PM', value: '17:00' },
        { display: '5:30 PM', value: '17:30' },
        { display: '6:00 PM', value: '18:00' },
        { display: '6:30 PM', value: '18:30' },
        { display: '7:00 PM', value: '19:00' },
        { display: '7:30 PM', value: '19:30' },
        { display: '8:00 PM', value: '20:00' }
    ];

    // Computed available slots based on selected date
    availableTimeSlots = computed(() => {
        const dateStr = this.bookingForm.date;
        if (!dateStr) return this.allTimeSlots.map(s => s.display);

        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();

        // 0 = Domingo, 1-5 = Lunes-Viernes, 6 = Sábado
        if (dayOfWeek === 0) {
            // Domingo: Cerrado
            return [];
        } else if (dayOfWeek === 6) {
            // Sábado: 9:00 AM - 7:00 PM (09:00 - 19:00)
            return this.allTimeSlots
                .filter(s => Number.parseInt(s.value) >= 9 && Number.parseInt(s.value) <= 19)
                .map(s => s.display);
        } else {
            // Lunes-Viernes: 9:00 AM - 8:00 PM (09:00 - 20:00)
            return this.allTimeSlots
                .filter(s => Number.parseInt(s.value) >= 9 && Number.parseInt(s.value) <= 20)
                .map(s => s.display);
        }
    });

    benefits = [
        {
            title: 'Barberos Certificados',
            description: 'Profesionales con más de 10 años de experiencia',
            icon: 'certificate'
        },
        {
            title: 'Productos Premium',
            description: 'Usamos solo las mejores marcas del mercado',
            icon: 'premium'
        },
        {
            title: 'Ambiente Exclusivo',
            description: 'Un lugar relajante y completamente renovado',
            icon: 'exclusive'
        },
        {
            title: 'Garantía de Satisfacción',
            description: 'Si no quedas contento, te arreglamos gratis',
            icon: 'guarantee'
        }
    ];

    schedule = [
        { day: 'Lunes - Viernes', hours: '9:00 AM - 8:00 PM' },
        { day: 'Sábados', hours: '9:00 AM - 7:00 PM' },
        { day: 'Domingos', hours: 'Cerrado', closed: true }
    ];



    private getAllLocalAppointments(): Array<{
        id: string;
        fullName: string;
        phone: string;
        email?: string;
        service: string;
        date: string;
        time: string;
    }> {
        try {
            const raw = localStorage.getItem(this.appointmentsStorageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }


    private saveLocalAppointments(items: Array<{ id: string; fullName: string; phone: string; email?: string; service: string; date: string; time: string }>): void {
        localStorage.setItem(this.appointmentsStorageKey, JSON.stringify(items));
    }

    ngOnInit(): void {
        this.renderAppointmentsGrid();
    }

    private renderAppointmentsGrid(): void {
        const grid = document.getElementById('client-appointments-grid');
        if (!grid) return;

        grid.innerHTML = '';

        const items = this.getAllLocalAppointments();

        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'appointments-empty';
            empty.textContent = 'Todavía no has creado reservas.';
            grid.appendChild(empty);
            return;
        }

        // Tabla
        const table = document.createElement('table');
        table.className = 'appointments-table';

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        [
            'Servicio',
            'Fecha',
            'Hora',
            'Acciones',
        ].forEach((h) => {
            const th = document.createElement('th');
            th.textContent = h;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);

        const tbody = document.createElement('tbody');

        items.forEach((item) => {
            const row = document.createElement('tr');


            const tdService = document.createElement('td');
            tdService.textContent = item.service;

            const tdDate = document.createElement('td');
            tdDate.textContent = item.date;

            const tdTime = document.createElement('td');
            tdTime.textContent = item.time;


            const tdActions = document.createElement('td');

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'appointments-action-btn edit';
            editBtn.textContent = 'Editar';
            editBtn.addEventListener('click', () => {
                this.editingAppointmentId = item.id;
                this.bookingForm.service = item.service;
                this.bookingForm.date = item.date;
                this.bookingForm.time = item.time;

                // Al recuperar la reserva, también rellenamos nombre/teléfono/email
                this.bookingForm.fullName = item.fullName ?? '';
                this.bookingForm.phone = item.phone ?? '';
                this.bookingForm.email = item.email ?? '';


                // Búsqueda/limpieza básica para que el usuario no se confunda
                this.submitMessage.set('');
                this.submitError.set(false);

                // Enfocar el formulario (opcional)
                const form = document.getElementById('booking-form');
                form?.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Re-render de la grilla para reflejar cualquier cambio
                this.renderAppointmentsGrid();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'appointments-action-btn delete';
            deleteBtn.textContent = 'Eliminar';
            deleteBtn.addEventListener('click', () => {
                const current = this.getAllLocalAppointments();
                const next = current.filter((x) => x.id !== item.id);
                this.saveLocalAppointments(next);
                if (this.editingAppointmentId === item.id) {
                    this.editingAppointmentId = null;
                }
                this.renderAppointmentsGrid();
            });

            tdActions.appendChild(editBtn);
            tdActions.appendChild(deleteBtn);

            // Para la tabla NO mostramos nombre/teléfono/email.
            // Se guardan en localStorage y se restauran al editar.
            row.appendChild(tdService);
            row.appendChild(tdDate);
            row.appendChild(tdTime);
            row.appendChild(tdActions);

            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        grid.appendChild(table);
    }


    onSubmit(): void {
        if (this.isSubmitting()) {
            return;
        }

        this.submitted.set(true);

        const validationError = this.getValidationError();
        if (validationError) {
            this.submitMessage.set(validationError);
            this.submitError.set(true);
            return;
        }

        this.isSubmitting.set(true);
        this.submitMessage.set('');
        this.submitError.set(false);

        const payload = {
            fullName: this.bookingForm.fullName,
            phone: this.bookingForm.phone,
            email: this.bookingForm.email || undefined,
            service: this.bookingForm.service,
            date: this.bookingForm.date,
            time: this.bookingForm.time,
        };

        // Actualizar o crear en localStorage
        const items = this.getAllLocalAppointments();

        if (this.editingAppointmentId) {
            const idx = items.findIndex((x) => x.id === this.editingAppointmentId);
            if (idx !== -1) {
                items[idx] = { ...items[idx], ...payload };
            }
            this.editingAppointmentId = null;
            this.submitMessage.set('✓ Cambios guardados en tu reserva.');
        } else {
            const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
            items.push({ id, ...payload });
            this.submitMessage.set('✓ ¡Reserva confirmada!');
        }

        this.saveLocalAppointments(items);

        // Reset formulario y re-render DOM
        this.resetForm();
        this.submitted.set(false);
        this.isSubmitting.set(false);

        this.renderAppointmentsGrid();

        setTimeout(() => {
            this.submitMessage.set('');
        }, 6000);
    }


    isFormValid(): boolean {
        return !this.getValidationError();
    }

    private getValidationError(): string | null {
        return (
            this.fullNameError ||
            this.phoneError ||
            this.emailError ||
            this.serviceError ||
            this.dateError ||
            this.timeError ||
            null
        );
    }

    get fullNameError(): string | null {
        const name = this.bookingForm.fullName.trim();
        if (!name) {
            return this.submitted() ? 'El nombre es requerido.' : null;
        }

        return name.length >= 3 ? null : 'Ingresa un nombre valido.';
    }

    get phoneError(): string | null {
        const phone = this.bookingForm.phone.trim();
        if (!phone) {
            return this.submitted() ? 'El telefono es requerido.' : null;
        }

        return /^[+\d\s()-]{7,20}$/.test(phone) ? null : 'Ingresa un telefono valido.';
    }

    get emailError(): string | null {
        const email = this.bookingForm.email.trim();
        if (!email) {
            return null;
        }

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ? null
            : 'Ingresa un email valido.';
    }

    get serviceError(): string | null {
        return this.bookingForm.service ? null : (this.submitted() ? 'Selecciona un servicio.' : null);
    }

    get dateError(): string | null {
        if (!this.bookingForm.date) {
            return this.submitted() ? 'Selecciona una fecha.' : null;
        }

        const selectedDate = new Date(this.bookingForm.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            return 'La fecha no puede ser en el pasado.';
        }

        // Check if it's Sunday
        if (selectedDate.getDay() === 0) {
            return 'No trabajamos domingos.';
        }

        return null;
    }

    get timeError(): string | null {
        if (!this.bookingForm.time) {
            return this.submitted() ? 'Selecciona una hora.' : null;
        }

        const availableSlots = this.availableTimeSlots();
        if (availableSlots.length === 0) {
            return 'No hay horarios disponibles para este día.';
        }

        return availableSlots.includes(this.bookingForm.time) ? null : 'Horario no disponible para este día.';
    }

    resetForm(): void {
        this.bookingForm = {
            fullName: '',
            phone: '',
            email: '',
            service: '',
            date: '',
            time: ''
        };
        // Reset submitted flag to clear validation messages after form reset
        this.submitted.set(false);
    }

    onDateChange(): void {
        // Reset time when date changes to prevent invalid time selections
        this.bookingForm.time = '';
    }
}