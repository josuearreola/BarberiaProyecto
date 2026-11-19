import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const API_BASE = 'https://barberiaproyecto-f2wb.onrender.com/api';
const WEB_URL = 'https://barberia-proyecto-nine.vercel.app';
const ADMIN_EMAIL = 'Admin1@gmail.com';
const ADMIN_PASS = 'Adminis1!';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return 0;
  const idx = Math.ceil((p / 100) * sortedAsc.length) - 1;
  return Number(sortedAsc[Math.max(0, Math.min(idx, sortedAsc.length - 1))].toFixed(2));
}

function summarize(latencies, totalElapsedMs, statusMap, errCount, bytesList = []) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sorted.length ? Number((sum / sorted.length).toFixed(2)) : 0;
  const min = sorted.length ? Number(sorted[0].toFixed(2)) : 0;
  const max = sorted.length ? Number(sorted[sorted.length - 1].toFixed(2)) : 0;
  const p90 = percentile(sorted, 90);
  const p95 = percentile(sorted, 95);
  const totalReqs = latencies.length;
  const rps = totalElapsedMs > 0 ? Number(((totalReqs / totalElapsedMs) * 1000).toFixed(2)) : 0;
  const errorPct = totalReqs > 0 ? Number(((errCount / totalReqs) * 100).toFixed(2)) : 0;
  const avgBytes = bytesList.length
    ? Math.round(bytesList.reduce((a, b) => a + b, 0) / bytesList.length)
    : 0;
  return {
    totalReqs,
    totalElapsedMs: Number(totalElapsedMs.toFixed(2)),
    rps,
    minMs: min,
    avgMs: avg,
    p90Ms: p90,
    p95Ms: p95,
    maxMs: max,
    errors: errCount,
    errorPct,
    statusCodes: statusMap,
    avgBytes,
  };
}

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'x-app-client': 'barberia-smart-device',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    const ms = performance.now() - start;
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { ok: res.ok, status: res.status, ms, bytes: Buffer.byteLength(text, 'utf8'), text, json, error: null };
  } catch (err) {
    const ms = performance.now() - start;
    return { ok: false, status: 0, ms, bytes: 0, text: '', json: null, error: err.message };
  }
}

async function runWave(concurrency, totalRequests, workerFn) {
  const latencies = [];
  const statusMap = {};
  const bytesList = [];
  const results = [];
  let errCount = 0;
  let nextIdx = 0;

  const waveStart = performance.now();
  async function worker() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= totalRequests) break;
      const r = await workerFn(idx);
      latencies.push(r.ms);
      bytesList.push(r.bytes || 0);
      const codeKey = String(r.status || 'ERR');
      statusMap[codeKey] = (statusMap[codeKey] || 0) + 1;
      if (!r.ok && r.status !== 200 && r.status !== 201) errCount++;
      results.push(r);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const totalElapsedMs = performance.now() - waveStart;
  return { metrics: summarize(latencies, totalElapsedMs, statusMap, errCount, bytesList), results };
}

async function adminLogin() {
  const res = await timedFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  if (!res.json?.accessToken) {
    throw new Error(`Admin login failed: ${res.status} ${res.text}`);
  }
  return res.json.accessToken;
}

const createdIds = new Set();

async function cleanupAll(token) {
  let deleted = 0;
  for (const id of [...createdIds]) {
    const r = await timedFetch(`${API_BASE}/appointments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 204 || r.status === 200 || r.status === 404) {
      createdIds.delete(id);
      if (r.status !== 404) deleted++;
    }
  }
  // Barrido adicional por prefijo P12_ para garantizar BD limpia
  const searchRes = await timedFetch(`${API_BASE}/appointments?search=P12_&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = searchRes.json?.data || [];
  for (const row of rows) {
    const r = await timedFetch(`${API_BASE}/appointments/${row.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 204 || r.status === 200) deleted++;
  }
  return { deletedCount: deleted, remainingP12Rows: rows.length };
}

async function main() {
  console.log('=== PRACTICA 12: PRUEBAS DE ESTRES (FASE 3) Y BASE DE DATOS (FASE 4) ===');
  const token = await adminLogin();
  console.log('[OK] Admin JWT obtenido. Ejecutando warmup de API/Web...');
  await timedFetch(`${API_BASE}/appointments/by-date/2027-06-15`);
  await timedFetch(WEB_URL);

  const output = {
    executedAt: new Date().toISOString(),
    environment: { apiBase: API_BASE, webUrl: WEB_URL, runtime: `Node ${process.version}` },
    fase3: { webWaves: [], apiReadWaves: [], apiWriteWaves: [] },
    fase4: {},
    cleanup: null,
  };

  try {
    // ---------------- FASE 3A: STRESS WEB PWA (VERCEL) ----------------
    for (const [concurrency, total] of [
      [5, 15],
      [15, 45],
      [30, 60],
    ]) {
      const { metrics } = await runWave(concurrency, total, () => timedFetch(WEB_URL));
      output.fase3.webWaves.push({ target: WEB_URL, concurrency, ...metrics });
      console.log(`[FASE 3 WEB] c=${concurrency} n=${total} RPS=${metrics.rps} avg=${metrics.avgMs}ms P95=${metrics.p95Ms}ms err=${metrics.errorPct}%`);
      await sleep(1000);
    }

    // ---------------- FASE 3B: STRESS API LECTURA (RENDER + NEON) ----------------
    for (const [concurrency, total] of [
      [5, 25],
      [15, 45],
      [30, 60],
      [50, 100],
    ]) {
      const { metrics } = await runWave(concurrency, total, () =>
        timedFetch(`${API_BASE}/appointments/by-date/2027-06-15`),
      );
      output.fase3.apiReadWaves.push({
        endpoint: 'GET /api/appointments/by-date/2027-06-15',
        concurrency,
        ...metrics,
      });
      console.log(
        `[FASE 3 API READ] c=${concurrency} n=${total} RPS=${metrics.rps} avg=${metrics.avgMs}ms P90=${metrics.p90Ms}ms P95=${metrics.p95Ms}ms max=${metrics.maxMs}ms codes=${JSON.stringify(metrics.statusCodes)}`,
      );
      await sleep(2000);
    }

    // ---------------- FASE 3C: STRESS API ESCRITURA (POST /api/appointments) ----------------
    let slotCounter = 0;
    for (const [concurrency, total] of [
      [1, 5],
      [5, 10],
      [15, 15],
    ]) {
      const { metrics } = await runWave(concurrency, total, async () => {
        const idx = slotCounter++;
        const hour = String(9 + (idx % 10)).padStart(2, '0');
        const min = String((idx * 3) % 59).padStart(2, '0');
        const day = String(15 + Math.floor(idx / 20)).padStart(2, '0');
        const payload = {
          nombreCompleto: `P12_STRESS_USER_${idx}`,
          telefono: `449900${String(1000 + idx)}`,
          correo: `p12_stress_${idx}@test.local`,
          servicio: 'Corte Clasico',
          fechaCita: `2027-08-${day}`,
          horaCita: `${hour}:${min}`,
          notas: 'Prueba controlada Practica 12',
        };
        const res = await timedFetch(`${API_BASE}/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.json?.id) createdIds.add(res.json.id);
        return res;
      });
      output.fase3.apiWriteWaves.push({
        endpoint: 'POST /api/appointments',
        concurrency,
        ...metrics,
      });
      console.log(
        `[FASE 3 API WRITE] c=${concurrency} n=${total} RPS=${metrics.rps} avg=${metrics.avgMs}ms P90=${metrics.p90Ms}ms P95=${metrics.p95Ms}ms codes=${JSON.stringify(metrics.statusCodes)}`,
      );
      await sleep(1500);
    }

    // ---------------- FASE 4: PRUEBAS AVANZADAS DE BASE DE DATOS ----------------
    // Sembrar 15 registros controlados para DB-01..DB-06
    const dbSeedIds = [];
    for (let i = 0; i < 15; i++) {
      const res = await timedFetch(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreCompleto: `P12_DB_SEED_${i}`,
          telefono: `449800${String(1000 + i)}`,
          correo: `p12_db_${i}@test.local`,
          servicio: i % 2 === 0 ? 'Corte y Barba' : 'Afeitado Express',
          fechaCita: i < 10 ? '2027-09-01' : '2027-09-02',
          horaCita: `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '05' : '35'}`,
          notas: `Registro semilla DB benchmark numero ${i} con texto descriptivo`,
        }),
      });
      if (res.json?.id) {
        createdIds.add(res.json.id);
        dbSeedIds.push(res.json.id);
      }
    }
    console.log(`[FASE 4] Sembrados ${dbSeedIds.length} registros temporales para pruebas SQL via API.`);

    // 4.1 Consulta individual por identificador (5 corridas)
    const db1 = await runWave(1, 5, () =>
      timedFetch(`${API_BASE}/appointments/${dbSeedIds[0]}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    output.fase4.db01_byId = { ...db1.metrics, rowCount: 1 };

    // 4.2 Consulta conjunto pequeño (por fecha, 5 corridas)
    const db2 = await runWave(1, 5, () => timedFetch(`${API_BASE}/appointments/by-date/2027-09-01`));
    const db2Rows = Array.isArray(db2.results[0]?.json) ? db2.results[0].json.length : 0;
    output.fase4.db02_smallSet = { ...db2.metrics, rowCount: db2Rows };

    // 4.3 Consulta conjunto grande (page=1&limit=50, 5 corridas)
    const db3 = await runWave(1, 5, () =>
      timedFetch(`${API_BASE}/appointments?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const db3Rows = Array.isArray(db3.results[0]?.json?.data) ? db3.results[0].json.data.length : 0;
    const db3Total = db3.results[0]?.json?.total ?? db3Rows;
    output.fase4.db03_largeSet = { ...db3.metrics, rowCount: db3Rows, totalInDb: db3Total };

    // 4.4 Consulta con filtros (fecha + estado + search LOWER LIKE, 5 corridas)
    const db4 = await runWave(1, 5, () =>
      timedFetch(`${API_BASE}/appointments?fecha=2027-09-01&estado=pendiente&search=P12_DB_SEED`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const db4Rows = Array.isArray(db4.results[0]?.json?.data) ? db4.results[0].json.data.length : 0;
    output.fase4.db04_filtered = { ...db4.metrics, rowCount: db4Rows };

    // 4.5 Actualización de registros concurrentes (5 IDs distintos en paralelo)
    const targetIds5 = dbSeedIds.slice(0, 5);
    const t5Start = performance.now();
    const patchResults5 = await Promise.all(
      targetIds5.map((id, i) =>
        timedFetch(`${API_BASE}/appointments/${id}/estado`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'confirmada', nombreBarbero: `Barbero_${i}` }),
        }),
      ),
    );
    const t5Total = Number((performance.now() - t5Start).toFixed(2));
    // Verificar integridad de los 5 registros actualizados
    const verify5 = await Promise.all(
      targetIds5.map((id) =>
        timedFetch(`${API_BASE}/appointments/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    );
    const allConfirmed = verify5.every((v) => v.json?.estado === 'confirmada');
    output.fase4.db05_concurrentUpdatesDistinct = {
      parallelOps: 5,
      totalElapsedMs: t5Total,
      avgOpMs: Number((patchResults5.reduce((a, b) => a + b.ms, 0) / 5).toFixed(2)),
      statuses: patchResults5.map((r) => r.status),
      integrityConfirmed: allConfirmed,
    };

    // 4.6 Escrituras simultáneas sobre un mismo registro + mismo horario único
    const sharedId = dbSeedIds[5];
    const t6aStart = performance.now();
    const sameRowResults = await Promise.all(
      ['confirmada', 'en_proceso', 'completada', 'confirmada', 'cancelada'].map((estado, i) =>
        timedFetch(`${API_BASE}/appointments/${sharedId}/estado`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado, nombreBarbero: `ConcurrentBarber_${i}` }),
        }),
      ),
    );
    const t6aTotal = Number((performance.now() - t6aStart).toFixed(2));
    const finalRow = await timedFetch(`${API_BASE}/appointments/${sharedId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Colisión simultánea sobre mismo slot (idx_appointments_slot_unique)
    const t6bStart = performance.now();
    const slotRaceResults = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        timedFetch(`${API_BASE}/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombreCompleto: `P12_RACE_USER_${i}`,
            telefono: `449777000${i}`,
            correo: `p12_race_${i}@test.local`,
            servicio: 'Corte Clasico',
            fechaCita: '2027-09-10',
            horaCita: '12:00',
            notas: 'Race condition test',
          }),
        }),
      ),
    );
    const t6bTotal = Number((performance.now() - t6bStart).toFixed(2));
    for (const r of slotRaceResults) {
      if (r.json?.id) createdIds.add(r.json.id);
    }
    const raceCodes = {};
    for (const r of slotRaceResults) {
      raceCodes[r.status] = (raceCodes[r.status] || 0) + 1;
    }

    output.fase4.db06_sameRecordAndSlotWrites = {
      sameRecordPatch: {
        parallelOps: 5,
        totalElapsedMs: t6aTotal,
        statuses: sameRowResults.map((r) => r.status),
        finalConsistentState: finalRow.json?.estado || null,
        finalConsistentBarber: finalRow.json?.nombreBarbero || null,
      },
      sameSlotInsertRace: {
        parallelOps: 5,
        totalElapsedMs: t6bTotal,
        statusCodes: raceCodes,
        duplicatesPrevented: (raceCodes[201] || 0) === 1 && (raceCodes[409] || 0) === 4,
      },
    };
  } finally {
    console.log('[CLEANUP] Eliminando todos los registros temporales de Neon DB...');
    output.cleanup = await cleanupAll(token);
    console.log('[CLEANUP RESULT]', JSON.stringify(output.cleanup));
  }

  const outPath = path.resolve(process.cwd(), 'backend/test/practica12/cloud_stress_results.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`[SAVED] Resultados guardados en ${outPath}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

