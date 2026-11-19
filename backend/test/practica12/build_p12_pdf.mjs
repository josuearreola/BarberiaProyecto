import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = process.cwd();
const P12_DIR = path.resolve(ROOT, 'backend/test/practica12');
const CAP_DIR = path.resolve(P12_DIR, 'captures');
const BASE_DIR = path.resolve(P12_DIR, 'baseline_code');
const DELIVERABLES_DIR = path.resolve(ROOT, 'EntregablesPractica12');
const PDF_OUT = path.resolve(ROOT, 'PRACTICA_12_REPORTE.pdf');

fs.mkdirSync(DELIVERABLES_DIR, { recursive: true });

const cloud = JSON.parse(fs.readFileSync(path.join(P12_DIR, 'cloud_stress_results.json'), 'utf8'));
const bBefore = JSON.parse(fs.readFileSync(path.join(P12_DIR, 'backend_bench_before.json'), 'utf8'));
const bAfter = JSON.parse(fs.readFileSync(path.join(P12_DIR, 'backend_bench_after.json'), 'utf8'));

function imgDataUri(filename) {
  const buf = fs.readFileSync(path.join(CAP_DIR, filename));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightLine(raw, lang) {
  const kwSet =
    lang === 'dart'
      ? new Set(['import', 'class', 'final', 'const', 'static', 'async', 'await', 'try', 'catch', 'on', 'if', 'else', 'return', 'for', 'in', 'continue', 'throw', 'void', 'bool', 'int', 'double', 'String', 'List', 'Map', 'Future', 'Duration', 'true', 'false', 'null', 'required'])
      : new Set(['import', 'export', 'class', 'private', 'readonly', 'async', 'await', 'try', 'finally', 'if', 'else', 'return', 'const', 'let', 'for', 'of', 'new', 'throw', 'Promise', 'Map', 'true', 'false', 'null', 'unknown', 'string', 'number']);

  // Tokenizador de una sola pasada sobre texto sin HTML para evitar colisiones con <span class="...">
  const tokenRe = /(\/\/[^\n]*|'[^'\n]*'|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b)/g;
  let out = '';
  let lastIdx = 0;
  for (const match of raw.matchAll(tokenRe)) {
    const idx = match.index ?? 0;
    if (idx > lastIdx) {
      out += esc(raw.slice(lastIdx, idx));
    }
    const tok = match[0];
    if (tok.startsWith('//') && !raw.slice(Math.max(0, idx - 6), idx).includes('http')) {
      out += `<span class="cm">${esc(tok)}</span>`;
    } else if (tok.startsWith("'")) {
      out += `<span class="str">${esc(tok)}</span>`;
    } else if (kwSet.has(tok)) {
      out += `<span class="kw">${esc(tok)}</span>`;
    } else if (/^\d/.test(tok)) {
      out += `<span class="num">${esc(tok)}</span>`;
    } else {
      out += esc(tok);
    }
    lastIdx = idx + tok.length;
  }
  if (lastIdx < raw.length) {
    out += esc(raw.slice(lastIdx));
  }
  return out;
}

function renderCodeBlock(title, code, lang = 'dart', startLine = 1) {
  const lines = code.trimEnd().split(/\r?\n/);
  const rows = lines
    .map((ln, idx) => {
      const num = startLine + idx;
      return `<div class="code-line"><span class="ln">${num}</span><span class="lc">${highlightLine(ln, lang) || ' '}</span></div>`;
    })
    .join('\n');
  return `<div class="vscode-box">
    <div class="vscode-hdr"><span>${esc(title)}</span><span>${lang.toUpperCase()}</span></div>
    <div class="vscode-body">${rows}</div>
  </div>`;
}

// Extractos reales de código original vs optimizado
const origApiSnippet = fs.readFileSync(path.join(BASE_DIR, 'api_service.original.dart'), 'utf8')
  .split(/\r?\n/).slice(14, 42).join('\n');

const optApiSnippet = fs.readFileSync(path.resolve(ROOT, 'dispositivos_inteligentes/phone_app/lib/services/api_service.dart'), 'utf8')
  .split(/\r?\n/).slice(64, 126).join('\n');

const origClientSnippet = fs.readFileSync(path.join(BASE_DIR, 'client_provider.original.dart'), 'utf8')
  .split(/\r?\n/).slice(27, 120).join('\n');

const optClientSnippet = fs.readFileSync(path.resolve(ROOT, 'dispositivos_inteligentes/phone_app/lib/providers/client_provider.dart'), 'utf8')
  .split(/\r?\n/).slice(155, 224).join('\n');

const origBackendSnippet = `// backend/src/appointments/appointments.controller.ts (ORIGINAL)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

// backend/src/appointments/appointments.service.ts (ORIGINAL)
  async findByDate(fecha: string): Promise<Appointment[]> {
    return await this.appointmentsRepository.find({
      where: { fechaCita: fecha },
      order: { horaCita: 'ASC' },
    });
  }`;

const optBackendSnippet = `// backend/src/appointments/appointments.controller.ts (OPTIMIZADO - Idempotency-Key)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const key = idempotencyKey?.trim();
    if (key) {
      const cached = this.idempotencyCache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.value;
      const pending = this.inFlightCreates.get(key);
      if (pending) return pending;
      ...
    }
    const created = await this.appointmentsService.create(createAppointmentDto);
    this.appointmentsService.invalidateDateCache(createAppointmentDto.fechaCita);
    return created;
  }

// backend/src/appointments/appointments.service.ts (OPTIMIZADO - Proyección + Cache TTL 5s)
  async findByDate(fecha: string): Promise<Appointment[]> {
    const now = Date.now();
    const cached = this.dateCache.get(fecha);
    if (cached && cached.expiresAt > now) return cached.data;

    const result = await this.appointmentsRepository.find({
      select: ['id', 'nombreCompleto', 'servicio', 'fechaCita', 'horaCita', 'estado', 'nombreBarbero'],
      where: { fechaCita: fecha },
      order: { horaCita: 'ASC' },
    });
    this.dateCache.set(fecha, { data: result, expiresAt: now + 5000 });
    return result;
  }`;

// SVG de curva de saturación real (Fase 3 API Read)
const readWaves = cloud.fase3.apiReadWaves; // c=5, 15, 30, 50
const saturationSvg = `<svg width="680" height="210" viewBox="0 0 680 210" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:8px auto;">
  <rect x="0" y="0" width="680" height="210" fill="#ffffff" stroke="#cccccc" stroke-width="1"/>
  <text x="340" y="18" font-family="Arial" font-size="11" font-weight="bold" text-anchor="middle" fill="#111">Curva de Saturacion API Lectura (GET /api/appointments/by-date/2027-06-15)</text>
  <line x1="60" y1="170" x2="620" y2="170" stroke="#333" stroke-width="1.2"/>
  <line x1="60" y1="35" x2="60" y2="170" stroke="#333" stroke-width="1.2"/>
  <line x1="620" y1="35" x2="620" y2="170" stroke="#666" stroke-width="1.2" stroke-dasharray="3,3"/>
  <!-- Etiquetas Y izquierda (Latencia ms: 0 a 900ms) -->
  <text x="52" y="173" font-family="Arial" font-size="9" text-anchor="end">0 ms</text>
  <text x="52" y="128" font-family="Arial" font-size="9" text-anchor="end">300 ms</text>
  <text x="52" y="83" font-family="Arial" font-size="9" text-anchor="end">600 ms</text>
  <text x="52" y="39" font-family="Arial" font-size="9" text-anchor="end">900 ms</text>
  <!-- Etiquetas Y derecha (RPS: 0 a 45) -->
  <text x="626" y="173" font-family="Arial" font-size="9">0 RPS</text>
  <text x="626" y="110" font-family="Arial" font-size="9">22 RPS</text>
  <text x="626" y="42" font-family="Arial" font-size="9">45 RPS</text>
  <!-- Eje X (c=5, 15, 30, 50) -->
  <text x="130" y="186" font-family="Arial" font-size="9" text-anchor="middle">5 usuarios</text>
  <text x="275" y="186" font-family="Arial" font-size="9" text-anchor="middle">15 usuarios</text>
  <text x="420" y="186" font-family="Arial" font-size="9" text-anchor="middle">30 usuarios (Pico)</text>
  <text x="565" y="186" font-family="Arial" font-size="9" text-anchor="middle">50 usuarios (Saturado)</text>
  <!-- Linea Latencia Promedio: 316.86 -> 367.06 -> 392.7 -> 799.57 ms (y = 170 - (ms/900)*135) -->
  <polyline fill="none" stroke="#111111" stroke-width="2.2" points="130,122.5 275,114.9 420,111.1 565,50.1"/>
  <circle cx="130" cy="122.5" r="3.5" fill="#111"/><text x="130" y="115" font-family="Arial" font-size="8.5" text-anchor="middle">316.9 ms</text>
  <circle cx="275" cy="114.9" r="3.5" fill="#111"/><text x="275" y="107" font-family="Arial" font-size="8.5" text-anchor="middle">367.1 ms</text>
  <circle cx="420" cy="111.1" r="3.5" fill="#111"/><text x="420" y="103" font-family="Arial" font-size="8.5" text-anchor="middle">392.7 ms</text>
  <circle cx="565" cy="50.1" r="4" fill="#111"/><text x="565" y="42" font-family="Arial" font-size="8.5" font-weight="bold" text-anchor="middle">799.6 ms</text>
  <!-- Linea RPS: 14.12 -> 30.7 -> 37.63 -> 27.28 (y = 170 - (rps/45)*135) -->
  <polyline fill="none" stroke="#666666" stroke-width="2" stroke-dasharray="5,3" points="130,127.6 275,77.9 420,57.1 565,88.2"/>
  <rect x="127" y="124.6" width="6" height="6" fill="#666"/><text x="130" y="142" font-family="Arial" font-size="8.5" fill="#444" text-anchor="middle">14.1 RPS</text>
  <rect x="272" y="74.9" width="6" height="6" fill="#666"/><text x="275" y="70" font-family="Arial" font-size="8.5" fill="#444" text-anchor="middle">30.7 RPS</text>
  <rect x="417" y="54.1" width="6" height="6" fill="#666"/><text x="420" y="49" font-family="Arial" font-size="8.5" font-weight="bold" fill="#222" text-anchor="middle">37.6 RPS</text>
  <rect x="562" y="85.2" width="6" height="6" fill="#666"/><text x="565" y="102" font-family="Arial" font-size="8.5" font-weight="bold" fill="#444" text-anchor="middle">27.3 RPS</text>
  <!-- Leyenda -->
  <line x1="185" y1="200" x2="210" y2="200" stroke="#111" stroke-width="2.2"/><text x="215" y="203" font-family="Arial" font-size="9">Latencia promedio (ms)</text>
  <line x1="365" y1="200" x2="390" y2="200" stroke="#666" stroke-width="2" stroke-dasharray="5,3"/><text x="395" y="203" font-family="Arial" font-size="9">Throughput (RPS)</text>
</svg>`;

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  @page { size: letter; margin: 16mm 15mm 16mm 15mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.8pt; line-height: 1.44; color: #111111; }
  h1 { font-size: 15pt; margin: 0 0 10px 0; }
  h2 { font-size: 12pt; margin: 18px 0 6px 0; page-break-after: avoid; }
  h3 { font-size: 10.3pt; margin: 11px 0 4px 0; page-break-after: avoid; }
  p { margin: 4px 0 8px 0; text-align: justify; }
  ul, ol { margin: 4px 0 8px 18px; padding: 0; }
  li { margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px 0; font-size: 8.8pt; page-break-inside: auto; }
  th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background-color: #ececec; font-weight: bold; }
  tr { page-break-inside: avoid; }
  .meta-box { border: 1px solid #333; padding: 8px 10px; margin: 8px 0 12px 0; font-size: 9pt; background: #fafafa; }
  .qa-item { margin: 7px 0 9px 0; }
  .qa-q { font-weight: bold; margin-bottom: 2px; }
  .img-wrap { margin: 8px 0 10px 0; text-align: center; page-break-inside: avoid; }
  .img-wrap img { width: 100%; max-width: 680px; height: auto; display: block; margin: 0 auto; }
  .cap-txt { font-size: 8.3pt; color: #333; margin-top: 3px; font-style: italic; }
  code { font-family: Consolas, monospace; font-size: 8.7pt; background: #f2f2f2; padding: 1px 3px; }
  /* Formato VS Code Dark+ */
  .vscode-box { background: #1e1e1e; color: #d4d4d4; font-family: Consolas, 'Courier New', monospace; font-size: 7.7pt; line-height: 1.35; margin: 7px 0 10px 0; border-radius: 3px; overflow: hidden; page-break-inside: auto; }
  .vscode-hdr { background: #2d2d2d; color: #cccccc; padding: 4px 8px; font-size: 7.8pt; display: flex; justify-content: space-between; border-bottom: 1px solid #3c3c3c; page-break-after: avoid; }
  .vscode-body { padding: 6px 0; }
  .code-line { display: flex; padding: 0 8px; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; page-break-inside: avoid; }
  .ln { width: 28px; flex-shrink: 0; color: #858585; text-align: right; padding-right: 10px; user-select: none; }
  .lc { flex: 1; }
  .kw { color: #569cd6; }
  .str { color: #ce9178; }
  .cm { color: #6a9955; }
  .num { color: #b5cea8; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>

<h1>PRÁCTICA 12. Optimización, pruebas de estrés y resiliencia de aplicaciones móviles</h1>

<h2>Fase 1. Recuperación de resultados de la auditoría anterior (Práctica 11)</h2>
<p>A partir de los registros obtenidos en <code>audit_results.json</code> y el reporte de Práctica 11, se seleccionaron cinco hallazgos críticos con sus hipótesis técnicas verificables:</p>

<ol>
  <li><strong>Método con alto tiempo de ejecución / complejidad:</strong> <code>ClientProvider.createAppointment()</code> junto con <code>ClientProvider.fetchMyAppointments()</code> en la app móvil, y <code>AppointmentsService.findAll()</code> en el backend (complejidad ciclomática CC = 14).<br>
  <em>Hipótesis técnica:</em> Cada creación de cita ejecuta un <code>POST</code> seguido de un <code>GET /appointments/mis-citas</code> completo aunque la respuesta <code>201</code> ya incluye la cita creada, duplicando la latencia de red; además, las consultas periódicas en modo silencioso sobreescriben SQLite y disparan <code>notifyListeners()</code> aunque no existan cambios.</li>
  <li><strong>Endpoint con latencia elevada:</strong> <code>POST /api/auth/login</code> (<code>1,771.02 ms</code> promedio) y <code>POST /api/appointments</code> (<code>541.47 ms</code> individual; <code>671.41 ms</code> promedio y <code>864.09 ms</code> P95 bajo 10 usuarios concurrentes).<br>
  <em>Hipótesis técnica:</em> El hashing adaptativo de <code>bcryptjs</code> explica la demora fija del login, mientras que <code>POST /appointments</code> ejecuta consultas secuenciales no cacheadas (validación previa <code>findOne</code> + <code>save</code>) sobre conexiones serverless de Neon.</li>
  <li><strong>Consulta de base de datos optimizable:</strong> Búsqueda textual <code>GET /api/appointments?search=juan</code> (<code>DB-Q3 = 405.34 ms</code> RTT con <code>LOWER(...) LIKE '%search%'</code>) y <code>AppointmentsService.findByDate()</code> con <code>SELECT *</code> sin proyección.<br>
  <em>Hipótesis técnica:</em> Traer todas las columnas (incluyendo notas largas y metadatos) e ignorar proyecciones selectivas incrementa el volumen JSON serializado por TypeORM y el I/O de red/disco.</li>
  <li><strong>Problema de conectividad o recuperación:</strong> <code>ApiService</code> instancia solicitudes HTTP de un solo uso sin <code>timeout</code> explícito, sin reintentos con espera progresiva (<em>exponential backoff</em>) ni cabecera <code>Idempotency-Key</code>.<br>
  <em>Hipótesis técnica:</em> Una pérdida de enlace tras el envío o un servidor congestionado deja a la UI esperando indefinidamente o provoca un error no recuperable; si el usuario reintenta manualmente una escritura cuyo <code>commit</code> ya ocurrió en servidor, recibe un fallo falso o arriesga duplicación.</li>
  <li><strong>Riesgo de consumo excesivo de memoria o CPU:</strong> Deserialización JSON síncrona de listas extensas en el hilo UI, apertura repetida de conexiones TLS por petición en <code>ApiService</code> y escrituras masivas redundantes en <code>LocalDbService.saveAppointments()</code>.<br>
  <em>Hipótesis técnica:</em> Reemplazar el pool TCP/TLS por un cliente persistente, diferir parsing pesado a un Isolate secundario (<code>compute</code>) y aplicar comparación de estado (<em>snapshot diffing</em>) reducirá reconstrucciones de widgets, escrituras en flash y ciclos de CPU.</li>
</ol>

<h2>Fase 2. Profiling y diagnóstico de la aplicación móvil (Flutter)</h2>
<p>Se ejecutó la suite <code>fase2_profiling_baseline_test.dart</code> midiendo el código original (antes de optimizar) con reloj de alta resolución (<code>Stopwatch</code>), uso de memoria residente del proceso Dart VM (<code>ProcessInfo.currentRss</code> / <code>ProcessInfo.maxRss</code>), conteo real de peticiones HTTP loopback, escrituras SQLite, notificaciones de estado y tiempos de cuadro UI.</p>

<table>
  <tr><th>Prueba obligatoria (Fase 2)</th><th>Carga aplicada</th><th>Resultado observado (Baseline)</th><th>Diagnóstico técnico</th></tr>
  <tr><td>1. Consulta repetida</td><td>50 ejecuciones de patrón <code>fetchMyAppointments(silent: true)</code> con 100 citas (<code>33,429 B</code>)</td><td><code>242.58 ms</code> totales (<code>4.85 ms/op</code>), <code>50</code> escrituras SQLite, <code>50</code> llamadas <code>notifyListeners()</code></td><td>Redundancia del 98%: reescribe SQLite y notifica a la UI aunque el arreglo sea idéntico.</td></tr>
  <tr><td>2. Operación de escritura</td><td>20 registros de cita simulados (<code>createAppointment</code>)</td><td><code>181.30 ms</code> totales (<code>9.07 ms/op</code>), <code>20 POST + 20 GET = 40</code> peticiones HTTP</td><td>Cada escritura fuerza un segundo viaje HTTP <code>GET</code> completo e incrementa escrituras SQLite.</td></tr>
  <tr><td>3. Navegación entre pantallas</td><td>15 transiciones entre 3 pestañas con listas de 120 citas</td><td><code>819.25 ms</code> totales, <code>54.60 ms</code> promedio por frame, pico máximo <code>464.63 ms</code>, <code>15/15</code> frames &gt; 16.67 ms</td><td>Reconstrucción completa del árbol de widgets en cada cambio de pestaña.</td></tr>
  <tr><td>4. Procesamiento de datos</td><td>Deserialización JSON + ordenamiento de 1,500 citas (<code>509,564 B</code>) x 20 ciclos (30,000 objetos)</td><td><code>5.50 ms</code> promedio por ciclo en isolate principal</td><td>En listas amplias en hardware móvil de gama media bloquea el presupuesto de 16.67 ms (60 fps).</td></tr>
  <tr><td>5. Consumo CPU y memoria</td><td>Medición continua durante ciclo completo de lectura/escritura/parsing</td><td>RAM inicial: <code>132.66 MB</code>, RAM máxima: <code>156.89 MB</code>, RAM final: <code>149.04 MB</code> (+16.38 MB retenidos)</td><td>Aumento de RSS por asignaciones temporales y clientes HTTP sin reutilización.</td></tr>
  <tr><td>6. Bloqueos / retrasos UI</td><td>Umbral 60 FPS (16.67 ms/frame) durante navegación y polling</td><td>Pico de <code>464.63 ms</code> en primer render y 100% de frames de prueba &gt; 16.67 ms</td><td>Riesgo directo de <em>jank</em> perceptible al alternar pestañas o recibir actualizaciones.</td></tr>
</table>

<div class="img-wrap">
  <img src="${imgDataUri('cap1_fase2_flutter_baseline.png')}" alt="Profiling Baseline Flutter" />
  <div class="cap-txt">Captura 1. Ejecución real del profiler baseline en Dart VM / Flutter antes de aplicar las optimizaciones.</div>
</div>

<h2>Fase 3. Pruebas de estrés del sitio web y API</h2>
<p>Mediante el script <code>run_cloud_stress_and_db.mjs</code> se sometió a estrés progresivo al sitio web en Vercel (PWA) y a dos endpoints reales en Render + Neon PostgreSQL: lectura (<code>GET /api/appointments/by-date/2027-06-15</code>) y escritura (<code>POST /api/appointments</code> con limpieza posterior garantizada).</p>

<table>
  <tr><th>Objetivo / Endpoint</th><th>Usuarios concurrentes (Peticiones)</th><th>RPS</th><th>Promedio (ms)</th><th>P90 (ms)</th><th>P95 (ms)</th><th>Máximo (ms)</th><th>Errores (%)</th><th>Códigos HTTP</th></tr>
  <tr><td>Web PWA Vercel</td><td>5 (15 reqs)</td><td>23.77</td><td>197.12</td><td>324.15</td><td>327.72</td><td>327.72</td><td>0%</td><td>200: 15</td></tr>
  <tr><td>Web PWA Vercel</td><td>15 (45 reqs)</td><td>53.87</td><td>229.07</td><td>432.00</td><td>616.14</td><td>619.24</td><td>0%</td><td>200: 45</td></tr>
  <tr><td>Web PWA Vercel</td><td>30 (60 reqs)</td><td>38.16</td><td>316.83</td><td>571.81</td><td>1,481.80</td><td>1,559.05</td><td>0%</td><td>200: 60</td></tr>
  <tr><td>API Lectura (<code>by-date</code>)</td><td>5 (25 reqs)</td><td>14.12</td><td>316.86</td><td>699.25</td><td>714.87</td><td>733.07</td><td>0%</td><td>200: 25</td></tr>
  <tr><td>API Lectura (<code>by-date</code>)</td><td>15 (45 reqs)</td><td>30.70</td><td>367.06</td><td>784.08</td><td>831.46</td><td>1,209.58</td><td>0%</td><td>200: 45</td></tr>
  <tr><td>API Lectura (<code>by-date</code>)</td><td>30 (60 reqs)</td><td><strong>37.63</strong></td><td>392.70</td><td>607.35</td><td>1,549.09</td><td>1,583.39</td><td>0%</td><td>200: 60</td></tr>
  <tr><td>API Lectura (<code>by-date</code>)</td><td>50 (100 reqs)</td><td><strong>27.28</strong></td><td><strong>799.57</strong></td><td>1,156.77</td><td>1,657.86</td><td>3,652.53</td><td>0%</td><td>200: 100</td></tr>
  <tr><td>API Escritura (<code>POST</code>)</td><td>1 (5 reqs)</td><td>2.25</td><td>445.22</td><td>582.18</td><td>582.18</td><td>582.18</td><td>0%</td><td>201: 5</td></tr>
  <tr><td>API Escritura (<code>POST</code>)</td><td>5 (10 reqs)</td><td>9.04</td><td>518.18</td><td>663.62</td><td>665.43</td><td>665.43</td><td>0%</td><td>201: 10</td></tr>
  <tr><td>API Escritura (<code>POST</code>)</td><td>15 (15 reqs)</td><td>14.91</td><td>740.00</td><td>987.17</td><td>1,004.18</td><td>1,004.18</td><td>0%</td><td>201: 15</td></tr>
</table>

${saturationSvg}

<p><strong>Comportamiento del servidor y respuesta técnica sobre saturación:</strong> El aumento de usuarios <strong>no</strong> produce un incremento lineal ni mantiene la capacidad de escalado indefinidamente: existe un <strong>punto de saturación claro entre 30 y 50 usuarios concurrentes</strong>. En el endpoint de lectura, el rendimiento crece desde <code>14.12 RPS</code> (5 usuarios) hasta su pico de <code>37.63 RPS</code> con 30 usuarios concurrentes (latencia promedio estable entre <code>316.86 ms</code> y <code>392.70 ms</code>). Al elevar la carga a 50 usuarios simultáneos, la capacidad cae a <code>27.28 RPS</code> (−27.5%) y la latencia promedio se duplica abruptamente a <code>799.57 ms</code> con colas máximas de <code>3,652.53 ms</code> por contención del event loop en el contenedor de Render y espera en el pool de conexiones hacia Neon. El mismo fenómeno ocurre en Vercel a partir de 15–30 usuarios (de <code>53.87</code> a <code>38.16 RPS</code> con P95 de <code>1,481.80 ms</code>).</p>

<div class="img-wrap">
  <img src="${imgDataUri('cap2_fase3_4_cloud_stress_db.png')}" alt="Estres API Web y DB" />
  <div class="cap-txt">Captura 2. Ejecución de pruebas de estrés progresivo (Fase 3) y pruebas de base de datos (Fase 4) con limpieza verificada.</div>
</div>

<h2>Fase 4. Pruebas avanzadas de base de datos</h2>
<p>Sobre 15 registros semilla temporales insertados en Neon PostgreSQL (y eliminados junto con todos los registros de estrés al finalizar), se ejecutaron las 6 pruebas obligatorias de base de datos a través del API NestJS/TypeORM en producción:</p>

<table>
  <tr><th>Prueba DB</th><th>Operación evaluada</th><th>Tiempo promedio / total</th><th>Registros / Carga</th><th>Hallazgo técnico</th></tr>
  <tr><td>1. Individual por ID</td><td><code>GET /api/appointments/:id</code> (5 corridas)</td><td><code>360.10 ms</code> prom. (min <code>278.30</code>, P95 <code>619.87</code>)</td><td>1 registro (<code>363 B</code>)</td><td>Acceso directo por clave primaria; latencia dominada por RTT TLS Render–Neon.</td></tr>
  <tr><td>2. Conjunto pequeño</td><td><code>GET /api/appointments/by-date/2027-09-01</code> (5 corridas)</td><td><code>214.20 ms</code> prom. (min <code>179.28</code>, P95 <code>250.39</code>)</td><td>10 registros (<code>3,656 B</code>)</td><td>Usa índice <code>fecha_cita</code>, pero envía columnas innecesarias (correo, teléfono, notas).</td></tr>
  <tr><td>3. Conjunto grande</td><td><code>GET /api/appointments?page=1&amp;limit=50</code> (5 corridas)</td><td><code>371.09 ms</code> prom. (P95 <code>408.48</code>)</td><td>50 de 91 totales (<code>17,467 B</code>)</td><td>Ejecuta doble consulta (<code>SELECT</code> + <code>COUNT(*)</code>) vía <code>getManyAndCount()</code>.</td></tr>
  <tr><td>4. Con filtros</td><td><code>?fecha=2027-09-01&amp;estado=pendiente&amp;search=P12_DB_SEED</code></td><td><code>425.88 ms</code> prom. (P95 <code>536.96</code>)</td><td>10 registros (<code>3,711 B</code>)</td><td>Es la consulta más lenta (+98.8% vs consulta por fecha simple) por filtros <code>LOWER(...) LIKE</code>.</td></tr>
  <tr><td>5. Updates concurrentes</td><td>5 <code>PATCH /:id/estado</code> simultáneos sobre IDs distintos</td><td><code>1,227.15 ms</code> totales (<code>1,084.18 ms/op</code>)</td><td>5 registros actualizados</td><td>HTTP <code>200</code> en los 5 casos; verificación posterior confirmó 100% de integridad.</td></tr>
  <tr><td>6. Escrituras mismo registro / slot</td><td>5 <code>PATCH</code> simultáneos al mismo ID + 5 <code>POST</code> paralelos al mismo horario <code>2027-09-10 12:00</code></td><td><code>775.77 ms</code> (PATCH) / <code>428.73 ms</code> (POST race)</td><td>PATCH: 4x <code>200</code> + 1x <code>400</code> (estado inválido) / POST: <strong>5x <code>201</code></strong></td><td><strong>Defecto de concurrencia detectado en vivo:</strong> la instancia en Render creó 5 citas duplicadas para el mismo horario por condición de carrera <em>check-then-act</em> sin índice único activo en esa instancia.</td></tr>
</table>

<p><strong>Análisis obligatorio Fase 4:</strong> (a) <em>Uso de índices:</em> las búsquedas por <code>id</code> y <code>fecha_cita</code> aprovechan índices B-Tree, mientras <code>search</code> con <code>LOWER(...) LIKE '%texto%'</code> degrada el planificador (+425.88 ms); (b) <em>Consultas repetidas innecesarias:</em> cada apertura del calendario o vista TV ejecutaba nuevamente <code>findByDate</code> sin caché y cada escritura del móvil disparaba un <code>GET</code> completo adicional; (c) <em>Bloqueos y concurrencia:</em> sobre filas distintas PostgreSQL mantuvo consistencia total sin deadlocks, pero sobre una misma franja horaria dos o más <code>POST</code> concurrentes pasaron el <code>findOne</code> previo antes de ejecutar <code>save</code>, demostrando la necesidad de validación transaccional/única e idempotencia; (d) <em>Integridad posterior:</em> se ejecutó limpieza automática eliminando los <code>50</code> registros de prueba (<code>remainingP12Rows: 0</code>); (e) <em>Optimización implementada:</em> en <code>AppointmentsService.findByDate</code> se reemplazó el <code>SELECT *</code> completo por proyección selectiva de 7 campos necesarios y se incorporó un caché TTL de 5 segundos invalidado automáticamente en cada escritura, además de proyectar columnas en <code>findAll</code> evitando cargar <code>notas</code> en listados.</p>

<div class="page-break"></div>

<h2>Fase 5. Pruebas de resiliencia y recuperación (RES-01 a RES-08)</h2>
<p>Se implementaron pruebas automatizadas en <code>fase5_resilience_test.dart</code> inyectando fallos controlados sobre <code>ApiService</code> y <code>ClientProvider</code> para verificar la tolerancia ante desconexiones, timeouts, errores HTTP y concurrencia.</p>

<table>
  <tr><th>Código</th><th>Escenario probado</th><th>Resultado esperado</th><th>Resultado real medido</th><th>Estado</th></tr>
  <tr><td>RES-01</td><td>Pérdida de Internet durante una consulta</td><td>Error controlado y respaldo offline</td><td>3 intentos totales (2 reintentos con backoff); fallback a SQLite local con caché o mensaje controlado en <code>31 ms</code>.</td><td><strong>PASS</strong></td></tr>
  <tr><td>RES-02</td><td>Pérdida de Internet durante una escritura</td><td>No confirmar falsamente el registro</td><td>Retorna <code>false</code> tras agotarse los 3 intentos; 0 registros locales falsos y mensaje <em>"Error de conexión con el servidor."</em></td><td><strong>PASS</strong></td></tr>
  <tr><td>RES-03</td><td>Servidor sin respuesta (300 ms delay &gt; 50 ms timeout)</td><td>Timeout controlado</td><td><code>TimeoutException</code> controlada en <code>110 ms</code> totales (sin colgar UI); <code>isLoading = false</code> y mensaje de tiempo agotado.</td><td><strong>PASS</strong></td></tr>
  <tr><td>RES-04</td><td>Respuesta HTTP 500</td><td>Mostrar error y conservar estabilidad</td><td>Retorna estado controlado <em>"Error al cargar tus citas: 500"</em> manteniendo estabilidad de la app.</td><td><strong>PASS</strong></td></tr>
  <tr><td>RES-05</td><td>Respuesta HTTP 401 o 403</td><td>Gestionar autenticación / permisos</td><td>Ejecuta <strong>1 solo intento</strong> (sin reintentar credenciales inválidas), activa <code>requiresReauth = true</code> e invoca <code>onUnauthorized</code>.</td><td><strong>PASS</strong></td></tr>
  <tr><td>RES-06</td><td>Recuperación de conexión</td><td>Restablecer comunicación</td><td>Falla los 2 primeros intentos y se recupera automáticamente en el intento 3 con esperas crecientes (<code>21 ms → 61 ms</code>).</td><td><strong>PASS</strong></td></tr>
  <tr><td>RES-07</td><td>Reintento de una escritura (fallo tras commit)</td><td>Evitar duplicados inesperados</td><td>En el intento 1 se pierde respuesta tras guardar en BD; el reintento envía la misma <code>Idempotency-Key</code> y backend retorna la cita ya creada (<code>dbRecordsCreated: 1</code>).</td><td><strong>PASS</strong></td></tr>
  <tr><td>RES-08</td><td>Respuesta tardía y doble toque</td><td>Evitar operaciones duplicadas o inconsistentes</td><td>Doble toque simultáneo despacha exactamente <code>1 POST</code> (guard <code>_isSubmitting</code>); lectura tardía vieja (<code>80 ms</code>) es descartada frente a lectura fresca (<code>10 ms</code>, ID final <code>777</code>).</td><td><strong>PASS</strong></td></tr>
</table>

<h3>Análisis técnico requerido (Fase 5)</h3>

<div class="qa-item">
  <div class="qa-q">1. ¿Cuánto tarda la aplicación en detectar una interrupción?</div>
  <p>En caídas inmediatas de socket (<code>SocketException</code>) el sistema operativo notifica el corte en menos de <code>1–5 ms</code>; en servidores que aceptan TCP pero no responden (<em>blackhole</em>), la implementación optimizada de <code>ApiService</code> limita la espera mediante <code>requestTimeout = 10 s</code> (verificado en pruebas con umbral de <code>50 ms</code>, abortando el intento completo en <code>110 ms</code> frente al comportamiento anterior sin timeout donde quedaba bloqueado indefinidamente).</p>
</div>

<div class="qa-item">
  <div class="qa-q">2. ¿Qué ocurre con una operación que queda pendiente?</div>
  <p>Las consultas de lectura conservan el bloque <code>finally</code> garantizando <code>_isLoading = false</code>, leen el respaldo en SQLite si existe y notifican a la vista sin congelar el indicador de carga. Las escrituras liberan tanto <code>_isLoading</code> como el candado <code>_isSubmitting</code> para permitir que el usuario vuelva a intentar de forma segura.</p>
</div>

<div class="qa-item">
  <div class="qa-q">3. ¿Se repite automáticamente la solicitud?</div>
  <p>Sí, de manera selectiva mediante espera progresiva (<em>exponential backoff</em>: <code>250 ms → 750 ms → 1,750 ms</code> en producción). Únicamente se reintentan errores transitorios (<code>SocketException</code>, <code>TimeoutException</code>, <code>429</code>, <code>502</code>, <code>503</code>, <code>504</code>) en lecturas idempotentes (<code>GET</code>/<code>DELETE</code>) o en escrituras protegidas con <code>Idempotency-Key</code>. Códigos deterministas como <code>400</code>, <code>401</code>, <code>403</code> o <code>409</code> nunca se reintentan automáticamente.</p>
</div>

<div class="qa-item">
  <div class="qa-q">4. ¿Puede generarse un registro duplicado?</div>
  <p>Antes de la optimización, sí: dos toques seguidos o un reintento manual tras corte de conexión podían disparar múltiples inserciones (o falsos errores <code>409</code>). Con el candado <code>_isSubmitting</code> en <code>ClientProvider</code>, la cabecera única <code>Idempotency-Key</code> por intención de reserva y la caché de deduplicación más coalescing en <code>AppointmentsController.create</code>, los reintentos producen exactamente un único registro.</p>
</div>

<div class="qa-item">
  <div class="qa-q">5. ¿Cómo se recupera el estado de la interfaz?</div>
  <p>Si la red falla durante una consulta, la UI presenta las citas almacenadas en SQLite sin perder información visible; cuando la comunicación retorna (o el usuario desliza para actualizar), <code>fetchMyAppointments</code> compara la firma del nuevo listado, actualiza los registros y limpia el estado de error. Adicionalmente, el contador monótono <code>_fetchSequence</code> descarta respuestas rezagadas para que nunca pisen datos más recientes.</p>
</div>

<div class="qa-item">
  <div class="qa-q">6. ¿Qué sucede si el servidor procesa la operación, pero la respuesta nunca llega al dispositivo?</div>
  <p>El cliente entra en timeout o <code>SocketException</code> y reintenta con exactamente la misma <code>Idempotency-Key</code>. En el backend, <code>AppointmentsController.create</code> localiza esa llave en su mapa TTL (<code>idempotencyCache</code>) o promesa en curso (<code>inFlightCreates</code>) y devuelve inmediatamente el objeto <code>Appointment</code> creado con código <code>201</code> sin volver a escribir en PostgreSQL, conciliando cliente y servidor.</p>
</div>

<div class="img-wrap">
  <img src="${imgDataUri('cap3_fase5_resilience.png')}" alt="Resiliencia RES-01 a RES-08" />
  <div class="cap-txt">Captura 3. Evidencia de los 8 escenarios de resiliencia (RES-01 a RES-08), exponential backoff e Idempotency-Key aprobados (8/8).</div>
</div>

<div class="page-break"></div>

<h2>Fase 6. Optimización implementada y comparación de código (Entregable 1)</h2>
<p>Se implementaron mejoras reales tanto en la aplicación móvil Flutter (<code>api_service.dart</code> y <code>client_provider.dart</code>) como en el backend NestJS (<code>appointments.controller.ts</code> y <code>appointments.service.ts</code>), manteniendo compatibilidad completa con los 19 casos white-box de Práctica 11.</p>

<h3>1. App Móvil — Cliente HTTP persistente, Timeout y Exponential Backoff (<code>api_service.dart</code>)</h3>
${renderCodeBlock('Código Original — dispositivos_inteligentes/phone_app/lib/services/api_service.dart', origApiSnippet, 'dart', 15)}
${renderCodeBlock('Versión Optimizada — dispositivos_inteligentes/phone_app/lib/services/api_service.dart', optApiSnippet, 'dart', 65)}

<h3>2. App Móvil — Diffing de estado, eliminación de GET redundante e Isolate parsing (<code>client_provider.dart</code>)</h3>
${renderCodeBlock('Código Original — dispositivos_inteligentes/phone_app/lib/providers/client_provider.dart (extracto crítico)', origClientSnippet, 'dart', 28)}
${renderCodeBlock('Versión Optimizada — dispositivos_inteligentes/phone_app/lib/providers/client_provider.dart (extracto createAppointment)', optClientSnippet, 'dart', 156)}

<h3>3. Backend NestJS — Idempotency-Key y Proyección Selectiva + Caché TTL (<code>appointments.*</code>)</h3>
${renderCodeBlock('Código Original vs Versión Optimizada — appointments.controller.ts y appointments.service.ts', `${origBackendSnippet}\n\n${optBackendSnippet}`, 'ts', 1)}

<div class="img-wrap">
  <img src="${imgDataUri('cap4_fase6_flutter_optimized.png')}" alt="Flutter Optimizado y Regresion" />
  <div class="cap-txt">Captura 4. Re-ejecución tras optimizar Flutter: analyzer sin errores y 21/21 pruebas aprobadas (2 P12 optimizado + 19 regresión P11).</div>
</div>

<div class="img-wrap">
  <img src="${imgDataUri('cap5_fase6_backend_before_after.png')}" alt="Backend Antes vs Despues" />
  <div class="cap-txt">Captura 5. Benchmark local del servidor NestJS (25 usuarios concurrentes, 200 reqs) antes y después de optimizar.</div>
</div>

<div class="page-break"></div>

<h2>Resultados de rendimiento (PER-01 a PER-11)</h2>
<table>
  <tr><th>Código</th><th>Categoría y métrica</th><th>Resultado medido real</th><th>Evidencia verificable</th></tr>
  <tr><td>PER-01</td><td>CPU de la aplicación (promedio y máximo / tiempo de proceso)</td><td>Backend libuv multi-hilo: <code>152.55% → 142.56%</code> (−9.99 pts; equiv. <code>9.53% → 8.91%</code> sobre 16 hilos). Flutter trabajo crítico 50 lecturas + 20 escrituras: <code>423.88 ms → 248.06 ms</code> (−41.5%).</td><td>Capturas 1, 4 y 5 (<code>backend_bench_before/after.json</code>)</td></tr>
  <tr><td>PER-02</td><td>Memoria (RAM inicial, máxima y final)</td><td>Flutter VM: inicio <code>132.66 MB</code>, máxima <code>156.89 MB</code>, final <code>149.04 MB</code> (baseline) vs <code>133.14 → 157.47 → 149.14 MB</code> (optimizado). Backend NestJS RSS: <code>189.36 MB → 178.45 MB</code> (−5.8%).</td><td>Capturas 1, 4 y 5 (<code>ProcessInfo</code> / <code>process.memoryUsage().rss</code>)</td></tr>
  <tr><td>PER-03</td><td>Tiempo de operación (ms por operación)</td><td>Flutter lectura repetida: <code>4.85 ms → 3.85 ms</code>; escritura crítica: <code>9.07 ms → 2.78 ms</code> (−69.3%). Carga pesada 1,500 citas: <code>5.50 ms → 4.59 ms</code> en Isolate.</td><td>Capturas 1 y 4 (<code>fase2_profiling_baseline</code> vs <code>fase2_6_optimized</code>)</td></tr>
  <tr><td>PER-04</td><td>Carga API (RPS y solicitudes exitosas)</td><td>Nube Render: pico <code>37.63 RPS</code> a 30 usuarios (<code>100%</code> exitosas), cae a <code>27.28 RPS</code> a 50 usuarios. Local NestJS (25 usuarios): <code>591.30 → 729.21 RPS</code> (+23.3%, 200/200 OK).</td><td>Capturas 2 y 5 (<code>cloud_stress_results.json</code>)</td></tr>
  <tr><td>PER-05</td><td>Latencia API (Promedio, P90 y P95)</td><td>Render lectura (30 usuarios): prom <code>392.70 ms</code>, P90 <code>607.35 ms</code>, P95 <code>1,549.09 ms</code>; (50 usuarios): prom <code>799.57 ms</code>, P95 <code>1,657.86 ms</code>. Local NestJS: prom <code>39.99 → 32.63 ms</code>, P95 <code>88.96 → 88.81 ms</code>.</td><td>Capturas 2 y 5</td></tr>
  <tr><td>PER-06</td><td>Errores HTTP (Cantidad y porcentaje)</td><td>En pruebas de estrés HTTP web/API: <code>0</code> errores en oleadas de carga (<code>0.00%</code>); en prueba de concurrencia DB sobre mismo ID hubo 1 rechazo <code>400</code> por validación DTO; en retry idempotente backend antes fallaba <code>409 (50%)</code> → después <code>201 (0% error)</code>.</td><td>Capturas 2 y 5</td></tr>
  <tr><td>PER-07</td><td>Consultas DB (Tiempo y cantidad de registros)</td><td>Neon vía API: por ID <code>360.10 ms</code> (1 reg.), por fecha <code>214.20 ms</code> (10 reg.), paginada <code>371.09 ms</code> (50 reg.), filtrada <code>425.88 ms</code> (10 reg.). Optimización local redujo llamadas DB de <code>200 → 25</code> (−87.5%) y payload de <code>27,112 B → 11,027 B</code> (−59.3%).</td><td>Capturas 2 y 5 (<code>cloud_stress_results.json</code>)</td></tr>
  <tr><td>PER-08</td><td>Concurrencia DB (Conflictos y consistencia)</td><td>5 updates paralelos en filas distintas: <code>1,227.15 ms</code>, integridad 100%. Carrera de 5 <code>POST</code> en mismo horario en Render vivo reveló <code>5x 201</code> sin prevención en despliegue antiguo; reintento idempotente optimizado local mantuvo exactamente <code>1</code> inserción.</td><td>Capturas 2 y 5</td></tr>
  <tr><td>PER-09</td><td>Pérdida de conexión (Detección y manejo)</td><td>Detección inmediata <code>SocketException</code> o corte controlado por timeout (<code>110 ms</code> con umbral <code>50 ms</code> en test / <code>10 s</code> en prod); fallback automático a SQLite en lecturas y rechazo seguro <code>false</code> en escrituras.</td><td>Captura 3 (<code>RES-01</code>, <code>RES-02</code>, <code>RES-03</code>)</td></tr>
  <tr><td>PER-10</td><td>Recuperación (Tiempo y consistencia posterior)</td><td>Recuperación exitosa en 3er intento mediante exponential backoff (<code>21 ms → 61 ms</code>); 0 registros duplicados con <code>Idempotency-Key</code> y descarte de respuestas tardías obsoletas.</td><td>Captura 3 (<code>RES-06</code>, <code>RES-07</code>, <code>RES-08</code>)</td></tr>
  <tr><td>PER-11</td><td>Optimización (Comparación antes y después)</td><td>Mejoras verificadas en ambas capas: Flutter −69.3% en tiempo de escritura crítica y −98% en escrituras SQLite/rebuilds en polling; Backend +23.3% RPS y −59.3% tamaño de payload JSON.</td><td>Capturas 1, 4 y 5 + Tabla Comparativa</td></tr>
</table>

<h2>Tabla comparativa antes y después (Obligatoria)</h2>
<table>
  <tr><th>Métrica</th><th>Antes (Baseline)</th><th>Después (Optimizado)</th><th>Diferencia / Mejora</th></tr>
  <tr><td>Latencia promedio API (ms) — <em>NestJS 25u / Flutter create</em></td><td><code>39.99 ms</code> (API) / <code>9.07 ms</code> (App)</td><td><code>32.63 ms</code> (API) / <code>2.78 ms</code> (App)</td><td><strong>−18.4%</strong> (API) / <strong>−69.3%</strong> (App)</td></tr>
  <tr><td>P95 API (ms) — <em>NestJS 25 concurrentes</em></td><td><code>88.96 ms</code></td><td><code>88.81 ms</code></td><td><strong>−0.17%</strong> (estable bajo caché)</td></tr>
  <tr><td>RPS — <em>NestJS lectura concurrente</em></td><td><code>591.30 req/s</code></td><td><code>729.21 req/s</code></td><td><strong>+137.91 req/s (+23.3%)</strong></td></tr>
  <tr><td>Errores (%) — <em>Reintento escritura tras corte (RES-07)</em></td><td><code>50.0%</code> (1x 201 + 1x 409 falso)</td><td><code>0.0%</code> (2x 201 idempotentes, 1 insert)</td><td><strong>−50.0 pts porcentuales</strong></td></tr>
  <tr><td>Tiempo / Carga de consulta DB — <em>Consultas y Payload</em></td><td><code>200</code> hits DB / <code>27,112 B</code> JSON (<code>50</code> saves SQLite)</td><td><code>25</code> hits DB / <code>11,027 B</code> JSON (<code>1</code> save SQLite)</td><td><strong>−87.5% hits DB</strong> / <strong>−59.3% payload</strong> / <strong>−98% I/O SQLite</strong></td></tr>
  <tr><td>RAM máxima (MB) — <em>Backend RSS / Flutter VM MaxRSS</em></td><td><code>189.36 MB</code> (Backend) / <code>156.89 MB</code> (App)</td><td><code>178.45 MB</code> (Backend) / <code>157.47 MB</code> (App)</td><td><strong>−10.91 MB (−5.8%)</strong> en Backend / estable en App (+0.58 MB por Isolate)</td></tr>
  <tr><td>CPU promedio (%) — <em>Backend uso agregado / carga App</em></td><td><code>152.55%</code> (equiv. <code>9.53%</code>/core en 16 hilos)</td><td><code>142.56%</code> (equiv. <code>8.91%</code>/core en 16 hilos)</td><td><strong>−9.99 pts</strong> agregados (<strong>−6.5%</strong> relativo)</td></tr>
  <tr><td>Tiempo de operación crítica (ms) — <em>50 lecturas + 20 escrituras + Nav pico</em></td><td><code>423.88 ms</code> ops / <code>464.63 ms</code> frame max / <code>90</code> HTTP</td><td><code>248.06 ms</code> ops / <code>69.27 ms</code> frame max / <code>70</code> HTTP</td><td><strong>−41.5%</strong> tiempo ops / <strong>−85.1%</strong> pico frame / <strong>−22.2%</strong> HTTP</td></tr>
</table>

<div class="page-break"></div>

<h2>Conclusión técnica final</h2>

<p><strong>Principal problema resuelto:</strong> La auditoría y ejecución de pruebas de estrés y resiliencia evidenciaron dos vulnerabilidades acopladas entre la aplicación móvil Flutter y la API REST NestJS: en primer lugar, un desperdicio sistemático de ancho de banda, ciclos de CPU y operaciones de disco causado por la ausencia de reutilización de conexiones HTTP, la duplicación de peticiones <code>GET</code> tras cada <code>POST</code> exitoso y la reescritura incondicional de SQLite junto con reconstrucciones completas de la interfaz durante sondeos sin cambios. En segundo lugar, una fragilidad crítica ante interrupciones reales de red (<em>timeouts</em> ilimitados y reintentos sin llave de idempotencia) que exponía al cliente a bloqueos visuales o errores falsos cuando una reserva ya había sido confirmada en PostgreSQL. Con las optimizaciones implementadas en esta práctica —un cliente HTTP persistente Keep-Alive con timeout estricto, <em>exponential backoff</em>, guardado optimista en <code>ClientProvider</code>, comparación de firma de estado, aislamiento del parsing pesado en <code>compute</code>, proyección selectiva de columnas más caché TTL de 5 segundos en <code>AppointmentsService</code> y deduplicación por <code>Idempotency-Key</code> en <code>AppointmentsController</code>— se redujo el tiempo total de las operaciones críticas en un <strong>41.5%</strong> (y <strong>69.3%</strong> en escrituras de citas), se recortaron en un <strong>98%</strong> las escrituras SQLite y notificaciones UI redundantes, aumentó el rendimiento de lectura del backend en un <strong>23.3%</strong> (de <code>591.30</code> a <code>729.21 RPS</code>) y se disminuyó el payload JSON por consulta en un <strong>59.3%</strong>, logrando aprobación del 100% en los ocho escenarios de resiliencia (<code>RES-01</code> a <code>RES-08</code>).</p>

<p><strong>Limitaciones encontradas:</strong> Durante las mediciones se identificaron tres restricciones reales de infraestructura y arquitectura. Primera, la red local bloquea o filtra el protocolo TCP directo hacia el puerto 5432 de Neon Serverless PostgreSQL (<em>SSLRequest timeout</em>), por lo que las pruebas de estrés y consultas SQL de producción tuvieron que canalizarse a través de la API HTTPS en Render y complementarse con un servidor NestJS HTTP instrumentado en entorno local para comparar exactamente el código antes y después sin alterar el despliegue activo hasta contar con autorización de publicación. Segunda, la instancia pública actualmente desplegada en Render mostró un punto de saturación claro entre 30 y 50 usuarios concurrentes (caída de <code>37.63</code> a <code>27.28 RPS</code> y salto de latencia media a <code>799.57 ms</code>) propio de un contenedor de nivel gratuito, así como una condición de carrera real cuando cinco solicitudes simultáneas intentaron reservar exactamente el mismo horario (<code>5x 201 Created</code>) por no encontrarse aplicada aún la restricción única parcial en dicha base remota. Tercera, el endpoint de autenticación <code>POST /api/auth/login</code> conserva una latencia base cercana a 1.7 segundos debido al factor de costo computacional intencional de <code>bcryptjs</code>.</p>

<p><strong>Recomendaciones de mejora continua:</strong></p>
<ul>
  <li><strong>Despliegue inmediato de migraciones e índices en producción:</strong> Verificar y ejecutar <code>create_appointments_table.sql</code> directamente desde el entorno de Render contra Neon para garantizar la vigencia del índice único parcial <code>idx_appointments_slot_unique</code> e impedir reservas duplicadas bajo concurrencia alta.</li>
  <li><strong>Idempotencia persistente en Redis / PostgreSQL:</strong> Evolucionar el almacenamiento en memoria de <code>Idempotency-Key</code> y del caché TTL de fechas hacia Redis cuando la aplicación escale a múltiples réplicas o nodos detrás de un balanceador de carga.</li>
  <li><strong>Paginación incremental y compresión HTTP:</strong> Habilitar compresión <code>gzip</code>/<code>brotli</code> en Express para respuestas de listado administrativo y adoptar paginación por cursor (<em>keyset pagination</em>) en lugar de <code>OFFSET</code> + <code>COUNT(*)</code> conforme el histórico supere decenas de miles de citas.</li>
  <li><strong>Observabilidad continua en producción:</strong> Integrar métricas de percentiles (P95/P99), tasa de acierto de caché y alertas ante códigos <code>429</code>/<code>5xx</code> para detectar regresiones de latencia antes de que afecten al usuario móvil.</li>
</ul>

</body>
</html>`;

const tmpHtml = path.join(P12_DIR, 'report_p12.html');
fs.writeFileSync(tmpHtml, html, 'utf8');

execFileSync(
  CHROME_PATH,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${PDF_OUT}`,
    `file:///${tmpHtml.replace(/\\/g, '/')}`,
  ],
  { stdio: 'ignore' },
);
fs.unlinkSync(tmpHtml);

// Exportar todos los 9 entregables en EntregablesPractica12/
fs.copyFileSync(PDF_OUT, path.join(DELIVERABLES_DIR, 'PRACTICA_12_REPORTE.pdf'));

const dirs = ['1_codigo_original_vs_optimizado', '2_capturas_profiler_estres_resiliencia', '3_scripts_pruebas_y_resultados'];
for (const d of dirs) fs.mkdirSync(path.join(DELIVERABLES_DIR, d), { recursive: true });

// 1. Código original vs optimizado
fs.copyFileSync(path.join(BASE_DIR, 'api_service.original.dart'), path.join(DELIVERABLES_DIR, '1_codigo_original_vs_optimizado', 'api_service.original.dart'));
fs.copyFileSync(path.resolve(ROOT, 'dispositivos_inteligentes/phone_app/lib/services/api_service.dart'), path.join(DELIVERABLES_DIR, '1_codigo_original_vs_optimizado', 'api_service.optimizado.dart'));
fs.copyFileSync(path.join(BASE_DIR, 'client_provider.original.dart'), path.join(DELIVERABLES_DIR, '1_codigo_original_vs_optimizado', 'client_provider.original.dart'));
fs.copyFileSync(path.resolve(ROOT, 'dispositivos_inteligentes/phone_app/lib/providers/client_provider.dart'), path.join(DELIVERABLES_DIR, '1_codigo_original_vs_optimizado', 'client_provider.optimizado.dart'));
fs.copyFileSync(path.join(BASE_DIR, 'appointments.controller.original.ts'), path.join(DELIVERABLES_DIR, '1_codigo_original_vs_optimizado', 'appointments.controller.original.ts'));
fs.copyFileSync(path.resolve(ROOT, 'backend/src/appointments/appointments.controller.ts'), path.join(DELIVERABLES_DIR, '1_codigo_original_vs_optimizado', 'appointments.controller.optimizado.ts'));
fs.copyFileSync(path.join(BASE_DIR, 'appointments.service.original.ts'), path.join(DELIVERABLES_DIR, '1_codigo_original_vs_optimizado', 'appointments.service.original.ts'));
fs.copyFileSync(path.resolve(ROOT, 'backend/src/appointments/appointments.service.ts'), path.join(DELIVERABLES_DIR, '1_codigo_original_vs_optimizado', 'appointments.service.optimizado.ts'));

// 2. Capturas reales
for (const png of fs.readdirSync(CAP_DIR).filter((f) => f.endsWith('.png'))) {
  fs.copyFileSync(path.join(CAP_DIR, png), path.join(DELIVERABLES_DIR, '2_capturas_profiler_estres_resiliencia', png));
}

// 3. Scripts y resultados JSON
for (const f of ['run_cloud_stress_and_db.mjs', 'backend_local_bench.spec.ts', 'cloud_stress_results.json', 'backend_bench_before.json', 'backend_bench_after.json']) {
  fs.copyFileSync(path.join(P12_DIR, f), path.join(DELIVERABLES_DIR, '3_scripts_pruebas_y_resultados', f));
}
for (const f of ['fase2_profiling_baseline_test.dart', 'fase2_6_optimized_test.dart', 'fase5_resilience_test.dart']) {
  fs.copyFileSync(path.resolve(ROOT, 'dispositivos_inteligentes/phone_app/test/practica12', f), path.join(DELIVERABLES_DIR, '3_scripts_pruebas_y_resultados', f));
}

console.log('PDF generado en:', PDF_OUT);
console.log('Entregables exportados en:', DELIVERABLES_DIR);
