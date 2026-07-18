import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService } from '../../services/users.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

export interface AuditLog {
  id: number;
  usuario: string;
  fecha: string;
  hora: string;
  ip: string;
  accion: string;
}

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-audit.html',
  styleUrl: './admin-audit.css'
})
export class AdminAudit implements OnInit {
  logs = signal<AuditLog[]>([]);
  totalLogs = signal(0);
  page = signal(1);
  limit = signal(10); // Mostar de 10 en 10
  search = signal(''); // Sistema de filtrado
  isLoading = signal(false);
  errorMessage = signal('');

  constructor(private readonly usersService: UsersService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.usersService.getAuditLogs(this.page(), this.limit(), this.search().trim()).pipe(
      catchError((err) => {
        this.errorMessage.set('Error al cargar la bitácora de auditoría.');
        return of({ data: [], total: 0 });
      }),
      finalize(() => this.isLoading.set(false))
    ).subscribe((res) => {
      this.logs.set(res.data);
      this.totalLogs.set(res.total);
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadLogs();
  }

  clearFilters(): void {
    this.search.set('');
    this.page.set(1);
    this.loadLogs();
  }

  get totalPages(): number {
    return Math.ceil(this.totalLogs() / this.limit());
  }

  changePage(dir: number): void {
    const next = this.page() + dir;
    if (next >= 1 && next <= this.totalPages) {
      this.page.set(next);
      this.loadLogs();
    }
  }
}
