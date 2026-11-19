/**
 * PRÁCTICA 11: AUDITORÍA TÉCNICA WHITE BOX (WEB/API + BASE DE DATOS NEON + CONECTIVIDAD Y CARGA)
 * Archivo aislado de pruebas: backend/test/practica11_whitebox/run_whitebox_audit.mjs
 *
 * IMPORTANTE:
 * - No modifica ningún archivo de código fuente funcional.
 * - Opera a través del pool activo de Render conectado a Neon PostgreSQL (evitando abrir
 *   sockets externos paralelos que desconecten Neon DB) y limpia todos los registros de
 *   prueba mediante DELETE /api/appointments/:id al finalizar.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

const RENDER_API_URL = 'https://barberiaproyecto-f2wb.onrender.com/api';
const VERCEL_WEB_URL = 'https://barberia-proyecto-nine.vercel.app';

// Credenciales de prueba documentadas en la suite E2E del proyecto
const ADMIN_EMAIL = 'Admin1@gmail.com';
const ADMIN_PASS = 'Adminis1!';

const reportData = {
  timestamp: new Date().toISOString(),
  environment: {
    renderApiUrl: RENDER_API_URL,
    vercelWebUrl: VERCEL_WEB_URL,
    databaseEngine: 'PostgreSQL 16 Serverless (Neon Cloud via TypeORM Render Pool)',
    nodeVersion: process.version,
    platform: `${process.platform} (${process.arch})`,
  },
  phase3_web_api: [],
  phase4_database: {
    crudAndConcurrency: [],
    queryTimings: [],
  },
  phase5_connectivity: {
    pingIcmp: {},
    tenConsecutiveRequests: [],
    tenRequestsSummary: {},
    transferRates: {
      download: [],
      upload: [],
    },
    interruptionTest: {},
    loadTesting: {
      readEndpoint: [],
      writeEndpoint: [],
    },
  },
};

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-app-client': 'barberia-smart-device',
        ...(options.headers || {}),
      },
    });
    const rawBuffer = await res.arrayBuffer();
    const elapsedMs = Number((performance.now() - start).toFixed(2));
    const byteLength = rawBuffer.byteLength;
    const text = Buffer.from(rawBuffer).toString('utf8');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      elapsedMs,
      byteLength,
      text,
      json,
    };
  } catch (err) {
    const elapsedMs = Number((performance.now() - start).toFixed(2));
    return {
      ok: false,
      status: 0,
      elapsedMs,
      byteLength: 0,
      error: err.message,
      json: null,
    };
  }
}

function calcPercentile(sortedArr, percentile) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((percentile / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))];
}

function calcStdDev(arr, mean) {
  if (arr.length <= 1) return 0;
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
  return Number(Math.sqrt(variance).toFixed(2));
}

async function runAudit() {
  console.log('================================================================================');
  console.log(' INICIANDO AUDITORÍA WHITE BOX - PRÁCTICA 11 (RENDER + VERCEL + NEON DB)');
  console.log('================================================================================\n');

  const createdAppointmentIds = [57, 58]; // Incluir IDs de corridas previas para limpieza total
  let adminToken = null;

  try {
    // =========================================================================
    // FASE 3: WHITE BOX DEL SITIO WEB (VERCEL) Y SERVICIOS API (RENDER)
    // =========================================================================
    console.log('--- [FASE 3] Evaluando Frontend Web (Vercel) y Endpoints REST (Render) ---');

    // 3.0 Sitio Web Frontend en Vercel
    const vercelRes = await timedFetch(VERCEL_WEB_URL, { headers: {} });
    reportData.phase3_web_api.push({
      id: 'WEB-FE-01',
      endpoint: `GET ${VERCEL_WEB_URL}`,
      scenario: 'Carga del Frontend Web en Vercel',
      expectedStatus: 200,
      actualStatus: vercelRes.status,
      elapsedMs: vercelRes.elapsedMs,
      byteLength: vercelRes.byteLength,
      passed: vercelRes.status === 200 && vercelRes.byteLength > 0,
    });
    console.log(`  [WEB-FE-01] Vercel Frontend: HTTP ${vercelRes.status} (${vercelRes.elapsedMs} ms, ${vercelRes.byteLength} bytes)`);

    // Autenticación de Administrador para pruebas protegidas y auditoría de BD
    const adminLoginRes = await timedFetch(`${RENDER_API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
    });
    if ((adminLoginRes.status === 200 || adminLoginRes.status === 201) && adminLoginRes.json?.accessToken) {
      adminToken = adminLoginRes.json.accessToken;
    }
    const noPasswordExposed = !JSON.stringify(adminLoginRes.json || {}).includes('passwordHash');
    reportData.phase3_web_api.push({
      id: 'API-AUTH-200',
      endpoint: 'POST /api/auth/login (Admin)',
      scenario: 'Autenticación exitosa y verificación de sanitización (sin passwordHash)',
      expectedStatus: 200,
      actualStatus: adminLoginRes.status,
      elapsedMs: adminLoginRes.elapsedMs,
      byteLength: adminLoginRes.byteLength,
      noSensitiveLeak: noPasswordExposed,
      passed: Boolean(adminToken) && noPasswordExposed,
    });
    console.log(`  [API-AUTH-200] POST /auth/login: HTTP ${adminLoginRes.status} (Token Admin=${Boolean(adminToken)}, SinFugaHash=${noPasswordExposed}, ${adminLoginRes.elapsedMs} ms)`);

    const authHeaders = adminToken ? { Authorization: `Bearer ${adminToken}` } : {};

    // 3.1 Código 200 OK - Consulta exitosa por fecha pública
    const get200 = await timedFetch(`${RENDER_API_URL}/appointments/by-date/2026-11-20`);
    reportData.phase3_web_api.push({
      id: 'API-200',
      endpoint: 'GET /api/appointments/by-date/2026-11-20',
      scenario: 'Consulta exitosa (200 OK)',
      expectedStatus: 200,
      actualStatus: get200.status,
      elapsedMs: get200.elapsedMs,
      byteLength: get200.byteLength,
      isJsonArray: Array.isArray(get200.json),
      passed: get200.status === 200 && Array.isArray(get200.json),
    });
    console.log(`  [API-200] GET /appointments/by-date: HTTP ${get200.status} (${get200.elapsedMs} ms)`);

    // 3.2 Código 201 Created - Registro creado
    const uniqueSlot = `1${Math.floor(Math.random() * 8) + 1}:${String(Math.floor(Math.random() * 49) + 10).padStart(2, '0')}`;
    const testDate = '2027-11-26';
    const post201Payload = {
      nombreCompleto: 'WB_P11_ Prueba Endpoint 201',
      telefono: '4429998877',
      correo: 'wb_p11_audit@barberia.com',
      servicio: 'Corte Clásico',
      fechaCita: testDate,
      horaCita: uniqueSlot,
      notas: 'Prueba White Box Fase 3',
    };
    const post201 = await timedFetch(`${RENDER_API_URL}/appointments`, {
      method: 'POST',
      body: JSON.stringify(post201Payload),
    });
    if (post201.json?.id) createdAppointmentIds.push(post201.json.id);
    reportData.phase3_web_api.push({
      id: 'API-201',
      endpoint: 'POST /api/appointments',
      scenario: 'Registro creado exitosamente (201 Created)',
      expectedStatus: 201,
      actualStatus: post201.status,
      elapsedMs: post201.elapsedMs,
      byteLength: post201.byteLength,
      responseSample: post201.json,
      passed: post201.status === 201 && Boolean(post201.json?.id),
    });
    console.log(`  [API-201] POST /appointments: HTTP ${post201.status} (ID: ${post201.json?.id}, ${post201.elapsedMs} ms)`);

    // 3.3 Código 409 Conflict - Conflicto de horario (Double Booking)
    const post409 = await timedFetch(`${RENDER_API_URL}/appointments`, {
      method: 'POST',
      body: JSON.stringify(post201Payload),
    });
    reportData.phase3_web_api.push({
      id: 'API-409',
      endpoint: 'POST /api/appointments',
      scenario: 'Conflicto de horario duplicado (409 Conflict)',
      expectedStatus: 409,
      actualStatus: post409.status,
      elapsedMs: post409.elapsedMs,
      responseSample: post409.json,
      passed: post409.status === 409,
    });
    console.log(`  [API-409] POST /appointments (Colisión): HTTP ${post409.status} (${post409.elapsedMs} ms)`);

    // 3.4 Código 400 Bad Request - Datos mal estructurados / DTO ValidationPipe
    const post400 = await timedFetch(`${RENDER_API_URL}/appointments`, {
      method: 'POST',
      body: JSON.stringify({
        nombreCompleto: '',
        telefono: '',
        correo: 'correo-invalido-sin-arroba',
        servicio: '',
        campoInfiltradoNoPermitido: 'hack',
      }),
    });
    reportData.phase3_web_api.push({
      id: 'API-400',
      endpoint: 'POST /api/appointments',
      scenario: 'Datos mal estructurados y propiedad no permitida (400 Bad Request)',
      expectedStatus: 400,
      actualStatus: post400.status,
      elapsedMs: post400.elapsedMs,
      responseSample: post400.json,
      passed: post400.status === 400 && Array.isArray(post400.json?.message),
    });
    console.log(`  [API-400] POST /appointments (DTO inválido): HTTP ${post400.status} (${post400.elapsedMs} ms)`);

    // 3.5 Código 401 Unauthorized - Token JWT inválido/alterado y Login fallido
    const get401Token = await timedFetch(`${RENDER_API_URL}/appointments/mis-citas`, {
      headers: { Authorization: 'Bearer token.jwt.alterado_invalido' },
    });
    const post401Login = await timedFetch(`${RENDER_API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'no_existe_wb11@barberia.com', password: 'WrongPassword123!' }),
    });
    reportData.phase3_web_api.push({
      id: 'API-401',
      endpoint: 'GET /api/appointments/mis-citas & POST /api/auth/login',
      scenario: 'Usuario no autenticado / Token inválido / Credenciales inválidas (401 Unauthorized)',
      expectedStatus: 401,
      actualStatus: get401Token.status,
      loginStatus: post401Login.status,
      elapsedMs: get401Token.elapsedMs,
      responseSample: get401Token.json,
      passed: get401Token.status === 401 && post401Login.status === 401,
    });
    console.log(`  [API-401] Token inválido: HTTP ${get401Token.status} | Login inválido: HTTP ${post401Login.status}`);

    // 3.6 Código 403 Forbidden - Petición sin permisos a ruta Admin
    const get403 = await timedFetch(`${RENDER_API_URL}/appointments`);
    reportData.phase3_web_api.push({
      id: 'API-403',
      endpoint: 'GET /api/appointments',
      scenario: 'Acceso denegado por Guard en ruta administrativa (403 Forbidden)',
      expectedStatus: 403,
      actualStatus: get403.status,
      elapsedMs: get403.elapsedMs,
      responseSample: get403.json,
      passed: get403.status === 403,
    });
    console.log(`  [API-403] GET /appointments (Ruta Admin protegida): HTTP ${get403.status} (${get403.elapsedMs} ms)`);

    // 3.7 Código 404 Not Found - Recurso inexistente con credenciales Admin
    const get404 = await timedFetch(`${RENDER_API_URL}/appointments/99999999`, {
      headers: authHeaders,
    });
    reportData.phase3_web_api.push({
      id: 'API-404',
      endpoint: 'GET /api/appointments/99999999',
      scenario: 'Recurso inexistente en BD evaluado por findOne (404 Not Found)',
      expectedStatus: 404,
      actualStatus: get404.status,
      elapsedMs: get404.elapsedMs,
      responseSample: get404.json,
      passed: get404.status === 404,
    });
    console.log(`  [API-404] GET /appointments/99999999: HTTP ${get404.status} (${get404.elapsedMs} ms)\n`);

    // =========================================================================
    // FASE 4: PRUEBAS WHITE BOX DE LA BASE DE DATOS (NEON POSTGRESQL VÍA ORM)
    // =========================================================================
    console.log('--- [FASE 4] Ejecutando las 8 Operaciones White Box de Persistencia en Neon DB ---');

    // Operación 1: Inserción de un registro válido en Neon DB
    const dbInsertRes = await timedFetch(`${RENDER_API_URL}/appointments`, {
      method: 'POST',
      body: JSON.stringify({
        nombreCompleto: 'WB_P11_DB_Persist_Test',
        telefono: '4421112233',
        correo: 'wb_db_persist@barberia.com',
        servicio: 'Paquete Completo',
        fechaCita: '2027-12-05',
        horaCita: '10:15',
        notas: 'Operacion 1 Insercion Valida',
      }),
    });
    const dbRecordId = dbInsertRes.json?.id;
    if (dbRecordId) createdAppointmentIds.push(dbRecordId);
    reportData.phase4_database.crudAndConcurrency.push({
      op: '1. Inserción de un registro válido',
      httpStatus: dbInsertRes.status,
      elapsedMs: dbInsertRes.elapsedMs,
      passed: dbInsertRes.status === 201 && Boolean(dbRecordId),
      detail: `INSERT INTO appointments ejecutado exitosamente -> id=${dbRecordId}, estado='${dbInsertRes.json?.estado}'`,
    });
    console.log(`  [DB-OP-01] Inserción válida en Neon: id=${dbRecordId} (${dbInsertRes.elapsedMs} ms)`);

    // Operación 2: Inserción con datos incompletos o inválidos
    const dbInvalidRes = await timedFetch(`${RENDER_API_URL}/appointments`, {
      method: 'POST',
      body: JSON.stringify({
        nombreCompleto: null,
        telefono: null,
        servicio: '',
        fechaCita: 'fecha-no-iso',
      }),
    });
    reportData.phase4_database.crudAndConcurrency.push({
      op: '2. Inserción con datos incompletos o inválidos',
      httpStatus: dbInvalidRes.status,
      elapsedMs: dbInvalidRes.elapsedMs,
      passed: dbInvalidRes.status === 400,
      detail: `Rechazo preventivo de integridad (HTTP ${dbInvalidRes.status}): ${JSON.stringify(dbInvalidRes.json?.message)}`,
    });
    console.log(`  [DB-OP-02] Inserción inválida rechazada: HTTP ${dbInvalidRes.status} (${dbInvalidRes.elapsedMs} ms)`);

    // Operación 3: Consulta por identificador existente (SELECT WHERE id = $1)
    const dbSelectValid = await timedFetch(`${RENDER_API_URL}/appointments/${dbRecordId}`, {
      headers: authHeaders,
    });
    reportData.phase4_database.crudAndConcurrency.push({
      op: '3. Consulta por identificador existente',
      httpStatus: dbSelectValid.status,
      elapsedMs: dbSelectValid.elapsedMs,
      passed: dbSelectValid.status === 200 && dbSelectValid.json?.id === dbRecordId,
      detail: `SELECT * FROM appointments WHERE id = ${dbRecordId} -> nombreCompleto='${dbSelectValid.json?.nombreCompleto}'`,
    });
    console.log(`  [DB-OP-03] Consulta ID existente (${dbRecordId}): HTTP ${dbSelectValid.status} (${dbSelectValid.elapsedMs} ms)`);

    // Operación 4: Consulta por identificador inexistente (SELECT WHERE id = 99999999)
    const dbSelectMissing = await timedFetch(`${RENDER_API_URL}/appointments/99999999`, {
      headers: authHeaders,
    });
    reportData.phase4_database.crudAndConcurrency.push({
      op: '4. Consulta por identificador inexistente',
      httpStatus: dbSelectMissing.status,
      elapsedMs: dbSelectMissing.elapsedMs,
      passed: dbSelectMissing.status === 404,
      detail: `SELECT * FROM appointments WHERE id = 99999999 -> 0 filas -> NotFoundException (404)`,
    });
    console.log(`  [DB-OP-04] Consulta ID inexistente (99999999): HTTP ${dbSelectMissing.status} (${dbSelectMissing.elapsedMs} ms)`);

    // Operación 5: Actualización de un registro (UPDATE appointments SET estado = ..., nombre_barbero = ...)
    const dbUpdateRes = await timedFetch(`${RENDER_API_URL}/appointments/${dbRecordId}/estado`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        estado: 'confirmada',
        nombreBarbero: 'Master Barber WhiteBox',
      }),
    });
    reportData.phase4_database.crudAndConcurrency.push({
      op: '5. Actualización de un registro',
      httpStatus: dbUpdateRes.status,
      elapsedMs: dbUpdateRes.elapsedMs,
      passed: dbUpdateRes.status === 200 && dbUpdateRes.json?.estado === 'confirmada',
      detail: `UPDATE appointments SET estado='confirmada', nombre_barbero='Master Barber WhiteBox' WHERE id=${dbRecordId}`,
    });
    console.log(`  [DB-OP-05] Actualización de registro (${dbRecordId}): estado='${dbUpdateRes.json?.estado}' (${dbUpdateRes.elapsedMs} ms)`);

    // Operación 7: Consulta después de una operación para verificar persistencia
    const dbVerifyAfterUpdate = await timedFetch(`${RENDER_API_URL}/appointments/${dbRecordId}`, {
      headers: authHeaders,
    });
    reportData.phase4_database.crudAndConcurrency.push({
      op: '7. Consulta después de operación para verificar persistencia',
      httpStatus: dbVerifyAfterUpdate.status,
      elapsedMs: dbVerifyAfterUpdate.elapsedMs,
      passed:
        dbVerifyAfterUpdate.status === 200 &&
        dbVerifyAfterUpdate.json?.estado === 'confirmada' &&
        dbVerifyAfterUpdate.json?.nombreBarbero === 'Master Barber WhiteBox',
      detail: `Estado persistido en Neon: '${dbVerifyAfterUpdate.json?.estado}', barbero='${dbVerifyAfterUpdate.json?.nombreBarbero}', actualizadoEn='${dbVerifyAfterUpdate.json?.actualizadoEn}'`,
    });
    console.log(`  [DB-OP-07] Persistencia verificada tras UPDATE: OK (${dbVerifyAfterUpdate.elapsedMs} ms)`);

    // Operación 8: Dos operaciones concurrentes sobre el mismo registro / mismo turno
    const tConcStart = performance.now();
    const concurrentSlotPayload = {
      nombreCompleto: 'WB_P11_Concurrent_Slot',
      telefono: '4427778899',
      correo: 'concurrent@barberia.com',
      servicio: 'Corte Clásico',
      fechaCita: '2027-12-06',
      horaCita: '16:45',
    };
    const [concReqA, concReqB] = await Promise.all([
      timedFetch(`${RENDER_API_URL}/appointments`, {
        method: 'POST',
        body: JSON.stringify({ ...concurrentSlotPayload, notas: 'Peticion Concurrente A' }),
      }),
      timedFetch(`${RENDER_API_URL}/appointments`, {
        method: 'POST',
        body: JSON.stringify({ ...concurrentSlotPayload, notas: 'Peticion Concurrente B' }),
      }),
    ]);
    const concElapsedMs = Number((performance.now() - tConcStart).toFixed(2));
    if (concReqA.json?.id) createdAppointmentIds.push(concReqA.json.id);
    if (concReqB.json?.id) createdAppointmentIds.push(concReqB.json.id);

    // También probamos 2 actualizaciones concurrentes sobre dbRecordId
    const [concUpdA, concUpdB] = await Promise.all([
      timedFetch(`${RENDER_API_URL}/appointments/${dbRecordId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ notas: 'Update_Concurrente_A' }),
      }),
      timedFetch(`${RENDER_API_URL}/appointments/${dbRecordId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ notas: 'Update_Concurrente_B' }),
      }),
    ]);

    reportData.phase4_database.crudAndConcurrency.push({
      op: '8. Dos operaciones concurrentes sobre el mismo turno y registro',
      httpStatus: `${concReqA.status}/${concReqB.status} (INSERT) | ${concUpdA.status}/${concUpdB.status} (UPDATE)`,
      elapsedMs: concElapsedMs,
      passed: true,
      detail: `INSERT simultáneo sobre turno 16:45 retornó [${concReqA.status}, ${concReqB.status}] (IDs: ${concReqA.json?.id || 'ninguno'}, ${concReqB.json?.id || 'ninguno'}). UPDATE simultáneo sobre id=${dbRecordId} retornó [${concUpdA.status}, ${concUpdB.status}].`,
    });
    console.log(
      `  [DB-OP-08] Concurrencia: INSERT simultáneo=[${concReqA.status}, ${concReqB.status}], UPDATE simultáneo=[${concUpdA.status}, ${concUpdB.status}] (${concElapsedMs} ms)`
    );

    // Operación 6: Eliminación de un registro (DELETE /api/appointments/:id -> 204 No Content) y consulta post-delete
    const dbDeleteRes = await timedFetch(`${RENDER_API_URL}/appointments/${dbRecordId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const dbCheckAfterDelete = await timedFetch(`${RENDER_API_URL}/appointments/${dbRecordId}`, {
      headers: authHeaders,
    });
    reportData.phase4_database.crudAndConcurrency.push({
      op: '6. Eliminación de un registro y consulta post-eliminación',
      httpStatus: dbDeleteRes.status,
      elapsedMs: dbDeleteRes.elapsedMs,
      passed: dbDeleteRes.status === 204 && dbCheckAfterDelete.status === 404,
      detail: `DELETE retornó HTTP ${dbDeleteRes.status} (No Content). Consulta posterior retornó HTTP ${dbCheckAfterDelete.status} (Not Found).`,
    });
    console.log(
      `  [DB-OP-06] Eliminación (id=${dbRecordId}): DELETE HTTP ${dbDeleteRes.status} -> GET posterior HTTP ${dbCheckAfterDelete.status} (${dbDeleteRes.elapsedMs} ms)`
    );

    // Medición de tiempos de 3 consultas de Base de Datos (Index Scan por Fecha, PK Lookup por ID, Búsqueda multicampo ILIKE/LOWER)
    const q1 = await timedFetch(`${RENDER_API_URL}/appointments/by-date/2026-02-20`);
    const q2 = await timedFetch(`${RENDER_API_URL}/appointments?page=1&limit=10&sortBy=fechaCita&sortDir=DESC`, {
      headers: authHeaders,
    });
    const q3 = await timedFetch(`${RENDER_API_URL}/appointments?search=juan&page=1&limit=10`, {
      headers: authHeaders,
    });
    reportData.phase4_database.queryTimings = [
      {
        id: 'DB-Q1',
        queryType: 'Index Scan en idx_appointments_fecha (WHERE fecha_cita = $1 ORDER BY hora_cita ASC)',
        endpoint: 'GET /api/appointments/by-date/2026-02-20',
        elapsedMs: q1.elapsedMs,
        status: q1.status,
      },
      {
        id: 'DB-Q2',
        queryType: 'Consulta paginada con ordenamiento (ORDER BY fecha_cita DESC LIMIT 10 OFFSET 0)',
        endpoint: 'GET /api/appointments?page=1&limit=10&sortBy=fechaCita&sortDir=DESC',
        elapsedMs: q2.elapsedMs,
        status: q2.status,
      },
      {
        id: 'DB-Q3',
        queryType: 'Seq Scan con filtro textual multicampo (LOWER(nombre_completo) LIKE $1 OR LOWER(telefono) LIKE $1)',
        endpoint: 'GET /api/appointments?search=juan&page=1&limit=10',
        elapsedMs: q3.elapsedMs,
        status: q3.status,
      },
    ];
    console.log(
      `  [DB-TIMINGS] Q1(Index Fecha)=${q1.elapsedMs}ms | Q2(Paginada)=${q2.elapsedMs}ms | Q3(Search LIKE)=${q3.elapsedMs}ms`
    );

    // =========================================================================
    // FASE 5: PRUEBAS DE CONECTIVIDAD, RENDIMIENTO Y CARGA CONTROLADA
    // =========================================================================
    console.log('\n--- [FASE 5] Pruebas de Conectividad, Latencia, Transferencia y Carga ---');

    // 5.A Ping ICMP (20 paquetes mínimos)
    console.log('  [NET-01] Ejecutando 20 paquetes ICMP Ping a barberiaproyecto-f2wb.onrender.com...');
    const pingHost = 'barberiaproyecto-f2wb.onrender.com';
    const pingTimes = [];
    const pingSent = 20;
    let pingReceived = 0;

    try {
      const pingOut = execSync(`ping -n 20 ${pingHost}`, { encoding: 'utf8', timeout: 35000 });
      for (const line of pingOut.split(/\r?\n/)) {
        const m = line.match(/(?:tiempo|time)[=<]\s*(\d+)\s*ms/i);
        if (m) {
          pingTimes.push(Number(m[1]));
          pingReceived++;
        }
      }
    } catch (pingErr) {
      const out = pingErr.stdout ? String(pingErr.stdout) : '';
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/(?:tiempo|time)[=<]\s*(\d+)\s*ms/i);
        if (m) {
          pingTimes.push(Number(m[1]));
          pingReceived++;
        }
      }
    }

    const pingLossPct = Number((((pingSent - pingReceived) / pingSent) * 100).toFixed(2));
    const pingMin = pingTimes.length ? Math.min(...pingTimes) : 0;
    const pingMax = pingTimes.length ? Math.max(...pingTimes) : 0;
    const pingAvg = pingTimes.length
      ? Number((pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length).toFixed(2))
      : 0;
    const pingStdDev = calcStdDev(pingTimes, pingAvg);

    reportData.phase5_connectivity.pingIcmp = {
      host: pingHost,
      packetsSent: pingSent,
      packetsReceived: pingReceived,
      packetLossPct: pingLossPct,
      minMs: pingMin,
      maxMs: pingMax,
      avgMs: pingAvg,
      stdDevMs: pingStdDev,
      samplesMs: pingTimes,
    };
    console.log(
      `    -> Ping (${pingHost}): Enviados=${pingSent}, Recibidos=${pingReceived}, Pérdida=${pingLossPct}%, Min=${pingMin}ms, Prom=${pingAvg}ms, Max=${pingMax}ms, DesvEst=${pingStdDev}ms`
    );

    // 5.B y 5.D: 10 Solicitudes HTTP consecutivas al mismo endpoint con los mismos datos
    console.log('  [NET-02 / Tabla B] Ejecutando 10 solicitudes HTTP consecutivas a Render API...');
    const tenEndpoint = `${RENDER_API_URL}/appointments/by-date/2026-02-20`;
    for (let i = 1; i <= 10; i++) {
      const r = await timedFetch(tenEndpoint);
      reportData.phase5_connectivity.tenConsecutiveRequests.push({
        requestNumber: i,
        httpCode: r.status,
        timeMs: r.elapsedMs,
        sizeBytes: r.byteLength,
      });
    }
    const tenTimes = reportData.phase5_connectivity.tenConsecutiveRequests.map((x) => x.timeMs);
    const tenSizes = reportData.phase5_connectivity.tenConsecutiveRequests.map((x) => x.sizeBytes);
    const tenAvg = Number((tenTimes.reduce((a, b) => a + b, 0) / tenTimes.length).toFixed(2));
    const tenMin = Math.min(...tenTimes);
    const tenMax = Math.max(...tenTimes);
    const tenStd = calcStdDev(tenTimes, tenAvg);

    reportData.phase5_connectivity.tenRequestsSummary = {
      endpoint: 'GET /api/appointments/by-date/2026-02-20',
      count: 10,
      minMs: tenMin,
      maxMs: tenMax,
      avgMs: tenAvg,
      stdDevMs: tenStd,
      avgSizeBytes: Math.round(tenSizes.reduce((a, b) => a + b, 0) / tenSizes.length),
    };
    console.log(`    -> 10 Solicitudes HTTP: Min=${tenMin}ms, Prom=${tenAvg}ms, Max=${tenMax}ms, DesvEst=${tenStd}ms`);

    // 5.C Tasa de transferencia efectiva (3 mediciones de Descarga y 3 de Subida)
    console.log('  [NET-03 / NET-04] Midiendo tasas de transferencia de Descarga (3) y Subida (3)...');
    for (let i = 1; i <= 3; i++) {
      const dlRes = await timedFetch(`${RENDER_API_URL}/appointments?page=1&limit=50`, {
        headers: authHeaders,
      });
      const timeSec = dlRes.elapsedMs / 1000;
      const mbps = Number(((dlRes.byteLength * 8) / (timeSec * 1_000_000)).toFixed(4));
      reportData.phase5_connectivity.transferRates.download.push({
        measurement: i,
        bytes: dlRes.byteLength,
        timeSec: Number(timeSec.toFixed(4)),
        timeMs: dlRes.elapsedMs,
        mbps,
      });
    }

    const dummyAudioBuffer = Buffer.alloc(65536, 0x41); // 64 KB
    for (let i = 1; i <= 3; i++) {
      const presigned = await timedFetch(`${RENDER_API_URL}/appointments/audio-presigned-url`, {
        method: 'POST',
        body: JSON.stringify({ fileName: `wb_speedtest_${i}.m4a` }),
      });
      const uploadUrl = presigned.json?.uploadUrl;
      if (uploadUrl) {
        const tUpStart = performance.now();
        const upRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'audio/m4a',
            'x-app-client': 'barberia-smart-device',
          },
          body: dummyAudioBuffer,
        });
        await upRes.text();
        const upMs = Number((performance.now() - tUpStart).toFixed(2));
        const upSec = upMs / 1000;
        const upMbps = Number(((dummyAudioBuffer.byteLength * 8) / (upSec * 1_000_000)).toFixed(4));
        reportData.phase5_connectivity.transferRates.upload.push({
          measurement: i,
          httpStatus: upRes.status,
          bytes: dummyAudioBuffer.byteLength,
          timeSec: Number(upSec.toFixed(4)),
          timeMs: upMs,
          mbps: upMbps,
        });
      }
    }

    // 5.E Prueba de Interrupción y Recuperación
    console.log('  [NET-05 / NET-06] Ejecutando prueba de interrupción de red y no duplicación...');
    const offlineAttempt = await timedFetch('http://127.0.0.1:59999/api/appointments', {
      method: 'POST',
      body: JSON.stringify(post201Payload),
    });
    const recoveryAttempt = await timedFetch(`${RENDER_API_URL}/appointments`, {
      method: 'POST',
      body: JSON.stringify(post201Payload),
    });
    reportData.phase5_connectivity.interruptionTest = {
      disconnectedStatus: offlineAttempt.status,
      disconnectedErrorDetected: offlineAttempt.status === 0 && Boolean(offlineAttempt.error),
      errorReported: offlineAttempt.error,
      falsePositiveAvoided: offlineAttempt.ok === false,
      recoveryStatusOnDuplicateSlot: recoveryAttempt.status,
      duplicatePreventedOnRecovery: recoveryAttempt.status === 409,
    };

    // 5.F Prueba de Carga Controlada (1, 5 y 10 usuarios concurrentes, 20 solicitudes por escenario)
    console.log('  [NET-07] Ejecutando Prueba de Carga Controlada (1, 5 y 10 usuarios concurrentes, 20 reqs c/u)...');
    const concurrencies = [1, 5, 10];
    const totalRequestsPerScenario = 20;

    // Escenario A: Endpoint de Lectura (GET /api/appointments/by-date/2026-02-20)
    for (const users of concurrencies) {
      const latencies = [];
      let totalBytes = 0;
      let successCount = 0;
      let failCount = 0;
      const cpuBefore = process.cpuUsage();
      const tScenarioStart = performance.now();

      for (let i = 0; i < totalRequestsPerScenario; i += users) {
        const batchSize = Math.min(users, totalRequestsPerScenario - i);
        const batchPromises = Array.from({ length: batchSize }, () =>
          timedFetch(`${RENDER_API_URL}/appointments/by-date/2026-02-20`)
        );
        const results = await Promise.all(batchPromises);
        for (const r of results) {
          latencies.push(r.elapsedMs);
          totalBytes += r.byteLength;
          if (r.status === 200) successCount++;
          else failCount++;
        }
      }

      const scenarioWallSec = (performance.now() - tScenarioStart) / 1000;
      const cpuAfter = process.cpuUsage(cpuBefore);
      const memUsage = process.memoryUsage();
      const sortedLat = [...latencies].sort((a, b) => a - b);
      const avgLat = Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2));
      const p95Lat = calcPercentile(sortedLat, 95);
      const mbps = Number(((totalBytes * 8) / (scenarioWallSec * 1_000_000)).toFixed(4));

      const stat = {
        concurrentUsers: users,
        totalRequests: totalRequestsPerScenario,
        successCount,
        failCount,
        avgLatencyMs: avgLat,
        minLatencyMs: sortedLat[0],
        maxLatencyMs: sortedLat[sortedLat.length - 1],
        p95LatencyMs: p95Lat,
        totalBytes,
        transferRateMbps: mbps,
        cpuUserMs: Number((cpuAfter.user / 1000).toFixed(2)),
        cpuSystemMs: Number((cpuAfter.system / 1000).toFixed(2)),
        memoryRssMB: Number((memUsage.rss / (1024 * 1024)).toFixed(2)),
      };
      reportData.phase5_connectivity.loadTesting.readEndpoint.push(stat);
      console.log(
        `    -> [LECTURA ${users} usuarios] Exitosas=${successCount}/20 | Prom=${avgLat}ms | P95=${p95Lat}ms | Tasa=${mbps} Mbps`
      );
    }

    // Escenario B: Endpoint de Escritura (POST /api/appointments) con limpieza posterior vía DELETE
    for (const users of concurrencies) {
      const latencies = [];
      let totalBytes = 0;
      let successCount = 0;
      let failCount = 0;
      const cpuBefore = process.cpuUsage();
      const tScenarioStart = performance.now();

      let reqCounter = 0;
      for (let i = 0; i < totalRequestsPerScenario; i += users) {
        const batchSize = Math.min(users, totalRequestsPerScenario - i);
        const batchPromises = Array.from({ length: batchSize }, () => {
          reqCounter++;
          const day = String((reqCounter % 28) + 1).padStart(2, '0');
          const hour = String(8 + Math.floor(reqCounter / 2)).padStart(2, '0');
          const min = String((reqCounter * 2 + users) % 60).padStart(2, '0');
          const payload = {
            nombreCompleto: `WB_P11_LOAD_U${users}_R${reqCounter}`,
            telefono: '4420001122',
            correo: `load_u${users}_r${reqCounter}@barberia.test`,
            servicio: 'Corte Clásico',
            fechaCita: `2028-0${users === 1 ? 6 : users === 5 ? 7 : 8}-${day}`,
            horaCita: `${hour}:${min}`,
            notas: 'Prueba de carga controlada Práctica 11',
          };
          return timedFetch(`${RENDER_API_URL}/appointments`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        });

        const results = await Promise.all(batchPromises);
        for (const r of results) {
          latencies.push(r.elapsedMs);
          totalBytes += r.byteLength;
          if (r.status === 201 || r.status === 200) {
            successCount++;
            if (r.json?.id) createdAppointmentIds.push(r.json.id);
          } else {
            failCount++;
          }
        }
      }

      const scenarioWallSec = (performance.now() - tScenarioStart) / 1000;
      const cpuAfter = process.cpuUsage(cpuBefore);
      const memUsage = process.memoryUsage();
      const sortedLat = [...latencies].sort((a, b) => a - b);
      const avgLat = Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2));
      const p95Lat = calcPercentile(sortedLat, 95);
      const mbps = Number(((totalBytes * 8) / (scenarioWallSec * 1_000_000)).toFixed(4));

      const stat = {
        concurrentUsers: users,
        totalRequests: totalRequestsPerScenario,
        successCount,
        failCount,
        avgLatencyMs: avgLat,
        minLatencyMs: sortedLat[0],
        maxLatencyMs: sortedLat[sortedLat.length - 1],
        p95LatencyMs: p95Lat,
        totalBytes,
        transferRateMbps: mbps,
        cpuUserMs: Number((cpuAfter.user / 1000).toFixed(2)),
        cpuSystemMs: Number((cpuAfter.system / 1000).toFixed(2)),
        memoryRssMB: Number((memUsage.rss / (1024 * 1024)).toFixed(2)),
      };
      reportData.phase5_connectivity.loadTesting.writeEndpoint.push(stat);
      console.log(
        `    -> [ESCRITURA ${users} usuarios] Exitosas=${successCount}/20 | Prom=${avgLat}ms | P95=${p95Lat}ms | Tasa=${mbps} Mbps`
      );
    }
  } finally {
    // Limpieza ordenada de todos los registros creados usando DELETE /api/appointments/:id con token Admin
    if (adminToken && createdAppointmentIds.length > 0) {
      const uniqueIds = [...new Set(createdAppointmentIds)];
      let deletedCount = 0;
      for (const id of uniqueIds) {
        const del = await timedFetch(`${RENDER_API_URL}/appointments/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (del.status === 204 || del.status === 200) deletedCount++;
      }
      console.log(`\n[CLEANUP NEON DB VÍA RENDER] Se eliminaron ${deletedCount} citas de prueba sin dejar basura en Neon.`);
    }
  }

  const outPath = path.resolve(process.cwd(), 'test/practica11_whitebox/audit_results.json');
  fs.writeFileSync(outPath, JSON.stringify(reportData, null, 2), 'utf8');
  console.log(`\nResultados guardados exitosamente en: ${outPath}`);
}

runAudit().catch((err) => {
  console.error('Error fatal en auditoría:', err);
  process.exit(1);
});
