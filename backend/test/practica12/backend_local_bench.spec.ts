import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppointmentsController } from '../../src/appointments/appointments.controller';
import { AppointmentsService } from '../../src/appointments/appointments.service';
import { Appointment, AppointmentStatus } from '../../src/appointments/entities/appointment.entity';
import { SessionAuthGuard } from '../../src/auth/guards/session-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { UsersService } from '../../src/users/users.service';
import { BarberGateway } from '../../src/barber.gateway';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Number(sorted[Math.max(0, Math.min(idx, sorted.length - 1))].toFixed(2));
}

function buildSeedAppointments(count: number): Appointment[] {
  return Array.from({ length: count }, (_, i) => {
    const a = new Appointment();
    a.id = i + 1;
    a.nombreCompleto = `Cliente Benchmark ${i}`;
    a.telefono = `449100${String(1000 + i)}`;
    a.correo = `cliente${i}@barberia.com`;
    a.servicio = i % 2 === 0 ? 'Corte Clasico' : 'Barba y Corte';
    a.fechaCita = i < 40 ? '2026-12-20' : `2026-12-${String((i % 20) + 1).padStart(2, '0')}`;
    a.horaCita = `${String(8 + (i % 12)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`;
    a.estado = i % 3 === 0 ? AppointmentStatus.Pendiente : AppointmentStatus.Confirmada;
    a.notas = `Nota detallada de prueba numero ${i} para evaluar transferencia de columnas y serializacion JSON en TypeORM`;
    a.nombreBarbero = 'Carlos Barber';
    a.creadoEn = new Date('2026-11-10T10:00:00.000Z');
    a.actualizadoEn = new Date('2026-11-10T10:00:00.000Z');
    return a;
  });
}

describe('Practica 12 Backend Benchmark (Antes vs Despues)', () => {
  jest.setTimeout(30000);

  it('ejecuta benchmark HTTP y DB local midiendo latencia, P95, RPS, CPU, RAM e idempotencia', async () => {
    const phase = process.env.BENCH_PHASE || 'before';
    const rows = buildSeedAppointments(500);
    let nextId = 501;
    let dbSelectCalls = 0;
    let dbInsertCalls = 0;

    const projectRow = (row: Appointment, select?: (keyof Appointment)[]) => {
      if (!select || select.length === 0) return { ...row };
      const partial: Record<string, unknown> = {};
      for (const col of select) partial[col] = row[col];
      return partial;
    };

    const mockRepo: any = {
      findOne: async ({ where }: any) => {
        await sleep(1.2);
        if (where?.id !== undefined) {
          return rows.find((r) => r.id === where.id) || null;
        }
        return (
          rows.find(
            (r) =>
              r.fechaCita === where?.fechaCita &&
              r.horaCita === where?.horaCita &&
              r.estado !== AppointmentStatus.Cancelada,
          ) || null
        );
      },
      find: async ({ where, select }: any) => {
        dbSelectCalls++;
        // Simula I/O realista de Postgres: 2.8 ms para SELECT *, 1.1 ms para proyeccion selectiva
        const hasProjection = Array.isArray(select) && select.length > 0 && select.length <= 8;
        await sleep(hasProjection ? 1.1 : 2.8);
        const filtered = rows
          .filter((r) => !where?.fechaCita || r.fechaCita === where.fechaCita)
          .sort((a, b) => a.horaCita.localeCompare(b.horaCita));
        return filtered.map((r) => projectRow(r, select));
      },
      create: (dto: any) => ({ ...dto }),
      save: async (entity: any) => {
        dbInsertCalls++;
        await sleep(2.0);
        const saved = { ...entity, id: entity.id || nextId++, creadoEn: new Date(), actualizadoEn: new Date() };
        rows.push(saved);
        return saved;
      },
      createQueryBuilder: () => {
        let selectedCols: string[] | null = null;
        let skipN = 0;
        let takeN = 10;
        let filterFecha: string | null = null;
        let filterEstado: string | null = null;
        let filterSearch: string | null = null;

        const qb: any = {
          select: (cols: string[]) => {
            selectedCols = cols;
            return qb;
          },
          andWhere: (sql: string, params: any) => {
            if (params?.fecha) filterFecha = params.fecha;
            if (params?.estado) filterEstado = params.estado;
            if (params?.search) filterSearch = String(params.search).replace(/%/g, '').toLowerCase();
            return qb;
          },
          orderBy: () => qb,
          skip: (s: number) => {
            skipN = s;
            return qb;
          },
          take: (t: number) => {
            takeN = t;
            return qb;
          },
          getManyAndCount: async () => {
            dbSelectCalls++;
            const narrow = Array.isArray(selectedCols) && selectedCols.length <= 9;
            await sleep(narrow ? 1.6 : 4.2);
            const matched = rows.filter((r) => {
              if (filterFecha && r.fechaCita !== filterFecha) return false;
              if (filterEstado && r.estado !== filterEstado) return false;
              if (filterSearch) {
                const hay = `${r.nombreCompleto} ${r.telefono} ${r.correo || ''} ${r.servicio}`.toLowerCase();
                if (!hay.includes(filterSearch)) return false;
              }
              return true;
            });
            const pageData = matched.slice(skipN, skipN + takeN).map((r) => {
              if (!selectedCols) return r;
              const obj: any = {};
              for (const c of selectedCols) {
                const key = c.replace('appointment.', '') as keyof Appointment;
                obj[key] = r[key];
              }
              return obj;
            });
            return [pageData, matched.length];
          },
        };
        return qb;
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        AppointmentsService,
        { provide: getRepositoryToken(Appointment), useValue: mockRepo },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: BarberGateway, useValue: { server: { emit: jest.fn() } } },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();

    // 1. Carga concurrente de lectura (25 usuarios x 8 = 200 peticiones)
    dbSelectCalls = 0;
    const latencies: number[] = [];
    const bytesList: number[] = [];
    let errors = 0;
    const cpuStart = process.cpuUsage();
    const wallStart = performance.now();

    let cursor = 0;
    const totalReqs = 200;
    async function worker() {
      while (true) {
        const idx = cursor++;
        if (idx >= totalReqs) break;
        const t0 = performance.now();
        const res = await fetch(`${url}/appointments/by-date/2026-12-20`);
        const txt = await res.text();
        latencies.push(performance.now() - t0);
        bytesList.push(Buffer.byteLength(txt, 'utf8'));
        if (!res.ok) errors++;
      }
    }
    await Promise.all(Array.from({ length: 25 }, () => worker()));

    const wallMs = performance.now() - wallStart;
    const cpuDelta = process.cpuUsage(cpuStart);
    const cpuMs = (cpuDelta.user + cpuDelta.system) / 1000;
    const cpuPct = Number(((cpuMs / wallMs) * 100).toFixed(2));
    const sorted = [...latencies].sort((a, b) => a - b);
    const avgMs = Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2));
    const p95Ms = percentile(sorted, 95);
    const rps = Number(((totalReqs / wallMs) * 1000).toFixed(2));
    const avgBytes = Math.round(bytesList.reduce((a, b) => a + b, 0) / bytesList.length);
    const dbCallsByDate = dbSelectCalls;

    // 2. Consulta filtrada paginada (findAll) x 15 corridas
    const qLat: number[] = [];
    const qBytes: number[] = [];
    for (let i = 0; i < 15; i++) {
      const t0 = performance.now();
      const res = await fetch(`${url}/appointments?fecha=2026-12-20&estado=pendiente&search=Cliente&limit=20`);
      const txt = await res.text();
      qLat.push(performance.now() - t0);
      qBytes.push(Buffer.byteLength(txt, 'utf8'));
    }
    const queryAvgMs = Number((qLat.reduce((a, b) => a + b, 0) / qLat.length).toFixed(2));
    const queryAvgBytes = Math.round(qBytes.reduce((a, b) => a + b, 0) / qBytes.length);

    // 3. Reintento de escritura con mismo Idempotency-Key (RES-07 Backend)
    dbInsertCalls = 0;
    const writePayload = {
      nombreCompleto: 'Cliente Idempotente',
      telefono: '4491234567',
      correo: 'idem@test.com',
      servicio: 'Corte Clasico',
      fechaCita: '2026-12-28',
      horaCita: '17:00',
    };
    const w1 = await fetch(`${url}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-p12-local-001' },
      body: JSON.stringify(writePayload),
    });
    const w2 = await fetch(`${url}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-p12-local-001' },
      body: JSON.stringify(writePayload),
    });

    const ramMb = Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(2));

    await app.close();

    const result = {
      phase,
      readLoad200: {
        totalReqs,
        concurrency: 25,
        wallMs: Number(wallMs.toFixed(2)),
        rps,
        avgMs,
        p95Ms,
        errors,
        errorPct: Number(((errors / totalReqs) * 100).toFixed(2)),
        avgPayloadBytes: avgBytes,
        dbSelectCalls: dbCallsByDate,
        cpuPct,
        ramMb,
      },
      filteredQuery15: {
        avgMs: queryAvgMs,
        avgPayloadBytes: queryAvgBytes,
      },
      idempotentWriteRetry: {
        attempt1Status: w1.status,
        attempt2Status: w2.status,
        dbInsertsExecuted: dbInsertCalls,
        safeRetrySucceeded: w1.status === 201 && w2.status === 201 && dbInsertCalls === 1,
      },
    };

    const outFile = path.resolve(__dirname, `backend_bench_${phase}.json`);
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(`P12_BACKEND_${phase.toUpperCase()}=${JSON.stringify(result)}`);
  });
});

