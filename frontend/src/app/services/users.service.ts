import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User, UserRole, UserStatus } from '../models/user.model';

export interface UsersQuery {
  search?: string;
  role?: UserRole | '';
  estado?: UserStatus | '';
  sortBy?: 'creadoEn' | 'usuario' | 'email' | 'role' | 'estado';
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

export interface CreateUserPayload {
  usuario: string;
  telefono: string;
  email: string;
  password: string;
  role: UserRole;
  estado: UserStatus;
}

export interface UpdateUserPayload {
  usuario?: string;
  telefono?: string;
  email?: string;
  role?: UserRole;
  estado?: UserStatus;
}

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly apiUrl = `${environment.apiUrl}/users`;
  private readonly requestTimeoutMs = 6000;

  constructor(private readonly http: HttpClient) {}

  getUsers(query: UsersQuery): Observable<PaginatedResult<User>> {
    let params = new HttpParams();

    if (query.search) {
      params = params.set('search', query.search);
    }

    if (query.role) {
      params = params.set('role', query.role);
    }

    if (query.estado) {
      params = params.set('estado', query.estado);
    }

    if (query.sortBy) {
      params = params.set('sortBy', query.sortBy);
    }

    if (query.sortDir) {
      params = params.set('sortDir', query.sortDir);
    }

    if (query.page) {
      params = params.set('page', String(query.page));
    }

    if (query.limit) {
      params = params.set('limit', String(query.limit));
    }

    return this.withTimeout(
      this.http.get<PaginatedResult<User>>(this.apiUrl, { params }),
    );
  }

  createUser(payload: CreateUserPayload): Observable<User> {
    return this.withTimeout(this.http.post<User>(this.apiUrl, payload));
  }

  updateUser(userId: number, payload: UpdateUserPayload): Observable<User> {
    return this.withTimeout(this.http.patch<User>(`${this.apiUrl}/${userId}`, payload));
  }

  deleteUser(userId: number): Observable<void> {
    return this.withTimeout(this.http.delete<void>(`${this.apiUrl}/${userId}`));
  }

  private withTimeout<T>(observable: Observable<T>): Observable<T> {
    return observable.pipe(timeout(this.requestTimeoutMs));
  }
}
