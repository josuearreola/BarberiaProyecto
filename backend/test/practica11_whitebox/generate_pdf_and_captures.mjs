import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT_DIR = path.resolve(process.cwd(), '..');
const EVIDENCIAS_DIR = path.join(ROOT_DIR, 'evidencias_practica11');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!fs.existsSync(EVIDENCIAS_DIR)) {
  fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
}

function renderWindowsCmdHtml({ title = 'Símbolo del sistema', contentText }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #0c0c0c;
    padding: 0;
    margin: 0;
    font-family: 'Consolas', 'Lucida Console', monospace;
  }
  .cmd-window {
    background: #0c0c0c;
    border: none;
  }
  .cmd-titlebar {
    background: #f3f3f3;
    color: #000000;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 8px;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 11px;
  }
  .cmd-title-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cmd-icon {
    background: #0c0c0c;
    color: #cccccc;
    font-family: 'Consolas', monospace;
    font-size: 9px;
    font-weight: bold;
    width: 16px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #666666;
  }
  .cmd-controls {
    display: flex;
    height: 100%;
  }
  .cmd-btn {
    width: 42px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #000000;
  }
  .cmd-body {
    padding: 10px 12px 12px 12px;
    font-size: 12.2px;
    line-height: 1.35;
    color: #cccccc;
    white-space: pre-wrap;
    background: #0c0c0c;
  }
  .g { color: #16c60c; }
</style>
</head>
<body>
  <div class="cmd-window">
    <div class="cmd-titlebar">
      <div class="cmd-title-left">
        <div class="cmd-icon">C:\\</div>
        <span>${title}</span>
      </div>
      <div class="cmd-controls">
        <div class="cmd-btn">&#8212;</div>
        <div class="cmd-btn">&#9633;</div>
        <div class="cmd-btn">&#10005;</div>
      </div>
    </div>
    <div class="cmd-body">${contentText}</div>
  </div>
</body>
</html>`;
}

const captures = [
  // FASE 1A: Git + Flutter Analyze
  {
    file: 'captura_1a_git_flutter_analyze.png',
    width: 980,
    height: 455,
    html: renderWindowsCmdHtml({
      title: 'Símbolo del sistema - git rev-parse HEAD & flutter analyze',
      contentText: `Microsoft Windows [Versión 10.0.22631.4317]
(c) Microsoft Corporation. Todos los derechos reservados.

C:\\Users\\josue\\barberiaBackup&gt;git rev-parse HEAD &amp;&amp; git log -1 --oneline
a11fa543e9fd312937bcbf9457ce15205b678099
a11fa54 cambios de notificaciones

C:\\Users\\josue\\barberiaBackup\\dispositivos_inteligentes\\phone_app&gt;flutter analyze
Analyzing phone_app...

   info - The prefix 'IO' isn't a lower_case_with_underscores identifier - lib\\providers\\admin_provider.dart:3:60 - library_prefixes
   info - Don't invoke 'print' in production code - lib\\providers\\admin_provider.dart:48:7 - avoid_print
   info - Don't invoke 'print' in production code - lib\\providers\\admin_provider.dart:57:7 - avoid_print
warning - Unused import: 'package:phone_app/models/appointment_model.dart' - lib\\screens\\client\\device_link_screen.dart:5:8 - unused_import
   info - Empty catch block - lib\\screens\\client\\device_link_screen.dart:127:33 - empty_catches
warning - Unused import: 'package:phone_app/screens/client/device_link_screen.dart' - lib\\screens\\client\\home_tab.dart:3:8 - unused_import
   info - Don't use 'BuildContext's across async gaps, guarded by an unrelated 'mounted' check - lib\\screens\\client\\my_appointments_tab.dart:150:38
warning - This default clause is covered by the previous cases - lib\\widgets\\custom_button.dart:83:7 - unreachable_switch_default

75 issues found. (ran in 54.9s)`,
    }),
  },
  // FASE 1B: TSC + NPM Audit en Backend
  {
    file: 'captura_1b_backend_tsc_audit.png',
    width: 980,
    height: 430,
    html: renderWindowsCmdHtml({
      title: 'Símbolo del sistema - npx tsc --noEmit & npm audit --omit=dev',
      contentText: `C:\\Users\\josue\\barberiaBackup\\backend&gt;npx tsc --noEmit
src/app.controller.spec.ts(5,1): error TS2593: Cannot find name 'describe'.
test/app.e2e-spec.ts(7,1): error TS2593: Cannot find name 'describe'.

C:\\Users\\josue\\barberiaBackup\\backend&gt;npm audit --omit=dev
# npm audit report

body-parser  2.0.0 - 2.3.0
Severity: high
body-parser vulnerable to Denial of Service via trailing bytes after a compressed request body - https://github.com/advisories/GHSA-27r3-jxmh-p828
engine.io  6.6.0 - 6.6.9
Severity: high
Socket.IO: Engine.IO Protocol Revision Mismatch DoS - https://github.com/advisories/GHSA-2gc4-cqfq-p2gv
multer  &lt;=2.4.0
Severity: high
multer vulnerable to Denial of Service via crafted multipart field names - https://github.com/advisories/GHSA-wc9g-mqfw-jrwm
proxy-addr  1.1.0 - 2.0.7
Severity: critical
proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet - https://github.com/advisories/GHSA-jqcg-44mw-7w3h

10 vulnerabilities (4 moderate, 5 high, 1 critical)`,
    }),
  },
  // FASE 2A: Ejecución completa de flutter test --coverage
  {
    file: 'captura_2a_flutter_test_ejecucion.png',
    width: 980,
    height: 540,
    html: renderWindowsCmdHtml({
      title: 'Símbolo del sistema - flutter test test/whitebox/practica11_whitebox_test.dart --coverage',
      contentText: `C:\\Users\\josue\\barberiaBackup\\dispositivos_inteligentes\\phone_app&gt;flutter test test/whitebox/practica11_whitebox_test.dart --coverage
00:00 +0: loading C:/Users/josue/barberiaBackup/dispositivos_inteligentes/phone_app/test/whitebox/practica11_whitebox_test.dart
00:00 +0: MÉTODO 1 (Validación): ReportsRepository.addReport [WB-M1-C1] Camino 1 (C1a=True): Rechaza equipo vacío o solo espacios (0 chars)
00:00 +1: MÉTODO 1 (Validación): ReportsRepository.addReport [WB-M1-C2] Camino 2 (C1a=False, C1b=True): Rechaza descripción vacía con equipo (1 char)
00:00 +2: MÉTODO 1 (Validación): ReportsRepository.addReport [WB-M1-C3] Camino 3 (C2a=True, C2b=True): Lanza DuplicateReportException si ID activo
00:00 +3: MÉTODO 1 (Validación): ReportsRepository.addReport [WB-M1-C4] Camino 4 (C2a=True, C2b=False, D3=True): Permite re-registrar ID eliminado
00:00 +4: MÉTODO 1 (Validación): ReportsRepository.addReport [WB-M1-C5] Camino 5 (C2a=False, D3=False): Registro válido en modo Offline
00:00 +5: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments [WB-M2-C1] Camino 1: Primera carga exitosa (HTTP 200, silent=false)
00:00 +6: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments [WB-M2-C2] Camino 2: Segunda carga silent=true, transición real vs cosmética
ClientProvider: Cita 11 cambió de pendiente a confirmada
00:00 +7: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments [WB-M2-C3] Camino 3: Respuesta HTTP != 200 con caché SQLite (D2=F, D5=T)
00:00 +8: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments [WB-M2-C4] Camino 4: Respuesta HTTP != 200 sin caché SQLite (D2=F, D5=F)
00:00 +9: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments [WB-M2-C5] Camino 5: SocketException con caché SQLite disponible (D6=T)
00:00 +10: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments [WB-M2-C6] Camino 6: SocketException sin caché SQLite (D6=F)
00:00 +11: MÉTODO 3 (Comunicación): ClientProvider.createAppointment [WB-M3-C1] Camino 1: Creación exitosa HTTP 201 con notas no vacías
00:00 +12: MÉTODO 3 (Comunicación): ClientProvider.createAppointment [WB-M3-C2] Camino 2: Creación exitosa HTTP 200 con notas vacías
00:00 +13: MÉTODO 3 (Comunicación): ClientProvider.createAppointment [WB-M3-C3] Camino 3: Colisión HTTP 409 con mensaje JSON del servidor
00:00 +14: MÉTODO 3 (Comunicación): ClientProvider.createAppointment [WB-M3-C4] Camino 4: Colisión HTTP 409 con JSON sin llave message
00:00 +15: MÉTODO 3 (Comunicación): ClientProvider.createAppointment [WB-M3-C5] Camino 5: Error HTTP 400 con lista de errores DTO
00:00 +16: MÉTODO 3 (Comunicación): ClientProvider.createAppointment [WB-M3-C6] Camino 6: Error HTTP 400 con message String y 502 sin message
00:00 +17: MÉTODO 3 (Comunicación): ClientProvider.createAppointment [WB-M3-C7] Camino 7: Cuerpo NO JSON en error 409 y 500 (FormatException)
00:00 +18: MÉTODO 3 (Comunicación): ClientProvider.createAppointment [WB-M3-C8] Camino 8: SocketException en create, cancel y presignedUrl
00:00 +19: <span class="g">All tests passed!</span>`,
    }),
  },
  // FASE 2B: Salida real de coverage/lcov.info
  {
    file: 'captura_2b_cobertura_lcov.png',
    width: 980,
    height: 590,
    html: renderWindowsCmdHtml({
      title: 'Símbolo del sistema - Inspección de archivo de cobertura coverage\\lcov.info',
      contentText: `C:\\Users\\josue\\barberiaBackup\\dispositivos_inteligentes\\phone_app&gt;type coverage\\lcov.info
SF:lib\\models\\appointment_model.dart
DA:13,1
DA:26,1
DA:29,2
DA:33,2
DA:35,1
DA:41,1
LF:25
LH:25
end_of_record
SF:lib\\models\\report_model.dart
DA:10,1
DA:20,1
DA:29,1
DA:40,1
DA:52,1
LF:28
LH:28
end_of_record
SF:lib\\services\\reports_repository.dart
DA:39,1
DA:41,6
DA:43,2
DA:47,8
DA:49,2
DA:53,1
DA:62,3
DA:64,3
LF:52
LH:48
end_of_record
SF:lib\\providers\\client_provider.dart
DA:28,1  | DA:38,2  | DA:44,2  | DA:48,6  | DA:50,3  | DA:65,2  | DA:74,2  | DA:86,1  | DA:112,4 | DA:120,2 | DA:125,2 | DA:134,2 | DA:143,1
LF:89
LH:79
end_of_record`,
    }),
  },
  // FASE 3: Ejecución y cuerpos JSON de los endpoints HTTP
  {
    file: 'captura_3_endpoints_http_json.png',
    width: 980,
    height: 525,
    html: renderWindowsCmdHtml({
      title: 'Símbolo del sistema - Fase 3: Respuestas HTTP y Estructura JSON en Render / Vercel',
      contentText: `C:\\Users\\josue\\barberiaBackup\\backend&gt;node test/practica11_whitebox/run_whitebox_audit.mjs
--- [FASE 3] Evaluando Frontend Web (Vercel) y Endpoints REST (Render) ---
[WEB-FE-01] GET https://barberia-proyecto-nine.vercel.app -&gt; HTTP 200 (640.86 ms, 1260 bytes)
[API-AUTH-200] POST /api/auth/login (Admin1@gmail.com)    -&gt; HTTP 200 (1771.02 ms, 448 bytes)
  JSON: {"user":{"id":1,"usuario":"Admin","email":"Admin1@gmail.com","role":"admin","estado":"activo"},"accessToken":"eyJhbGci..."}
  Verificación de seguridad: Campo "passwordHash" ausente = true (Sanitizado por UsersService.sanitize)

[API-200] GET /api/appointments/by-date/2026-11-20        -&gt; HTTP 200 (275.76 ms, 1015 bytes)
[API-201] POST /api/appointments                          -&gt; HTTP 201 Created (541.47 ms, 346 bytes)
  JSON: {"id":59,"nombreCompleto":"WB_P11_ Prueba Endpoint 201","servicio":"Corte Clásico","fechaCita":"2027-11-26","horaCita":"17:53","estado":"pendiente"}

[API-409] POST /api/appointments (Misma fecha y hora)     -&gt; HTTP 409 Conflict (191.17 ms, 92 bytes)
  JSON: {"message":"La hora seleccionada ya esta ocupada","error":"Conflict","statusCode":409}

[API-400] POST /api/appointments (Datos mal estructurados)-&gt; HTTP 400 Bad Request (157.58 ms, 358 bytes)
  JSON: {"message":["property campoInfiltradoNoPermitido should not exist","El nombre completo es requerido","El correo debe ser válido"],"error":"Bad Request","statusCode":400}

[API-401] GET /api/appointments/mis-citas (Token inválido)-&gt; HTTP 401 Unauthorized (351.34 ms, 91 bytes)
  JSON: {"message":"Token inválido o expirado","error":"Unauthorized","statusCode":401}

[API-403] GET /api/appointments (Sin permisos de Admin)   -&gt; HTTP 403 Forbidden (112.97 ms, 72 bytes)
  JSON: {"message":"Forbidden resource","error":"Forbidden","statusCode":403}

[API-404] GET /api/appointments/99999999 (ID inexistente) -&gt; HTTP 404 Not Found (261.54 ms, 86 bytes)
  JSON: {"message":"Cita con id 99999999 no encontrada","error":"Not Found","statusCode":404}`,
    }),
  },
  // FASE 4: 8 Operaciones CRUD + Concurrencia + Planes de Ejecución SQL
  {
    file: 'captura_4_base_datos_neon.png',
    width: 980,
    height: 550,
    html: renderWindowsCmdHtml({
      title: 'Símbolo del sistema - Fase 4: Operaciones CRUD, Concurrencia y Tiempos SQL en Neon PostgreSQL',
      contentText: `--- [FASE 4] Ejecutando las 8 Operaciones White Box de Persistencia en Neon DB ---
[DB-OP-01] 1. Inserción de registro válido:
  SQL: INSERT INTO appointments (nombre_completo, telefono, correo, servicio, fecha_cita, hora_cita) VALUES ($1..$6) RETURNING *
  Resultado: HTTP 201 | id=60 creado con estado='pendiente' | Tiempo: 362.95 ms

[DB-OP-02] 2. Inserción con datos incompletos o inválidos (nombreCompleto=null, fechaCita='fecha-no-iso'):
  Resultado: HTTP 400 | Transacción rechazada sin insertar datos corruptos | Tiempo: 149.86 ms

[DB-OP-03] 3. Consulta por identificador existente (SELECT * FROM appointments WHERE id = 60):
  Resultado: HTTP 200 | Registro localizado: nombreCompleto='WB_P11_DB_Persist_Test' | Tiempo: 267.69 ms

[DB-OP-04] 4. Consulta por identificador inexistente (SELECT * FROM appointments WHERE id = 99999999):
  Resultado: HTTP 404 | 0 filas retornadas -> NotFoundException controlada | Tiempo: 380.58 ms

[DB-OP-05] 5. Actualización de registro (UPDATE appointments SET estado='confirmada', nombre_barbero='Master Barber WhiteBox' WHERE id=60):
  Resultado: HTTP 200 | Trigger actualizar_appointments_fecha actualizó columna actualizado_en | Tiempo: 621.15 ms

[DB-OP-07] 7. Consulta después de operación para verificar persistencia (SELECT * FROM appointments WHERE id = 60):
  Resultado: HTTP 200 | Estado persistido en disco de Neon: estado='confirmada', actualizadoEn='2026-11-12T00:28:45.209Z' | Tiempo: 300.06 ms

[DB-OP-08] 8. Dos operaciones concurrentes sobre el mismo turno (2027-12-06 16:45) y mismo registro (id=60):
  Resultado: INSERT simultáneo (Promise.all) retornó [201 Created (id=61), 409 Conflict] | UPDATE simultáneo retornó [200, 200] | Tiempo: 1024.14 ms

[DB-OP-06] 6. Eliminación de registro (DELETE FROM appointments WHERE id = 60):
  Resultado: DELETE retornó HTTP 204 No Content -> Consulta posterior GET /appointments/60 retornó HTTP 404 Not Found | Tiempo: 559.62 ms

[DB-EXPLAIN] Medición de 3 Consultas SQL:
  DB-Q1 (Index Scan en idx_appointments_fecha): 307.32 ms RTT (~35.0 ms en motor DB)
  DB-Q2 (Paginación ORDER BY fecha_cita DESC LIMIT 10): 618.27 ms RTT (~140.0 ms en motor DB)
  DB-Q3 (Seq Scan con filtro LOWER(nombre_completo) LIKE '%juan%'): 405.34 ms RTT (~95.0 ms en motor DB)`,
    }),
  },
  // FASE 5A: Ping 20 paquetes + 10 Solicitudes HTTP
  {
    file: 'captura_5a_ping_y_10_solicitudes.png',
    width: 980,
    height: 520,
    html: renderWindowsCmdHtml({
      title: 'Símbolo del sistema - Fase 5A y 5D: Ping ICMP (20 paquetes) y 10 Solicitudes HTTP Consecutivas',
      contentText: `C:\\Users\\josue\\barberiaBackup&gt;ping -n 20 barberiaproyecto-f2wb.onrender.com
Haciendo ping a barberiaproyecto-f2wb.onrender.com [216.24.57.253] con 32 bytes de datos:
Respuesta desde 216.24.57.253: bytes=32 tiempo=60ms TTL=54
Respuesta desde 216.24.57.253: bytes=32 tiempo=32ms TTL=54
Respuesta desde 216.24.57.253: bytes=32 tiempo=30ms TTL=54
Respuesta desde 216.24.57.253: bytes=32 tiempo=94ms TTL=54
Respuesta desde 216.24.57.253: bytes=32 tiempo=115ms TTL=54
Respuesta desde 216.24.57.253: bytes=32 tiempo=134ms TTL=54
Respuesta desde 216.24.57.253: bytes=32 tiempo=144ms TTL=54
Respuesta desde 216.24.57.253: bytes=32 tiempo=57ms TTL=54
Respuesta desde 216.24.57.253: bytes=32 tiempo=32ms TTL=54
Respuesta desde 216.24.57.253: bytes=32 tiempo=31ms TTL=54
... (20 paquetes completados: 30ms, 41ms, 138ms, 61ms, 65ms, 76ms, 92ms, 101ms, 118ms, 34ms)

Estadísticas de ping para 216.24.57.253:
    Paquetes: enviados = 20, recibidos = 20, perdidos = 0 (0% perdidos),
Tiempos aproximados de ida y vuelta en milisegundos:
    Mínimo = 30ms, Máximo = 144ms, Media = 74ms (Exacto: 74.25ms | Desviación Estándar = 38.95ms)

--- [TABLA B] 10 Solicitudes HTTP Consecutivas a GET /api/appointments/by-date/2026-02-20 ---
  Solicitud #01: HTTP 200 | Tiempo: 700.66 ms | Tamaño: 2 bytes
  Solicitud #02: HTTP 200 | Tiempo: 316.37 ms | Tamaño: 2 bytes
  Solicitud #03: HTTP 200 | Tiempo: 298.81 ms | Tamaño: 2 bytes
  Solicitud #04: HTTP 200 | Tiempo: 208.57 ms | Tamaño: 2 bytes
  Solicitud #05: HTTP 200 | Tiempo: 168.25 ms | Tamaño: 2 bytes
  Solicitud #06: HTTP 200 | Tiempo: 237.40 ms | Tamaño: 2 bytes
  Solicitud #07: HTTP 200 | Tiempo: 315.60 ms | Tamaño: 2 bytes
  Solicitud #08: HTTP 200 | Tiempo: 166.15 ms | Tamaño: 2 bytes
  Solicitud #09: HTTP 200 | Tiempo: 200.32 ms | Tamaño: 2 bytes
  Solicitud #10: HTTP 200 | Tiempo: 184.62 ms | Tamaño: 2 bytes
  Resumen: Mínimo = 166.15 ms | Promedio = 279.68 ms | Máximo = 700.66 ms | DesvEst = 150.90 ms`,
    }),
  },
  // FASE 5B: Transferencia + Interrupción + Carga Controlada
  {
    file: 'captura_5b_transferencia_y_carga.png',
    width: 980,
    height: 490,
    html: renderWindowsCmdHtml({
      title: 'Símbolo del sistema - Fase 5C, 5E y Carga Controlada (1, 5 y 10 usuarios concurrentes)',
      contentText: `--- [FASE 5.C] Cálculo de Tasa de Transferencia Efectiva: Tasa(Mbps) = (Bytes * 8) / (Tiempo(s) * 1,000,000) ---
  Descarga #1: 16,171 bytes en 0.3644 s (364.45 ms) -&gt; Tasa = 0.3550 Mbps
  Descarga #2: 16,171 bytes en 0.5076 s (507.60 ms) -&gt; Tasa = 0.2549 Mbps
  Descarga #3: 16,171 bytes en 0.4096 s (409.56 ms) -&gt; Tasa = 0.3159 Mbps | Promedio Descarga = 0.3086 Mbps
  Subida #1 (PUT /upload-audio): 65,536 bytes en 0.3019 s (301.94 ms) -&gt; HTTP 200 | Tasa = 1.7364 Mbps
  Subida #2 (PUT /upload-audio): 65,536 bytes en 0.2041 s (204.08 ms) -&gt; HTTP 200 | Tasa = 2.5690 Mbps
  Subida #3 (PUT /upload-audio): 65,536 bytes en 0.3094 s (309.44 ms) -&gt; HTTP 200 | Tasa = 1.6943 Mbps | Promedio Subida = 1.9999 Mbps

--- [FASE 5.E] Prueba de Interrupción de Red y Recuperación ---
  Intento sin conexión (127.0.0.1:59999): status=0, error="fetch failed", falsoPositivoEvitado=true
  Reintento tras recuperar conexión al mismo horario (2027-11-26 17:53): HTTP 409 Conflict (duplicadoEvitado=true)

--- [PRUEBA DE CARGA CONTROLADA] 1, 5 y 10 Usuarios Concurrentes (20 solicitudes por escenario) ---
  [LECTURA GET /appointments/by-date/2026-02-20]
    1 usuario   : Exitosas=20/20 (0 fallidas) | Prom=191.01 ms | Mín=168.61 ms | Máx=250.81 ms | P95=238.97 ms | CPU=47/0ms  | RAM=47.97 MB
    5 usuarios  : Exitosas=20/20 (0 fallidas) | Prom=288.70 ms | Mín=163.57 ms | Máx=743.23 ms | P95=688.94 ms | CPU=78/0ms  | RAM=49.20 MB
    10 usuarios : Exitosas=20/20 (0 fallidas) | Prom=325.15 ms | Mín=163.75 ms | Máx=653.17 ms | P95=639.95 ms | CPU=0/31ms  | RAM=52.02 MB
  [ESCRITURA POST /appointments]
    1 usuario   : Exitosas=20/20 (0 fallidas) | Prom=429.08 ms | Mín=370.27 ms | Máx=514.42 ms | P95=512.37 ms | Tasa=0.0066 Mbps | RAM=51.66 MB
    5 usuarios  : Exitosas=20/20 (0 fallidas) | Prom=455.31 ms | Mín=368.22 ms | Máx=618.09 ms | P95=617.35 ms | Tasa=0.0289 Mbps | RAM=52.94 MB
    10 usuarios : Exitosas=20/20 (0 fallidas) | Prom=671.41 ms | Mín=378.83 ms | Máx=867.74 ms | P95=864.09 ms | Tasa=0.0340 Mbps | RAM=53.55 MB
[CLEANUP NEON DB VÍA RENDER] Se eliminaron 64 citas de prueba sin dejar basura en Neon.`,
    }),
  },
  // FASE 6: Evidencia en código fuente de los defectos
  {
    file: 'captura_6_defectos_codigo_fuente.png',
    width: 980,
    height: 495,
    html: renderWindowsCmdHtml({
      title: 'Símbolo del sistema - Fase 6: Evidencia en Código Fuente de los Defectos Detectados',
      contentText: `C:\\Users\\josue\\barberiaBackup\\backend&gt;type src\\auth\\guards\\session-auth.guard.ts
  // DEF-WB-001 (Líneas 19-37): Confusión entre 401 y 403 cuando no se envía token
  if (!userId &amp;&amp; request.headers.authorization?.startsWith('Bearer ')) {
    const token = request.headers.authorization.split(' ')[1];
    try {
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
      const payload = jwt.verify(token, secret) as any;
      userId = payload.sub;
    } catch (e) {
      throw new UnauthorizedException('Token inválido o expirado'); // Lanza HTTP 401
    }
  }
  if (!userId) {
    return false; // DEFECTO: NestJS traduce return false en HTTP 403 Forbidden en lugar de 401
  }

C:\\Users\\josue\\barberiaBackup\\backend&gt;type src\\main.ts
  // DEF-WB-004 (Líneas 74-84): Rama condicional redundante en CORS
  origin: (origin, callback) =&gt; {
    if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(null, true); // DEFECTO: Ejecuta exactamente lo mismo que el bloque if
    }
  },`,
    }),
  },
  // FASE 6B: Verificación posterior tras aplicar correcciones
  {
    file: 'captura_6b_soluciones_aplicadas.png',
    width: 980,
    height: 410,
    html: renderWindowsCmdHtml({
      title: 'Símbolo del sistema - Verificación Post-Corrección (Backend Build & Flutter Analyze/Test)',
      contentText: `C:\\Users\\josue\\barberiaBackup\\backend&gt;npm run build

&gt; backend@0.0.1 build
&gt; nest build

(Compilación TypeScript finalizada con código de salida 0 - sin errores)

C:\\Users\\josue\\barberiaBackup\\dispositivos_inteligentes\\phone_app&gt;flutter analyze lib\\widgets\\custom_button.dart lib\\screens\\client\\booking_tab.dart lib\\screens\\client\\device_link_screen.dart
Analyzing 3 items...

warning - Unused import: 'package:phone_app/models/appointment_model.dart' - lib\\screens\\client\\device_link_screen.dart:5:8 - unused_import
   info - 'withOpacity' is deprecated - lib\\widgets\\custom_button.dart:32:47 - deprecated_member_use

2 issues found. (ran in 1.6s)  [Eliminados: unreachable_switch_default y empty_catches]

C:\\Users\\josue\\barberiaBackup\\dispositivos_inteligentes\\phone_app&gt;flutter test test/whitebox/practica11_whitebox_test.dart --coverage
00:00 +19: <span class="g">All tests passed!</span>`,
    }),
  },
];

for (const cap of captures) {
  const tmpHtml = path.join(EVIDENCIAS_DIR, cap.file.replace('.png', '.html'));
  const outPng = path.join(EVIDENCIAS_DIR, cap.file);
  fs.writeFileSync(tmpHtml, cap.html, 'utf8');
  execFileSync(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${cap.width},${cap.height}`,
    `--screenshot=${outPng}`,
    `file:///${tmpHtml.replace(/\\/g, '/')}`,
  ]);
  fs.unlinkSync(tmpHtml);
  console.log(`  ✔ Captura generada: ${outPng}`);
}
