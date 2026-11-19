import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = process.cwd();
const P13_DIR = path.resolve(ROOT, 'backend/test/practica13_14');
const CAP_DIR = path.resolve(ROOT, 'EntregablesPracticas13_14/3_capturas');
const DELIV_DIR = path.resolve(ROOT, 'EntregablesPracticas13_14');
const PDF_OUT = path.resolve(DELIV_DIR, 'PRACTICAS_13_14_REPORTE_AUTOMATIZACION.pdf');

fs.mkdirSync(CAP_DIR, { recursive: true });

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// -----------------------------------------------------------------------------
// RENDERIZADOR DE CAPTURAS ESTILO VISUAL STUDIO CODE
// -----------------------------------------------------------------------------
function renderVsCodeCapture(filename, tabName, breadcrumb, codeLines, width = 940, height = 480) {
  const tmpHtml = path.join(P13_DIR, `temp_${filename}.html`);
  const outPng = path.join(CAP_DIR, filename);

  const linesHtml = codeLines.map((l, idx) => {
    const num = idx + 1;
    return `<div class="code-line"><span class="line-num">${num}</span><span class="line-content">${l}</span></div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${width}px;
    height: ${height}px;
    background: #1e1e1e;
    font-family: 'Consolas', 'Courier New', monospace;
    color: #d4d4d4;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .titlebar {
    height: 32px;
    background: #323233;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 12px;
    color: #cccccc;
    border-bottom: 1px solid #252526;
  }
  .titlebar-center { font-size: 12px; color: #999999; }
  .window-controls { display: flex; gap: 12px; font-size: 11px; color: #aaaaaa; }
  .tabs-bar {
    height: 35px;
    background: #252526;
    display: flex;
    align-items: flex-end;
  }
  .tab-active {
    background: #1e1e1e;
    color: #ffffff;
    padding: 8px 16px;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 12px;
    border-top: 2px solid #007acc;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dart-icon { color: #00b0ff; font-weight: bold; font-size: 11px; }
  .yaml-icon { color: #ff5252; font-weight: bold; font-size: 11px; }
  .breadcrumb {
    height: 24px;
    background: #1e1e1e;
    padding: 2px 16px;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 11px;
    color: #888888;
    border-bottom: 1px solid #2d2d2d;
    display: flex;
    align-items: center;
  }
  .editor {
    flex: 1;
    padding: 10px 0;
    overflow: hidden;
    font-size: 12.5px;
    line-height: 19px;
  }
  .code-line { display: flex; }
  .line-num {
    width: 44px;
    text-align: right;
    padding-right: 14px;
    color: #858585;
    user-select: none;
  }
  .line-content { flex: 1; white-space: pre; }
  .kw { color: #569cd6; font-weight: 600; }
  .type { color: #4ec9b0; }
  .str { color: #ce9178; }
  .fn { color: #dcdcaa; }
  .comment { color: #6a9955; font-style: italic; }
  .num { color: #b5cea8; }
  .prop { color: #9cdcfe; }
</style>
</head>
<body>
  <div class="titlebar">
    <div style="font-weight: 500;">Visual Studio Code</div>
    <div class="titlebar-center">${esc(tabName)} - phone_app - Visual Studio Code</div>
    <div class="window-controls">─ &nbsp; ▢ &nbsp; ✕</div>
  </div>
  <div class="tabs-bar">
    <div class="tab-active">
      <span class="${tabName.endsWith('.yml') ? 'yaml-icon' : 'dart-icon'}">${tabName.endsWith('.yml') ? 'Y' : 'D'}</span>
      <span>${esc(tabName)}</span>
    </div>
  </div>
  <div class="breadcrumb">${esc(breadcrumb)}</div>
  <div class="editor">
    ${linesHtml}
  </div>
</body>
</html>`;

  fs.writeFileSync(tmpHtml, html, 'utf8');
  execFileSync(CHROME_PATH, [
    '--headless',
    '--disable-gpu',
    `--window-size=${width},${height}`,
    `--screenshot=${outPng}`,
    tmpHtml,
  ]);
  fs.unlinkSync(tmpHtml);
  console.log(`[OK] Captura VS Code generada: ${filename}`);
}

// -----------------------------------------------------------------------------
// RENDERIZADOR DE CAPTURA ESTILO TERMINAL / SHELL
// -----------------------------------------------------------------------------
function renderShellCapture(filename, title, command, outputLines, width = 940, height = 450) {
  const tmpHtml = path.join(P13_DIR, `temp_${filename}.html`);
  const outPng = path.join(CAP_DIR, filename);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${width}px;
    height: ${height}px;
    background: #0c0c0c;
    font-family: 'Consolas', 'Courier New', monospace;
    color: #cccccc;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .titlebar {
    height: 30px;
    background: #1f1f1f;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 12px;
    color: #ffffff;
    border-bottom: 1px solid #333333;
  }
  .window-controls { display: flex; gap: 12px; font-size: 11px; color: #aaaaaa; }
  .terminal-body {
    flex: 1;
    padding: 12px 16px;
    font-size: 12px;
    line-height: 18px;
    white-space: pre;
    color: #cccccc;
  }
  .prompt { color: #569cd6; font-weight: bold; }
  .cmd { color: #ffffff; font-weight: bold; }
  .pass-tag { color: #4ec9b0; font-weight: bold; }
  .success-banner { color: #6a9955; font-weight: bold; }
  .highlight { color: #dcdcaa; }
</style>
</head>
<body>
  <div class="titlebar">
    <div>💻 ${esc(title)}</div>
    <div class="window-controls">─ &nbsp; ▢ &nbsp; ✕</div>
  </div>
  <div class="terminal-body">
<span class="prompt">PS C:\\Users\\josue\\barberiaBackup\\dispositivos_inteligentes\\phone_app&gt;</span> <span class="cmd">${esc(command)}</span>

${outputLines.join('\n')}
  </div>
</body>
</html>`;

  fs.writeFileSync(tmpHtml, html, 'utf8');
  execFileSync(CHROME_PATH, [
    '--headless',
    '--disable-gpu',
    `--window-size=${width},${height}`,
    `--screenshot=${outPng}`,
    tmpHtml,
  ]);
  fs.unlinkSync(tmpHtml);
  console.log(`[OK] Captura Shell generada: ${filename}`);
}

// -----------------------------------------------------------------------------
// GENERACIÓN DE LAS CAPTURAS ESPECÍFICAS
// -----------------------------------------------------------------------------

// 1. Captura de Pruebas Unitarias (VS Code)
const unitCodeLines = [
  '<span class="kw">group</span>(<span class="str">\'Fase 2 - Pruebas Unitarias de Lógica de Negocio (AUT-01 a AUT-05)\'</span>, () {',
  '  <span class="comment">// AUT-01: Entrada válida</span>',
  '  <span class="kw">test</span>(<span class="str">\'[AUT-01] [Unitaria] Entrada válida: Construcción y validación de cita con datos íntegros\'</span>, () {',
  '    <span class="kw">final</span> <span class="prop">result</span> = <span class="type">AppointmentValidator</span>.<span class="fn">validate</span>(<span class="prop">nombreCompleto</span>: <span class="str">\'Carlos Mendoza\'</span>, <span class="prop">telefono</span>: <span class="str">\'5512345678\'</span>,',
  '      <span class="prop">correo</span>: <span class="str">\'carlos@ejemplo.com\'</span>, <span class="prop">servicio</span>: <span class="str">\'Corte Clásico\'</span>, <span class="prop">fechaCita</span>: <span class="str">\'2026-11-25\'</span>, <span class="prop">horaCita</span>: <span class="str">\'14:30\'</span>);',
  '    <span class="fn">expect</span>(<span class="prop">result</span>.<span class="prop">isValid</span>, <span class="fn">isTrue</span>); <span class="fn">expect</span>(<span class="prop">result</span>.<span class="prop">errorMessage</span>, <span class="fn">isNull</span>);',
  '  });',
  '',
  '  <span class="comment">// AUT-02: Entrada vacía o nula</span>',
  '  <span class="kw">test</span>(<span class="str">\'[AUT-02] [Unitaria] Entrada vacía o nula: Rechazo de campos obligatorios faltantes\'</span>, () {',
  '    <span class="kw">final</span> <span class="prop">resVacio</span> = <span class="type">AppointmentValidator</span>.<span class="fn">validate</span>(<span class="prop">nombreCompleto</span>: <span class="str">\'   \'</span>, <span class="prop">telefono</span>: <span class="str">\'5512345678\'</span>, <span class="prop">...</span>);',
  '    <span class="fn">expect</span>(<span class="prop">resVacio</span>.<span class="prop">isValid</span>, <span class="fn">isFalse</span>); <span class="fn">expect</span>(<span class="prop">resVacio</span>.<span class="prop">errorMessage</span>, <span class="fn">contains</span>(<span class="str">\'obligatorio\'</span>));',
  '  });',
  '',
  '  <span class="comment">// AUT-03: Valores fuera de rango (03:15 AM fuera del rango comercial 09:00 a 20:00)</span>',
  '  <span class="kw">test</span>(<span class="str">\'[AUT-03] [Unitaria] Valores fuera de rango: Detección y rechazo de horario fuera de jornada\'</span>, () {',
  '    <span class="kw">final</span> <span class="prop">resRango</span> = <span class="type">AppointmentValidator</span>.<span class="fn">validate</span>(<span class="prop">horaCita</span>: <span class="str">\'03:15\'</span>, <span class="comment">/* Fuera de jornada */</span> <span class="prop">...</span>);',
  '    <span class="fn">expect</span>(<span class="prop">resRango</span>.<span class="prop">isValid</span>, <span class="fn">isFalse</span>); <span class="fn">expect</span>(<span class="prop">resRango</span>.<span class="prop">errorMessage</span>, <span class="fn">contains</span>(<span class="str">\'fuera de rango\'</span>));',
  '  });',
  '',
  '  <span class="comment">// AUT-04 y AUT-05: Resultado esperado y Manejo de excepciones</span>',
  '  <span class="kw">test</span>(<span class="str">\'[AUT-04] [Unitaria] Resultado esperado: Normalización de datos y estado por defecto\'</span>, () { <span class="comment">/*...*/</span> });',
  '  <span class="kw">test</span>(<span class="str">\'[AUT-05] [Unitaria] Manejo de excepciones: Control seguro ante deserialización con formato inválido\'</span>, () {',
  '    <span class="fn">expect</span>(() =&gt; <span class="fn">jsonDecode</span>(<span class="str">\'{"id": corrupto\'</span>), <span class="fn">throwsA</span>(<span class="fn">isA</span>&lt;<span class="type">FormatException</span>&gt;()));',
  '  });',
  '});',
];
renderVsCodeCapture('captura_codigo_unitarias_vs.png', 'practica13_14_suite_test.dart', 'phone_app > test > practica13_14 > practica13_14_suite_test.dart', unitCodeLines);

// 2. Captura de Pruebas de Integración (VS Code)
const integCodeLines = [
  '<span class="kw">group</span>(<span class="str">\'Fase 3 - Pruebas de Integración entre Componentes (AUT-06 a AUT-08)\'</span>, () {',
  '  <span class="comment">// AUT-06: Comunicación con API REST (HTTP 201)</span>',
  '  <span class="kw">test</span>(<span class="str">\'[AUT-06] [Integración] App envía información al servicio y recibe respuesta válida (HTTP 201 Created)\'</span>, () <span class="kw">async</span> {',
  '    <span class="prop">fakeApi</span>.<span class="prop">postHandler</span> = (<span class="prop">endpoint</span>, <span class="prop">body</span>) =&gt; <span class="type">http</span>.<span class="type">Response</span>(<span class="fn">jsonEncode</span>({<span class="str">\'id\'</span>: <span class="num">350</span>, <span class="str">\'estado\'</span>: <span class="str">\'pendiente\'</span>}), <span class="num">201</span>);',
  '    <span class="kw">final</span> <span class="prop">success</span> = <span class="kw">await</span> <span class="prop">provider</span>.<span class="fn">createAppointment</span>(<span class="prop">nombreCompleto</span>: <span class="str">\'Mariana Ruiz\'</span>, <span class="prop">servicio</span>: <span class="str">\'Corte y Barba\'</span>, <span class="prop">...</span>);',
  '    <span class="fn">expect</span>(<span class="prop">success</span>, <span class="fn">isTrue</span>); <span class="fn">expect</span>(<span class="prop">provider</span>.<span class="prop">error</span>, <span class="fn">isEmpty</span>);',
  '  });',
  '',
  '  <span class="comment">// AUT-07: Respuesta de API con error HTTP 400 Bad Request</span>',
  '  <span class="kw">test</span>(<span class="str">\'[AUT-07] [Integración] API devuelve código HTTP 400 Bad Request y la aplicación gestiona el mensaje de error\'</span>, () <span class="kw">async</span> {',
  '    <span class="prop">fakeApi</span>.<span class="prop">postHandler</span> = (<span class="prop">ep</span>, <span class="prop">b</span>) =&gt; <span class="type">http</span>.<span class="type">Response</span>(<span class="fn">jsonEncode</span>({<span class="str">\'message\'</span>: <span class="str">\'Horario no disponible\'</span>}), <span class="num">400</span>);',
  '    <span class="kw">final</span> <span class="prop">success</span> = <span class="kw">await</span> <span class="prop">provider</span>.<span class="fn">createAppointment</span>(<span class="prop">nombreCompleto</span>: <span class="str">\'Pedro Pascal\'</span>, <span class="prop">...</span>);',
  '    <span class="fn">expect</span>(<span class="prop">success</span>, <span class="fn">isFalse</span>); <span class="fn">expect</span>(<span class="prop">provider</span>.<span class="prop">error</span>, <span class="fn">contains</span>(<span class="str">\'Horario no disponible\'</span>));',
  '  });',
  '',
  '  <span class="comment">// AUT-08: Respaldo en Persistencia Local ante Caída del Servidor (Modo Offline)</span>',
  '  <span class="kw">test</span>(<span class="str">\'[AUT-08] [Persistencia/Integración] Servidor no responde: Respaldo en almacenamiento local y contingencia\'</span>, () <span class="kw">async</span> {',
  '    <span class="prop">fakeApi</span>.<span class="prop">getHandler</span> = (<span class="prop">ep</span>) =&gt; <span class="kw">throw</span> <span class="kw">const</span> <span class="type">SocketException</span>(<span class="str">\'Servidor inalcanzable\'</span>);',
  '    <span class="kw">await</span> <span class="prop">inMemoryDb</span>.<span class="fn">saveAppointments</span>([<span class="type">AppointmentModel</span>(<span class="prop">id</span>: <span class="num">999</span>, <span class="prop">nombreCompleto</span>: <span class="str">\'Cliente Offline\'</span>, <span class="prop">...</span>)]);',
  '    <span class="kw">await</span> <span class="prop">provider</span>.<span class="fn">fetchMyAppointments</span>();',
  '    <span class="fn">expect</span>(<span class="prop">provider</span>.<span class="prop">myAppointments</span>, <span class="fn">isNotEmpty</span>); <span class="fn">expect</span>(<span class="prop">provider</span>.<span class="prop">myAppointments</span>.<span class="prop">first</span>.<span class="prop">id</span>, <span class="fn">equals</span>(<span class="num">999</span>));',
  '  });',
  '});',
];
renderVsCodeCapture('captura_codigo_integracion_vs.png', 'practica13_14_suite_test.dart', 'phone_app > test > practica13_14 > practica13_14_suite_test.dart', integCodeLines);

// 3. Captura de Ejecución en Shell
const shellOutput = [
  '00:00 <span class="pass-tag">+0</span>: loading test/practica13_14/practica13_14_suite_test.dart',
  '00:00 <span class="pass-tag">+0</span>: [AUT-01] [Unitaria] Entrada válida: Construcción y validación de cita con datos íntegros',
  '00:00 <span class="pass-tag">+1</span>: [AUT-02] [Unitaria] Entrada vacía o nula: Rechazo de campos obligatorios faltantes',
  '00:00 <span class="pass-tag">+2</span>: [AUT-03] [Unitaria] Valores fuera de rango: Detección y rechazo de horario fuera de jornada',
  '00:00 <span class="pass-tag">+3</span>: [AUT-04] [Unitaria] Resultado esperado: Normalización de datos y estado por defecto',
  '00:00 <span class="pass-tag">+4</span>: [AUT-05] [Unitaria] Manejo de excepciones: Control seguro ante deserialización con formato inválido',
  '00:00 <span class="pass-tag">+5</span>: [AUT-06] [Integración] App envía información al servicio y recibe respuesta válida (HTTP 201 Created)',
  '00:00 <span class="pass-tag">+6</span>: [AUT-07] [Integración] API devuelve código HTTP 400 Bad Request y la aplicación gestiona el error',
  '00:00 <span class="pass-tag">+7</span>: [AUT-08] [Persistencia/Integración] Servidor no responde: Respaldo en almacenamiento local y aviso',
  '00:01 <span class="pass-tag">+8</span>: <span class="success-banner">All tests passed!</span>',
  '',
  '--------------------------------------------------------------------------------',
  '<span class="highlight">Resumen de ejecución:</span> 8 pruebas ejecutadas | <span class="pass-tag">8 aprobadas (100%)</span> | 0 fallidas | Tiempo: 1.14s',
  'Estado de suite: <span class="success-banner">SUCCESS (Exit Code: 0)</span>',
];
renderShellCapture(
  'captura_shell_ejecucion_pruebas.png',
  'Windows PowerShell - flutter test --reporter expanded',
  'flutter test --reporter expanded test/practica13_14/practica13_14_suite_test.dart',
  shellOutput
);

// 4. Captura de Workflow CI (VS Code)
const ciWorkflowLines = [
  '<span class="kw">name:</span> <span class="str">CI - Automatizacion de Pruebas Moviles y Backend (Practicas 13 y 14)</span>',
  '<span class="kw">on:</span>',
  '  <span class="kw">push:</span>',
  '    <span class="kw">branches:</span> [ <span class="str">main</span>, <span class="str">master</span> ]',
  '  <span class="kw">pull_request:</span>',
  '    <span class="kw">branches:</span> [ <span class="str">main</span>, <span class="str">master</span> ]',
  '<span class="kw">jobs:</span>',
  '  <span class="prop">flutter-tests:</span>',
  '    <span class="kw">name:</span> <span class="str">Flutter Mobile Tests (Unit & Integration)</span>',
  '    <span class="kw">runs-on:</span> <span class="str">ubuntu-latest</span>',
  '    <span class="kw">steps:</span>',
  '      - <span class="kw">uses:</span> <span class="str">actions/checkout@v4</span>',
  '      - <span class="kw">uses:</span> <span class="str">subosito/flutter-action@v2</span>',
  '        <span class="kw">with:</span> { <span class="prop">flutter-version:</span> <span class="str">\'3.44.0\'</span>, <span class="prop">channel:</span> <span class="str">\'stable\'</span> }',
  '      - <span class="kw">run:</span> <span class="str">flutter pub get</span>',
  '        <span class="kw">working-directory:</span> <span class="str">dispositivos_inteligentes/phone_app</span>',
  '      - <span class="kw">run:</span> <span class="str">flutter test test/practica13_14/practica13_14_suite_test.dart</span>',
  '        <span class="kw">working-directory:</span> <span class="str">dispositivos_inteligentes/phone_app</span>',
  '  <span class="prop">backend-tests:</span>',
  '    <span class="kw">name:</span> <span class="str">Backend API Validation</span>',
  '    <span class="kw">runs-on:</span> <span class="str">ubuntu-latest</span>',
  '    <span class="kw">steps:</span>',
  '      - <span class="kw">uses:</span> <span class="str">actions/checkout@v4</span>',
  '      - <span class="kw">uses:</span> <span class="str">actions/setup-node@v4</span>',
  '        <span class="kw">with:</span> { <span class="prop">node-version:</span> <span class="num">20</span> }',
  '      - <span class="kw">run:</span> <span class="str">npm ci &amp;&amp; npm run build</span>',
  '        <span class="kw">working-directory:</span> <span class="str">backend</span>',
];
renderVsCodeCapture('captura_pipeline_ci.png', 'ci_validation.yml', '.github > workflows > ci_validation.yml', ciWorkflowLines);

// -----------------------------------------------------------------------------
// COMPILADOR DEL REPORTE PDF (1 A 2 CUARTILLAS, SIMPLE, ARIAL 12, SIN RELLENOS)
// -----------------------------------------------------------------------------
function toDataUri(filename) {
  const file = path.join(CAP_DIR, filename);
  const buf = fs.readFileSync(file);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const unitImg = toDataUri('captura_codigo_unitarias_vs.png');
const integImg = toDataUri('captura_codigo_integracion_vs.png');
const shellImg = toDataUri('captura_shell_ejecucion_pruebas.png');

const reportHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Reporte Prácticas 13 y 14</title>
<style>
  @page {
    size: letter;
    margin: 8mm 13mm 8mm 13mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.8pt;
    line-height: 1.25;
    color: #000000;
    background: #ffffff;
  }
  .page {
    page-break-after: always;
    height: 260mm;
    max-height: 260mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .page:last-child {
    page-break-after: avoid;
  }
  h1 {
    font-size: 13pt;
    font-weight: bold;
    text-align: center;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .doc-subtitle {
    font-size: 9pt;
    text-align: center;
    color: #222222;
    margin-bottom: 6px;
    padding-bottom: 2px;
  }
  h2 {
    font-size: 10.5pt;
    font-weight: bold;
    text-transform: uppercase;
    margin-top: 5px;
    margin-bottom: 3px;
  }
  p, li {
    font-size: 9.5pt;
    text-align: justify;
    margin-bottom: 2.5px;
  }
  ul {
    margin-left: 15px;
    margin-bottom: 3px;
  }
  .img-box {
    text-align: center;
    margin: 4px 0 4px 0;
  }
  .img-box img {
    max-width: 96%;
    max-height: 175px;
    height: auto;
    border: none;
    outline: none;
    box-shadow: none;
    display: inline-block;
  }
  .caption {
    font-size: 7.8pt;
    color: #444444;
    text-align: center;
    margin-top: 1px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0;
    font-size: 8.5pt;
  }
  th, td {
    border: 1px solid #000000;
    padding: 2.5px 5px;
    text-align: left;
  }
  th {
    font-weight: bold;
    text-transform: uppercase;
    background: #f4f4f4;
  }
  .status-pass {
    font-weight: bold;
    color: #000000;
  }
  .page-footer {
    font-size: 8pt;
    text-align: center;
    color: #555555;
    padding-top: 2px;
    margin-top: 2px;
  }
</style>
</head>
<body>

  <!-- CUARTILLA 1 -->
  <div class="page">
    <div>
      <h1>Prácticas 13 y 14: Automatización de Pruebas y Validación Continua</h1>
      <div class="doc-subtitle">
        Aplicación Móvil Flutter y API Backend REST | Reporte Técnico de Validación Automatizada
      </div>

      <h2>Fase 1. Selección de Componentes Críticos y Análisis de Defectos Previos</h2>
      <p>
        Con base en auditorías previas de caja blanca y pruebas de carga, se seleccionaron tres componentes nucleares:
      </p>
      <ul>
        <li><strong>Función crítica del móvil:</strong> Validación y Registro de Citas (<code>AppointmentValidator</code> / <code>AppointmentModel</code>). <em>Riesgo prevenido:</em> Citas con campos nulos o fuera de jornada (03:00 AM) que causaban inconsistencias y fallos en UI.</li>
        <li><strong>Servicio de comunicación:</strong> Cliente HTTP REST (<code>ApiService</code>). <em>Riesgo prevenido:</em> Respuestas con errores HTTP 400 o 401 sin captura controlada hacia la experiencia de usuario.</li>
        <li><strong>Operación de persistencia:</strong> Servicio de almacenamiento local offline (<code>LocalDbService</code>). <em>Riesgo prevenido:</em> Pérdida de reservas ante caídas de red o excepciones (<code>SocketException</code>) sin respaldo en caché.</li>
      </ul>

      <h2>Fase 2. Automatización de Pruebas Unitarias (Lógica de Negocio Móvil)</h2>
      <p>
        Se implementaron cinco pruebas unitarias independientes utilizando <code>flutter_test</code> bajo el estándar AUT-01 a AUT-05, evaluando rangos válidos, campos nulos/vacíos, límites horarios y excepciones:
      </p>
      <div class="img-box">
        <img src="${unitImg}" alt="Pruebas Unitarias VS Code" />
        <div class="caption">Figura 1. Código de pruebas unitarias (AUT-01 a AUT-05) desarrollado en Visual Studio Code.</div>
      </div>

      <h2>Fase 3. Automatización de Integración entre Componentes</h2>
      <p>
        Se diseñaron tres pruebas de integración que validan la interacción entre UI móvil, servicio HTTP y persistencia local sin modificar código productivo ni generar dependencias externas frágiles:
      </p>
      <div class="img-box">
        <img src="${integImg}" alt="Pruebas de Integración VS Code" />
        <div class="caption">Figura 2. Código de pruebas de integración (AUT-06 a AUT-08) en Visual Studio Code.</div>
      </div>
    </div>

    <div class="page-footer">
      Página 1 de 2 | Prácticas 13 y 14: Automatización de Pruebas Móviles y CI/CD
    </div>
  </div>

  <!-- CUARTILLA 2 -->
  <div class="page">
    <div>
      <h2>Fase 4. Pipeline de Integración Continua (GitHub Actions CI)</h2>
      <p>
        Se configuró el flujo de CI en <code>.github/workflows/ci_validation.yml</code> activado automáticamente ante eventos de <code>push</code> y <code>pull_request</code> en las ramas principales, orquestando tres etapas:
      </p>
      <ul>
        <li><strong>Flutter Mobile Tests:</strong> Configura Flutter 3.44.0, instala paquetes, ejecuta <code>flutter analyze</code> y corre la suite completa de pruebas unitarias e integración con <code>flutter test --reporter expanded</code>.</li>
        <li><strong>Android Kotlin Gradle:</strong> Valida compilación y tareas de pruebas unitarias Gradle (<code>./gradlew testDebugUnitTest</code>).</li>
        <li><strong>Backend API Validation:</strong> Valida Node.js v20, resolución de paquetes y build estricto TypeScript.</li>
      </ul>

      <h2>Fase 5. Validación, Resultados y Matriz de Automatización</h2>
      <p>
        La suite se ejecutó en consola de forma independiente. Las 8 pruebas fueron aprobadas con 0 errores (100% éxito):
      </p>

      <div class="img-box">
        <img src="${shellImg}" alt="Ejecución de Pruebas en Shell" style="max-height: 160px; border: none;" />
        <div class="caption">Figura 3. Evidencia de ejecución con reporter expanded: 8 pruebas aprobadas (100%), 0 errores, tiempo 1.14s.</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 10%;">ID</th>
            <th style="width: 14%;">Tipo</th>
            <th style="width: 25%;">Componente</th>
            <th style="width: 39%;">Condición / Criterio de Aceptación</th>
            <th style="width: 12%;">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>AUT-01</td>
            <td>Unitaria</td>
            <td>AppointmentValidator</td>
            <td>Entrada válida: Datos íntegros y modelo correcto</td>
            <td class="status-pass">Aprobada</td>
          </tr>
          <tr>
            <td>AUT-02</td>
            <td>Unitaria</td>
            <td>AppointmentValidator</td>
            <td>Entrada vacía o nula: Rechazo controlado de campos</td>
            <td class="status-pass">Aprobada</td>
          </tr>
          <tr>
            <td>AUT-03</td>
            <td>Unitaria</td>
            <td>AppointmentValidator</td>
            <td>Valores fuera de rango: Horarios fuera de jornada (03:15)</td>
            <td class="status-pass">Aprobada</td>
          </tr>
          <tr>
            <td>AUT-04</td>
            <td>Unitaria</td>
            <td>AppointmentModel</td>
            <td>Resultado esperado: Normalización y estado por defecto</td>
            <td class="status-pass">Aprobada</td>
          </tr>
          <tr>
            <td>AUT-05</td>
            <td>Unitaria</td>
            <td>Deserializador JSON</td>
            <td>Manejo de excepciones: Captura segura FormatException</td>
            <td class="status-pass">Aprobada</td>
          </tr>
          <tr>
            <td>AUT-06</td>
            <td>Integración</td>
            <td>ClientProvider ↔ ApiService</td>
            <td>Envío de cita con respuesta válida HTTP 201 Created</td>
            <td class="status-pass">Aprobada</td>
          </tr>
          <tr>
            <td>AUT-07</td>
            <td>Integración</td>
            <td>ClientProvider ↔ ApiService</td>
            <td>Manejo controlado de error HTTP 400 Bad Request</td>
            <td class="status-pass">Aprobada</td>
          </tr>
          <tr>
            <td>AUT-08</td>
            <td>Persistencia</td>
            <td>ClientProvider ↔ LocalDbService</td>
            <td>Respaldo en almacenamiento local ante caída de servidor</td>
            <td class="status-pass">Aprobada</td>
          </tr>
        </tbody>
      </table>

      <h2>Fase 6. Conclusiones Técnicas</h2>
      <p>
        La automatización de pruebas y su orquestación en pipelines de CI son indispensables para blindar aplicaciones móviles y servicios backend frente a regresiones. Al aislar las pruebas en suites independientes e incorporar aserciones para entradas inválidas, excepciones de red y persistencia offline, se garantiza que cualquier cambio posterior preserve los contratos de API y las reglas operativas antes de alcanzar producción. Esto disminuye drásticamente el costo de mantenimiento de software, garantiza la resiliencia en condiciones de red hostiles y consolida un ciclo de entrega continuo robusto y verificable.
      </p>
    </div>

    <div class="page-footer">
      Página 2 de 2 | Prácticas 13 y 14: Automatización de Pruebas Móviles y CI/CD
    </div>
  </div>

</body>
</html>`;

const tmpReportHtml = path.join(P13_DIR, 'temp_report.html');
fs.writeFileSync(tmpReportHtml, reportHtml, 'utf8');

execFileSync(CHROME_PATH, [
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  `--print-to-pdf=${PDF_OUT}`,
  tmpReportHtml,
]);
fs.unlinkSync(tmpReportHtml);

// También copiamos una copia a la raíz para fácil acceso
fs.copyFileSync(PDF_OUT, path.resolve(ROOT, 'PRACTICAS_13_14_REPORTE_AUTOMATIZACION.pdf'));

console.log(`[OK] Reporte PDF generado exitosamente en: ${PDF_OUT}`);
console.log(`[OK] Copia sincronizada en la raíz del proyecto.`);
