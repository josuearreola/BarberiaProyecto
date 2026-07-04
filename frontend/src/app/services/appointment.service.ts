import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AppointmentData {
  nombreCompleto: string;
  telefono: string;
  correo?: string;
  servicio: string;
  fechaCita: string;
  horaCita: string;
  notas?: string;
}

export interface Appointment extends AppointmentData {
  id: number;
  estado: string;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface AppointmentFilters {
  fecha?: string;
  estado?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private readonly apiUrl = `${environment.apiUrl}/appointments`;
  private readonly requestTimeoutMs = 6000;

  constructor(private readonly http: HttpClient) { }

  createAppointment(data: AppointmentData): Observable<Appointment> {
    return this.withTimeout(this.http.post<Appointment>(this.apiUrl, data));
  }

  getAllAppointments(): Observable<Appointment[]> {
    return this.withTimeout(this.http.get<Appointment[]>(this.apiUrl));
  }

  getAppointments(filters?: AppointmentFilters): Observable<PaginatedResult<Appointment>> {
    let params = new HttpParams();

    if (filters?.fecha) {
      params = params.set('fecha', filters.fecha);
    }

    if (filters?.estado) {
      params = params.set('estado', filters.estado);
    }

    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    if (filters?.sortBy) {
      params = params.set('sortBy', filters.sortBy);
    }

    if (filters?.sortDir) {
      params = params.set('sortDir', filters.sortDir);
    }

    if (filters?.page) {
      params = params.set('page', String(filters.page));
    }

    if (filters?.limit) {
      params = params.set('limit', String(filters.limit));
    }

    return this.withTimeout(
      this.http.get<PaginatedResult<Appointment>>(this.apiUrl, { params }),
    );
  }

  getAppointmentById(id: number): Observable<Appointment> {
    return this.withTimeout(this.http.get<Appointment>(`${this.apiUrl}/${id}`));
  }

  getAppointmentsByDate(fecha: string): Observable<Appointment[]> {
    return this.withTimeout(this.http.get<Appointment[]>(`${this.apiUrl}/fecha/${fecha}`));
  }

  updateAppointmentStatus(id: number, estado: string): Observable<Appointment> {
    return this.withTimeout(
      this.http.patch<Appointment>(`${this.apiUrl}/${id}/estado`, { estado }),
    );
  }

  updateAppointment(id: number, data: Partial<AppointmentData> & { estado?: string }): Observable<Appointment> {
    return this.withTimeout(this.http.patch<Appointment>(`${this.apiUrl}/${id}`, data));
  }

  deleteAppointment(id: number): Observable<void> {
    return this.withTimeout(this.http.delete<void>(`${this.apiUrl}/${id}`));
  }

  private withTimeout<T>(observable: Observable<T>): Observable<T> {
    return observable.pipe(timeout(this.requestTimeoutMs));
  }
}