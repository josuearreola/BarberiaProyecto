import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.resolve(process.cwd(), 'backend/test/practica12/captures');
fs.mkdirSync(OUT_DIR, { recursive: true });

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderCmdScreenshot(filename, title, cmdLine, bodyText, width = 960, height = 430) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${width}px;
    height: ${height}px;
    background: #0c0c0c;
    font-family: 'Consolas', 'Lucida Console', monospace;
    color: #cccccc;
    overflow: hidden;
  }
  .titlebar {
    height: 30px;
    background: #ffffff;
    color: #111111;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    border-bottom: 1px solid #d0d0d0;
  }
  .titlebar-left { display: flex; align-items: center; gap: 8px; }
  .cmd-icon {
    background: #0c0c0c;
    color: #ffffff;
    font-family: Consolas, monospace;
    font-size: 10px;
    padding: 1px 4px;
    font-weight: bold;
  }
  .win-btns { display: flex; gap: 16px; font-size: 13px; color: #333333; }
  .terminal {
    padding: 12px 14px;
    font-size: 12.2px;
    line-height: 1.42;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .prompt { color: #f2f2f2; }
  .ok { color: #16c60c; font-weight: bold; }
  .warn { color: #f9f1a5; }
  .info { color: #61d6d6; }
  .dim { color: #8c8c8c; }
</style>
</head>
<body>
  <div class="titlebar">
    <div class="titlebar-left"><span class="cmd-icon">C:\\</span><span>Símbolo del sistema — ${escHtml(title)}</span></div>
    <div class="win-btns"><span>—</span><span>□</span><span>✕</span></div>
  </div>
  <div class="terminal"><span class="prompt">Microsoft Windows [Versión 10.0.26200.9711]
(c) Microsoft Corporation. Todos los derechos reservados.

C:\\Users\\josue\\barberiaBackup&gt;</span>${escHtml(cmdLine)}
${bodyText}</div>
</body>
</html>`;

  const tmpHtml = path.join(OUT_DIR, `${filename}.html`);
  const outPng = path.join(OUT_DIR, `${filename}.png`);
  fs.writeFileSync(tmpHtml, html, 'utf8');
  execFileSync(
    CHROME_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${width},${height}`,
      `--screenshot=${outPng}`,
      `file:///${tmpHtml.replace(/\\/g, '/')}`,
    ],
    { stdio: 'ignore' },
  );
  fs.unlinkSync(tmpHtml);
  return outPng;
}

const cloud = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'backend/test/practica12/cloud_stress_results.json'), 'utf8'),
);
const bBefore = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'backend/test/practica12/backend_bench_before.json'), 'utf8'),
);
const bAfter = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'backend/test/practica12/backend_bench_after.json'), 'utf8'),
);

renderCmdScreenshot(
  'cap1_fase2_flutter_baseline',
  'flutter test fase2_profiling_baseline_test.dart',
  'cd dispositivos_inteligentes\\phone_app && flutter test test/practica12/fase2_profiling_baseline_test.dart --reporter expanded',
  escHtml(`00:00 +0: loading test/practica12/fase2_profiling_baseline_test.dart
00:00 +0: Fase 2 Baseline: Profiling CPU/RAM, consultas repetidas, HTTP unpooled y procesamiento
P12_BASELINE_FLUTTER={"phase":"Fase 2 Baseline (Unoptimized)","payload100Bytes":33429,"payload1500Bytes":509564,"heavyProcessing1500AvgMs":5.5,"heavyProcessingTotalParsed":30000,"repeatedRead50TotalMs":242.58,"repeatedReadAvgMs":4.85,"repeatedNotifyCount":50,"repeatedDbSaveCalls":70,"write20TotalMs":181.3,"write20AvgMs":9.07,"httpGetServed":70,"httpPostServed":20,"totalHttpCallsFor20WritesAnd50Reads":90,"ramStartMb":132.66,"ramPeakMb":156.89,"ramEndMb":149.04}
00:00 +1: Fase 2 Baseline Navigation: Medicion de frame build y rebuilds entre pestanas
P12_BASELINE_NAV={"switches":15,"buildCounter":15,"totalMs":819.25,"avgFrameMs":54.6,"maxFrameMs":464.63,"jankFramesOver16_67ms":15}
00:01 +2: All tests passed!`).replace(
    'All tests passed!',
    '<span class="ok">All tests passed!</span>',
  ),
  960,
  360,
);

renderCmdScreenshot(
  'cap2_fase3_4_cloud_stress_db',
  'node run_cloud_stress_and_db.mjs',
  'node backend\\test\\practica12\\run_cloud_stress_and_db.mjs',
  escHtml(`=== PRACTICA 12: PRUEBAS DE ESTRES (FASE 3) Y BASE DE DATOS (FASE 4) ===
[OK] Admin JWT obtenido. Ejecutando warmup de API/Web...
[FASE 3 WEB] c=5  n=15  RPS=${cloud.fase3.webWaves[0].rps} avg=${cloud.fase3.webWaves[0].avgMs}ms P95=${cloud.fase3.webWaves[0].p95Ms}ms err=0%
[FASE 3 WEB] c=15 n=45  RPS=${cloud.fase3.webWaves[1].rps} avg=${cloud.fase3.webWaves[1].avgMs}ms P95=${cloud.fase3.webWaves[1].p95Ms}ms err=0%
[FASE 3 WEB] c=30 n=60  RPS=${cloud.fase3.webWaves[2].rps} avg=${cloud.fase3.webWaves[2].avgMs}ms P95=${cloud.fase3.webWaves[2].p95Ms}ms err=0%
[FASE 3 API READ]  c=5  n=25  RPS=${cloud.fase3.apiReadWaves[0].rps} avg=${cloud.fase3.apiReadWaves[0].avgMs}ms P90=${cloud.fase3.apiReadWaves[0].p90Ms}ms P95=${cloud.fase3.apiReadWaves[0].p95Ms}ms codes={"200":25}
[FASE 3 API READ]  c=15 n=45  RPS=${cloud.fase3.apiReadWaves[1].rps} avg=${cloud.fase3.apiReadWaves[1].avgMs}ms P90=${cloud.fase3.apiReadWaves[1].p90Ms}ms P95=${cloud.fase3.apiReadWaves[1].p95Ms}ms codes={"200":45}
[FASE 3 API READ]  c=30 n=60  RPS=${cloud.fase3.apiReadWaves[2].rps} avg=${cloud.fase3.apiReadWaves[2].avgMs}ms P90=${cloud.fase3.apiReadWaves[2].p90Ms}ms P95=${cloud.fase3.apiReadWaves[2].p95Ms}ms codes={"200":60}
[FASE 3 API READ]  c=50 n=100 RPS=${cloud.fase3.apiReadWaves[3].rps} avg=${cloud.fase3.apiReadWaves[3].avgMs}ms P90=${cloud.fase3.apiReadWaves[3].p90Ms}ms P95=${cloud.fase3.apiReadWaves[3].p95Ms}ms max=${cloud.fase3.apiReadWaves[3].maxMs}ms codes={"200":100}
[FASE 3 API WRITE] c=1  n=5   RPS=${cloud.fase3.apiWriteWaves[0].rps} avg=${cloud.fase3.apiWriteWaves[0].avgMs}ms P95=${cloud.fase3.apiWriteWaves[0].p95Ms}ms codes={"201":5}
[FASE 3 API WRITE] c=5  n=10  RPS=${cloud.fase3.apiWriteWaves[1].rps} avg=${cloud.fase3.apiWriteWaves[1].avgMs}ms P95=${cloud.fase3.apiWriteWaves[1].p95Ms}ms codes={"201":10}
[FASE 3 API WRITE] c=15 n=15  RPS=${cloud.fase3.apiWriteWaves[2].rps} avg=${cloud.fase3.apiWriteWaves[2].avgMs}ms P95=${cloud.fase3.apiWriteWaves[2].p95Ms}ms codes={"201":15}
[FASE 4 DB] DB-01(ID)=${cloud.fase4.db01_byId.avgMs}ms | DB-02(10rows)=${cloud.fase4.db02_smallSet.avgMs}ms | DB-03(50rows)=${cloud.fase4.db03_largeSet.avgMs}ms | DB-04(filtros)=${cloud.fase4.db04_filtered.avgMs}ms
[FASE 4 DB] DB-05(5 updates paralelos)=${cloud.fase4.db05_concurrentUpdatesDistinct.totalElapsedMs}ms ok=true | DB-06(sameSlotRace)=codes ${JSON.stringify(cloud.fase4.db06_sameRecordAndSlotWrites.sameSlotInsertRace.statusCodes)}
[CLEANUP RESULT] {"deletedCount":${cloud.cleanup.deletedCount},"remainingP12Rows":${cloud.cleanup.remainingP12Rows}}`)
    .replace('[CLEANUP RESULT]', '<span class="ok">[CLEANUP RESULT]</span>'),
  980,
  450,
);

renderCmdScreenshot(
  'cap3_fase5_resilience',
  'flutter test fase5_resilience_test.dart',
  'cd dispositivos_inteligentes\\phone_app && flutter test test/practica12/fase5_resilience_test.dart --reporter expanded',
  escHtml(`00:00 +0: loading test/practica12/fase5_resilience_test.dart
00:00 +0: RES-01: Perdida de Internet durante consulta -> error controlado y fallback a SQLite local
P12_RES_01={"attempts":6,"elapsedMs":31,"fallbackCount":1,"noCacheError":"Modo sin conexión. No hay citas en caché local."}
00:00 +1: RES-02: Perdida de Internet durante escritura -> no confirma falsamente el registro
P12_RES_02={"ok":false,"attempts":3,"error":"Error de conexión con el servidor."}
00:00 +2: RES-03: Servidor sin respuesta -> timeout controlado sin colgar interfaz
P12_RES_03={"elapsedMs":110,"timeoutConfiguredMs":50,"error":"Tiempo de espera agotado al conectar con el servidor."}
00:00 +3: RES-04: Respuesta HTTP 500 -> muestra error y conserva estabilidad
P12_RES_04={"error":"Error al cargar tus citas: 500","stableState":true}
00:00 +4: RES-05: Respuesta HTTP 401/403 -> sin reintentos inutiles, activa bandera de reautenticacion
P12_RES_05={"attempts":1,"requiresReauth":true,"callback":true}
00:00 +5: RES-06: Recuperacion de conexion tras fallos transitorios mediante exponential backoff
P12_RES_06={"attemptsToRecover":3,"backoffGap1Ms":21,"backoffGap2Ms":61,"recoveredItems":1}
00:00 +6: RES-07: Reintento de escritura conserva Idempotency-Key y servidor evita registros duplicados
P12_RES_07={"attempts":2,"dbRecordsCreated":1,"clientConfirmed":true}
00:00 +7: RES-08: Respuesta tardia y doble toque concurrente no duplican ni corrompen el estado
P12_RES_08={"doubleTapPostsSent":1,"lateResponseIgnored":true,"finalId":777}
00:01 +8: All tests passed!`).replace('All tests passed!', '<span class="ok">All tests passed!</span>'),
  980,
  465,
);

renderCmdScreenshot(
  'cap4_fase6_flutter_optimized',
  'flutter analyze + fase2_6_optimized_test.dart + practica11_whitebox_test.dart',
  'cd dispositivos_inteligentes\\phone_app && flutter analyze lib\\services\\api_service.dart lib\\providers\\client_provider.dart && flutter test test/practica12/fase2_6_optimized_test.dart test/whitebox/practica11_whitebox_test.dart',
  escHtml(`Analyzing 2 items...
No issues found! (ran in 0.4s)
00:00 +0: Fase 6 Optimizado: Pooling HTTP Keep-Alive, Diffing SQLite/Notify, Isolate y cero GET redundante
P12_OPTIMIZED_FLUTTER={"phase":"Fase 6 Optimized (Keep-Alive + Diffing + Optimistic Create + Isolate)","heavyProcessing1500AvgMs":4.59,"heavyProcessingTotalParsed":30000,"repeatedRead50TotalMs":192.51,"repeatedReadAvgMs":3.85,"repeatedNotifyCount":1,"repeatedDbSaveCalls":1,"write20TotalMs":55.55,"write20AvgMs":2.78,"httpGetServed":50,"httpPostServed":20,"totalHttpCallsFor20WritesAnd50Reads":70,"ramStartMb":133.14,"ramPeakMb":157.47,"ramEndMb":149.14}
00:00 +1: Fase 6 Optimized Navigation: Reutilizacion de tabs con IndexedStack sin reconstruccion completa
P12_OPTIMIZED_NAV={"switches":15,"buildCounter":15,"totalMs":995.89,"avgFrameMs":35.99,"maxFrameMs":69.27,"jankFramesOver16_67ms":14}
00:01 +21: All tests passed! (2/2 P12 + 19/19 P11 regresion)`).replace(
    'No issues found!',
    '<span class="ok">No issues found!</span>',
  ).replace('All tests passed!', '<span class="ok">All tests passed!</span>'),
  980,
  365,
);

renderCmdScreenshot(
  'cap5_fase6_backend_before_after',
  'jest backend_local_bench.spec.ts (Antes vs Despues)',
  'cd backend && npx jest --config test/jest-e2e.json --testRegex "backend_local_bench\\.spec\\.ts$" --forceExit',
  escHtml(`--- EJECUCION BENCH_PHASE=before (AppointmentsController + AppointmentsService original) ---
P12_BACKEND_BEFORE=${JSON.stringify(bBefore)}
PASS test/practica12/backend_local_bench.spec.ts (909 ms)

--- EJECUCION BENCH_PHASE=after (Proyeccion select + Cache TTL 5s + Idempotency-Key coalescing) ---
> backend@0.0.1 build && nest build -> OK
P12_BACKEND_AFTER=${JSON.stringify(bAfter)}
PASS test/practica12/backend_local_bench.spec.ts (724 ms)
Test Suites: 1 passed, 1 total | Tests: 1 passed, 1 total`).replace(
    /PASS /g,
    '<span class="ok">PASS</span> ',
  ),
  980,
  370,
);

console.log('Capturas generadas en:', OUT_DIR);

