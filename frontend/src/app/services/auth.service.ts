import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, shareReplay, tap } from 'rxjs';
import { finalize, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from '../models/user.model';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  usuario: string;
  telefono: string;
  email: string;
  password: string;
}

export interface RegisterRequestResponse {
  ok: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly userSubject = new BehaviorSubject<User | null>(null);
  private hasResolvedSession = false;
  private activeSessionRequest$: Observable<User | null> | null = null;
  private readonly requestTimeoutMs = 15000;
  readonly user$ = this.userSubject.asObservable();

  constructor(private readonly http: HttpClient) { }

  loadSession(force = false): Observable<User | null> {
    if (!isPlatformBrowser(this.platformId)) {
      this.userSubject.next(null);
      this.hasResolvedSession = true;
      return of(null);
    }

    if (!force && this.hasResolvedSession) {
      return of(this.userSubject.value);
    }

    if (!force && this.activeSessionRequest$) {
      return this.activeSessionRequest$;
    }

    const request$ = this.http.get<User | null>(`${this.apiUrl}/me`).pipe(
      timeout(this.requestTimeoutMs),
      tap((user) => {
        this.userSubject.next(user);
        this.hasResolvedSession = true;
      }),
      catchError(() => {
        this.userSubject.next(null);
        this.hasResolvedSession = true;
        return of(null);
      }),
      finalize(() => {
        this.activeSessionRequest$ = null;
      }),
      shareReplay(1),
    );

    this.activeSessionRequest$ = request$;
    return request$;
  }

  login(payload: LoginPayload): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/login`, payload).pipe(
      timeout(this.requestTimeoutMs),
      tap((user) => {
        this.userSubject.next(user);
        this.hasResolvedSession = true;
      })
    );
  }

  register(payload: RegisterPayload): Observable<RegisterRequestResponse> {
    return this.http
      .post<RegisterRequestResponse>(`${this.apiUrl}/register`, payload)
      .pipe(
      timeout(this.requestTimeoutMs),
      tap(() => {
        // El registro ahora requiere confirmacion de email; no inicia sesion aqui.
        this.userSubject.next(null);
        this.hasResolvedSession = false;
      })
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout`, {}).pipe(
      timeout(this.requestTimeoutMs),
      tap(() => {
        this.userSubject.next(null);
        this.hasResolvedSession = true;
      })
    );
  }
}
