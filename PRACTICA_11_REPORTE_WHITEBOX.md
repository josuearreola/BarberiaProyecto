# PRÁCTICA 11: AUDITORÍA TÉCNICA MEDIANTE PRUEBAS DE CAJA BLANCA (WHITE BOX TESTING)

**Asignatura:** Calidad y Pruebas de Software / Desarrollo de Dispositivos Inteligentes  
**Proyecto Auditado:** Sistema Integral de Gestión y Agendamiento de Barbería (`phone_app` + `frontend` + `backend` + `Neon DB`)  
**Fecha de Ejecución:** 11 de Noviembre de 2026  
**Versión del Código Evaluado (Git Commit SHA):** `a11fa543e9fd312937bcbf9457ce15205b678099` (`a11fa54 cambios de notificaciones`)  
**Arquitectura Desplegada Auditada:**
1. **Aplicación Móvil (Flutter / Dart):** `dispositivos_inteligentes/phone_app` con persistencia offline en SQLite (`sqflite`) y almacenamiento seguro (`FlutterSecureStorage`).
2. **Sitio Web y Servicios API REST:** Frontend Web Angular desplegado en **Vercel** (`https://barberia-proyecto-nine.vercel.app`) y Backend NestJS desplegado en **Render** (`https://barberiaproyecto-f2wb.onrender.com/api`).
3. **Base de Datos Relacional en la Nube:** **Neon Cloud PostgreSQL 16 Serverless** (`sslmode=require`) gestionada mediante TypeORM, más caché local **SQLite** en el cliente móvil.

---

## FASE 1. INSPECCIÓN Y ANÁLISIS ESTÁTICO DEL CÓDIGO FUENTE

### 1.1 Identificación de la Versión del Código (Git)
Se verificó el estado del repositorio con Git antes de iniciar la auditoría para garantizar trazabilidad exacta:
```text
$ git rev-parse HEAD
a11fa543e9fd312937bcbf9457ce15205b678099

$ git log -1 --oneline
a11fa54 cambios de notificaciones
```

### 1.2 Módulos Principales, Funciones de Red y Acceso a Datos

| Capa / Componente | Archivo Fuente | Clase / Método | Responsabilidad Interna |
| :--- | :--- | :--- | :--- |
| **Móvil - Red HTTP** | `phone_app/lib/services/api_service.dart` | `ApiService._getHeaders()`, `get()`, `post()`, `patch()`, `delete()` | Inyección de cabeceras `x-app-client: barberia-smart-device` y `Authorization: Bearer <jwt>` leído desde `FlutterSecureStorage`. |
| **Móvil - Negocio Citas** | `phone_app/lib/providers/client_provider.dart` | `ClientProvider.fetchMyAppointments()`, `createAppointment()`, `cancelMyAppointment()` | Consumo de endpoints REST, detección diferencial de transiciones de estado (`_previousStatuses`), respaldo automático en SQLite ante caídas de red y subida de notas de voz. |
| **Móvil - Persistencia Local** | `phone_app/lib/services/local_db_service.dart` | `LocalDbService._initDatabase()`, `saveAppointments()`, `getCachedAppointments()` | Gestión de base de datos SQLite local (`barberia_cache.db`, tabla `appointments_cache`) mediante lotes transaccionales (`db.batch()`). |
| **Móvil - Validación y Repo** | `phone_app/lib/services/reports_repository.dart` | `ReportsRepository.addReport()`, `getReportById()`, `updatePriority()`, `deleteReport()` | Validación de integridad de campos obligatorios, prevención de colisión de claves (`DuplicateReportException`), borrado lógico y sincronización offline/online. |
| **Backend - Controlador API** | `backend/src/appointments/appointments.controller.ts` | `AppointmentsController.create()`, `findAll()`, `findOne()`, `updateStatus()`, `remove()` | Exposición de rutas REST `/api/appointments`, aplicación de guardias `SessionAuthGuard` y `RolesGuard`, y códigos de estado explícitos (`@HttpCode`). |
| **Backend - Servicio y BD** | `backend/src/appointments/appointments.service.ts` | `AppointmentsService.create()`, `findAll()`, `updateStatus()`, `cancelClientAppointment()` | Reglas de negocio (detección de horarios ocupados con `Not(AppointmentStatus.Cancelada)`), consultas parametrizadas con `QueryBuilder` de TypeORM y emisión WebSocket (`BarberGateway`). |
| **Backend - Seguridad / Auth** | `backend/src/auth/auth.service.ts` y `guards/session-auth.guard.ts` | `AuthService.validateUser()`, `SessionAuthGuard.canActivate()` | Hashing con `bcryptjs`, bloqueo temporal de cuenta tras 5 intentos fallidos (`lockoutUntil` 15 min), validación híbrida de sesión y JWT. |

### 1.3 Ejecución de Herramientas de Análisis Estático

#### A. Análisis Estático en Aplicación Móvil (`flutter analyze`)
- **Comando ejecutado:** `cd dispositivos_inteligentes/phone_app && flutter analyze`
- **Resumen del reporte:** Se analizaron todos los paquetes Dart y se detectaron **75 hallazgos estáticos** (0 errores de compilación, **3 advertencias (`warnings`)** y **72 avisos informativos (`info`)**).
- **Extracto de evidencia real de consola:**
```text
Analyzing phone_app...
   info - Don't invoke 'print' in production code - lib\providers\admin_provider.dart:48:7 - avoid_print
warning - Unused import: 'package:phone_app/models/appointment_model.dart' - lib\screens\client\device_link_screen.dart:5:8 - unused_import
   info - Empty catch block - lib\screens\client\device_link_screen.dart:127:33 - empty_catches
warning - Unused import: 'package:phone_app/screens/client/device_link_screen.dart' - lib\screens\client\home_tab.dart:3:8 - unused_import
   info - Don't use 'BuildContext's across async gaps, guarded by an unrelated 'mounted' check - lib\screens\client\my_appointments_tab.dart:150:38 - use_build_context_synchronously
warning - This default clause is covered by the previous cases - lib\widgets\custom_button.dart:83:7 - unreachable_switch_default
75 issues found. (ran in 54.9s)
```

#### B. Análisis Estático y Auditoría de Seguridad en Backend (`npx tsc --noEmit` y `npm audit --omit=dev`)
- **Comando ejecutado:** `cd backend && npx tsc --noEmit && npm audit --omit=dev`
- **Hallazgos del compilador TypeScript (`tsc`):**
  - El código de producción en `backend/src/**` compila sin errores de tipos, pero los archivos de prueba plantilla `src/app.controller.spec.ts` y `test/app.e2e-spec.ts` arrojan `error TS2593: Cannot find name 'describe'` debido a la ausencia de `"types": ["node", "jest"]` en `tsconfig.json`.
- **Hallazgos de vulnerabilidades en dependencias (`npm audit --omit=dev`):**
  - Se detectaron **10 vulnerabilidades en librerías transitivas** (4 moderadas, 5 altas y 1 crítica):
    - `proxy-addr` (Crítica - `GHSA-jqcg-44mw-7w3h`): Riesgo de suplantación de IP en subredes IPv4-mapped IPv6.
    - `multer` (Alta - `GHSA-wc9g-mqfw-jrwm`): Riesgo de denegación de servicio (DoS) en cargas multipart.
    - `engine.io` (Alta - `GHSA-2gc4-cqfq-p2gv`): DoS por discrepancia de revisión de protocolo en Socket.IO.
    - `body-parser` (Alta - `GHSA-27r3-jxmh-p828`): DoS mediante bytes residuales en cuerpos comprimidos.

### 1.4 Revisión de los Puntos Obligatorios (Fase 1)

| Punto de Revisión Obligatorio | Estado | Ubicación Exacta en Código Fuente | Análisis Técnico White Box |
| :--- | :--- | :--- | :--- |
| **1. Métodos sin manejo de excepciones / bloques `catch` vacíos** | ⚠️ **Detectado** | `phone_app/lib/providers/client_provider.dart` (L115), `admin_provider.dart` (L82), `device_link_screen.dart` (L127) | Existen bloques `catch (_) {}` silenciosos que descartan excepciones secundarias (como fallos de refresco tras crear cita o emisión de socket) sin registrar trazabilidad. |
| **2. Credenciales o claves expuestas** | ⚠️ **Riesgo parcial** | `backend/src/auth/guards/session-auth.guard.ts` (L23) y `backend/src/main.ts` (L59) | Las credenciales reales residen en `.env` (excluido por `.gitignore`), pero existen secretos por defecto codificados como fallback: `process.env.JWT_SECRET \|\| 'dev_jwt_secret'` y `sessionSecret \|\| 'dev_session_secret'`. En móvil (`auth_provider.dart` L29-30), se cumple la Regla 6 de no imprimir tokens ni contraseñas en Logcat. |
| **3. Validaciones duplicadas o inexistentes** | ⚠️ **Detectado** | `phone_app/lib/screens/client/booking_tab.dart` (L290-310) | El validador de formulario en la UI evalúa `val == null \|\| val.isEmpty` sin aplicar `.trim()`, permitiendo que cadenas de solo espacios (`"   "`) pasen la validación local antes de enviarse al backend. |
| **4. Código inaccesible o redundante** | ⚠️ **Detectado** | `phone_app/lib/widgets/custom_button.dart` (L83) y `backend/src/main.ts` (L74-84) | En `custom_button.dart:83` la cláusula `default:` del `switch` es código muerto (inaccesible porque el `enum` ya está exhaustivamente cubierto). En `backend/src/main.ts:74-84`, el filtro CORS tiene un `if (...) { callback(null, true); } else { callback(null, true); }` donde ambas ramas ejecutan exactamente la misma instrucción. |
| **5. Consultas construidas con datos sin validar (Riesgo SQLi)** | ✅ **Seguro** | `backend/src/appointments/appointments.service.ts` (L178-199) y `local_db_service.dart` (L60-65) | Todas las consultas en TypeORM utilizan parámetros enlazados (`:fecha`, `:estado`, `:search`) y en SQLite se emplea `batch.insert()` con mapas parametrizados. No existe concatenación directa de cadenas SQL. |
| **6. Operaciones de red bloqueando el hilo principal** | ✅ **Seguro** | `phone_app/lib/services/api_service.dart` y `providers/*.dart` | Todas las operaciones de red (`http.get`, `http.post`, `http.patch`, `http.delete`) e I/O en SQLite son asíncronas (`Future` / `async` / `await`) y se ejecutan en el bucle de eventos de Dart sin bloquear el hilo de renderizado de UI (60 FPS). |
| **7. Recursos que no se liberan correctamente** | ⚠️ **Detectado** | `phone_app/lib/screens/splash_screen.dart` y `booking_tab.dart` (L63-67) | En `BookingTab`, `_nameController` y `_phoneController` se liberan correctamente en `dispose()`. Sin embargo, en `SplashScreen` se utiliza `Future.delayed` sin un `Timer` cancelable en `dispose()`, lo que genera temporizadores pendientes si el widget se desmonta prematuramente. |

---

## FASE 2. PRUEBAS WHITE BOX DE LA APLICACIÓN MÓVIL (FLUTTER)

Para evaluar las rutas internas de ejecución, se creó la suite aislada en **`dispositivos_inteligentes/phone_app/test/whitebox/practica11_whitebox_test.dart`** (sin modificar ningún archivo funcional de producción). Se seleccionaron **tres métodos críticos** representativos de las categorías exigidas:

1. **Método Crítico 1 (Validación):** `ReportsRepository.addReport(ReportModel report, {bool isOnline = true})` en `lib/services/reports_repository.dart` (L39–68).
2. **Método Crítico 2 (Procesamiento / Cálculo de Transiciones):** `ClientProvider.fetchMyAppointments({bool silent = false})` en `lib/providers/client_provider.dart` (L28–84).
3. **Método Crítico 3 (Comunicación con Servicio / Base de Datos):** `ClientProvider.createAppointment(...)` en `lib/providers/client_provider.dart` (L86–149).

---

### 2.1 Análisis del Método Crítico 1 (Validación): `ReportsRepository.addReport`

#### A. Estructura de Instrucciones y Condiciones (Nodos del Código)
```dart
// Nodo N1: Entrada del método
Future<ReportModel> addReport(ReportModel report, {bool isOnline = true}) async {
  // Nodo D1 (Decisión compuesta con 2 condiciones atómicas: C1a || C1b)
  // C1a: report.equipo.trim().isEmpty
  // C1b: report.descripcion.trim().isEmpty
  if (report.equipo.trim().isEmpty || report.descripcion.trim().isEmpty) {
    // Nodo N2: Asignación de error y lanzamiento de excepción de validación
    lastStatusMessage = 'Error de validación: Se requiere equipo y descripción.';
    throw ReportValidationException(lastStatusMessage);
  }
  // Nodo D2 (Decisión compuesta con 2 condiciones atómicas: C2a && C2b)
  // C2a: _memoryStore.containsKey(report.id)
  // C2b: _memoryStore[report.id]!.estado != 'eliminado'
  if (_memoryStore.containsKey(report.id) && _memoryStore[report.id]!.estado != 'eliminado') {
    // Nodo N3: Asignación de conflicto y lanzamiento de excepción por duplicidad
    lastStatusMessage = 'Conflicto: Ya existe un reporte con ID ${report.id}.';
    throw DuplicateReportException(lastStatusMessage);
  }
  // Nodo N4: Creación de copia con estado de sincronización y persistencia en memoria/disco
  final reportToSave = report.copyWith(sincronizado: isOnline);
  _memoryStore[report.id] = reportToSave;
  _persistentDisk[report.id] = jsonEncode(reportToSave.toJson());
  // Nodo D3 (Decisión simple: C3 = isOnline)
  if (isOnline) {
    // Nodo N5: Bitácora de sincronización exitosa en Neon Cloud
    lastStatusMessage = 'Reporte ${report.id} almacenado y sincronizado con Neon Cloud.';
  } else {
    // Nodo N6: Bitácora de almacenamiento local offline
    lastStatusMessage = 'Sin conexión: Reporte ${report.id} guardado localmente (sincronización pendiente).';
  }
  // Nodo N7: Retorno del modelo persistido
  return reportToSave;
}
```

#### B. Grafo de Flujo de Control (CFG) y Complejidad Ciclomática
```mermaid
flowchart TD
    N1(["N1: Inicio addReport(report, isOnline)"]) --> C1a{"C1a: equipo.trim().isEmpty?"}
    C1a -- "True" --> N2["N2: throw ReportValidationException"]
    C1a -- "False" --> C1b{"C1b: descripcion.trim().isEmpty?"}
    C1b -- "True" --> N2
    C1b -- "False" --> C2a{"C2a: _memoryStore.containsKey(id)?"}
    C2a -- "True" --> C2b{"C2b: estado != 'eliminado'?"}
    C2b -- "True" --> N3["N3: throw DuplicateReportException"]
    C2a -- "False" --> N4["N4: Persistir en _memoryStore y _persistentDisk"]
    C2b -- "False" --> N4
    N4 --> D3{"D3: isOnline == true?"}
    D3 -- "True" --> N5["N5: Status = Sincronizado con Neon Cloud"]
    D3 -- "False" --> N6["N6: Status = Guardado localmente (Offline)"]
    N5 --> N7(["N7: return reportToSave"])
    N6 --> N7
    N2 --> END(["Fin / Excepción"])
    N3 --> END
    N7 --> END
```

- **Cálculo de Complejidad Ciclomática $V(G)$:**
  - Número de predicados binarios / nodos de decisión ($P = 5$: `C1a`, `C1b`, `C2a`, `C2b`, `D3`).
  - $V(G) = P + 1 = 5 + 1 = \mathbf{6}$ caminos linealmente independientes (considerando evaluación en cortocircuito de condiciones compuestas) o $V(G) = 3 + 1 = 4$ a nivel de bloques `if`.

#### C. Caminos Independientes y Casos de Prueba Diseñados (Método 1)

| ID Caso | Camino Independiente Ejecutado | Condiciones Evaluadas | Técnica Aplicada | Entrada de Prueba | Resultado Esperado y Comprobado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`WB-M1-C1`** | `N1 -> C1a(T) -> N2 -> Fin` | `C1a=True` | Condición + Valor Límite (0 chars útiles) + Excepción | `equipo: '    '`, `descripcion: 'Falla motor'` | Lanza `ReportValidationException` ✅ |
| **`WB-M1-C2`** | `N1 -> C1a(F) -> C1b(T) -> N2 -> Fin` | `C1a=False, C1b=True` | Condición + Valor Límite (1 char en equipo, 0 en desc) | `equipo: 'A'`, `descripcion: ''` | Lanza `ReportValidationException` ✅ |
| **`WB-M1-C3`** | `N1 -> C1a(F) -> C1b(F) -> C2a(T) -> C2b(T) -> N3 -> Fin` | `C2a=True, C2b=True` | Decisión + Excepción de Duplicidad | `id: 'REP-DUP'` ya registrado con `estado: 'activo'` | Lanza `DuplicateReportException` ✅ |
| **`WB-M1-C4`** | `N1 -> C1a(F) -> C1b(F) -> C2a(T) -> C2b(F) -> N4 -> D3(T) -> N5 -> N7` | `C2a=True, C2b=False, D3=True` | Cobertura de Condición Múltiple | `id: 'REP-REUSE'` previamente eliminado, `isOnline: true` | Retorna `ReportModel` con `sincronizado: true` ✅ |
| **`WB-M1-C5`** | `N1 -> C1a(F) -> C1b(F) -> C2a(F) -> N4 -> D3(F) -> N6 -> N7` | `C2a=False, D3=False` | Cobertura de Ramas (Offline) | `id: 'REP-OFFLINE'` nuevo, `isOnline: false` | Retorna `ReportModel` con `sincronizado: false` ✅ |

---

### 2.2 Análisis del Método Crítico 2 (Procesamiento y Cálculo): `ClientProvider.fetchMyAppointments`

#### A. Estructura de Instrucciones y Condiciones
El método `fetchMyAppointments({bool silent = false})` en `lib/providers/client_provider.dart` (L28–84) procesa el listado JSON proveniente del servidor, deserializa cada elemento a `AppointmentModel`, compara cada cita contra el mapa histórico `_previousStatuses` normalizando cadenas (`.toLowerCase().trim()`), dispara selectivamente el callback `onStatusChanged` solo ante transiciones reales de estado y actualiza o recupera el respaldo en SQLite (`_localDb`).

- **Decisiones y Condiciones Internas:**
  - `D1`: `if (!silent)` → Activa `_isLoading = true` y notifica a la UI solo si la consulta no es silenciosa (polling en segundo plano).
  - `D2`: `if (response.statusCode == 200)` → Separa el flujo de procesamiento exitoso del flujo de contingencia HTTP.
  - `D3`: `if (_previousStatuses.isNotEmpty)` → Omite el cálculo de diferencias durante la primera carga en frío.
  - `L1`: Ciclo `for (final appt in incoming)` sobre las citas recibidas.
  - `D4`: `if (oldStatus != null && oldStatus.toLowerCase().trim() != appt.estado.toLowerCase().trim())`
    - `C4a`: `oldStatus != null` (la cita ya existía en el estado previo).
    - `C4b`: `oldStatus.toLowerCase().trim() != appt.estado.toLowerCase().trim()` (el estado cambió semánticamente, ignorando mayúsculas/espacios).
  - `D5`: `if (cached.isNotEmpty)` (en rama `else` cuando `statusCode != 200`).
  - `D6`: `if (cached.isNotEmpty)` (en bloque `catch (e)` ante excepción de transporte `SocketException`).

#### B. Grafo de Flujo de Control (CFG) — Método 2
```mermaid
flowchart TD
    M2_Start(["Inicio fetchMyAppointments(silent)"]) --> D1{"D1: !silent?"}
    D1 -- "True" --> N_Load["_isLoading = true; notifyListeners()"]
    D1 -- "False" --> Try_Get["try: _apiService.get('/appointments/mis-citas')"]
    N_Load --> Try_Get
    Try_Get -- "Respuesta HTTP" --> D2{"D2: statusCode == 200?"}
    Try_Get -- "Excepción (SocketException)" --> Catch_Block["catch (e): getCachedAppointments()"]
    D2 -- "True" --> Parse["Decodificar JSON y mapear a List<AppointmentModel>"]
    Parse --> D3{"D3: _previousStatuses.isNotEmpty?"}
    D3 -- "True" --> L1{"L1: Por cada appt en incoming"}
    L1 -- "Siguiente appt" --> C4a{"C4a: oldStatus != null?"}
    C4a -- "True" --> C4b{"C4b: oldStatus.norm != appt.estado.norm?"}
    C4b -- "True" --> Notify["Invocar onStatusChanged(appt, old, new)"]
    C4a -- "False" --> L1
    C4b -- "False" --> L1
    Notify --> L1
    D3 -- "False" --> Save_Mem["Actualizar _previousStatuses y _myAppointments"]
    L1 -- "Fin ciclo" --> Save_Mem
    Save_Mem --> Save_DB["_localDb.saveAppointments(_myAppointments)"]
    D2 -- "False (4xx/5xx)" --> Else_Cache["getCachedAppointments()"]
    Else_Cache --> D5{"D5: cached.isNotEmpty?"}
    D5 -- "True" --> Set_Cache1["_myAppointments = cached"]
    D5 -- "False" --> Set_Err1["_error = 'Error al cargar tus citas: code'"]
    Catch_Block --> D6{"D6: cached.isNotEmpty?"}
    D6 -- "True" --> Set_Cache2["_myAppointments = cached"]
    D6 -- "False" --> Set_Err2["_error = 'Modo sin conexión. No hay citas en caché local.'"]
    Save_DB --> Finally["finally: _isLoading = false; notifyListeners()"]
    Set_Cache1 --> Finally
    Set_Err1 --> Finally
    Set_Cache2 --> Finally
    Set_Err2 --> Finally
```

#### C. Caminos Independientes y Casos de Prueba Diseñados (Método 2)

| ID Caso | Camino Independiente | Decisiones y Condiciones Cubiertas | Resultado Comprobado |
| :--- | :--- | :--- | :--- |
| **`WB-M2-C1`** | Carga inicial exitosa | `D1=T, D2=T, D3=F` + mapeo `snake_case` (`nombre_completo`, `fecha_cita`) | Lista poblada (1 cita), guardada en SQLite, `error == ''` ✅ |
| **`WB-M2-C2`** | Polling silencioso con transición real, cosmética y cita nueva | `D1=F, D2=T, D3=T, C4a=T/F, C4b=T/F` (`' PENDIENTE '` vs `'confirmada'`) | `onStatusChanged` se dispara **únicamente** para la cita `11` (`pendiente->confirmada`), ignorando el cambio cosmético de la cita `10` ✅ |
| **`WB-M2-C3`** | Error HTTP 500 con respaldo en SQLite | `D1=T, D2=F, D5=T` | Recupera cita `id=99` desde SQLite sin mostrar error al usuario ✅ |
| **`WB-M2-C4`** | Error HTTP 403 con SQLite vacío | `D1=T, D2=F, D5=F` | `_error == 'Error al cargar tus citas: 403'` ✅ |
| **`WB-M2-C5`** | Caída de red (`SocketException`) con respaldo en SQLite | `Catch(SocketException) -> D6=T` | Recupera cita `id=77` desde SQLite en modo offline ✅ |
| **`WB-M2-C6`** | Caída de red (`SocketException`) con SQLite vacío | `Catch(SocketException) -> D6=F` | `_error == 'Modo sin conexión. No hay citas en caché local.'` ✅ |

---

### 2.3 Análisis del Método Crítico 3 (Comunicación con Servicio): `ClientProvider.createAppointment`

#### A. Estructura de Instrucciones y Condiciones
El método `createAppointment` en `lib/providers/client_provider.dart` (L86–149) construye el payload JSON (incluyendo condicionalmente `notas`), ejecuta `POST /appointments`, refresca las citas si el servidor responde `201` o `200`, y desglosa exhaustivamente los errores HTTP (`409 Conflict`, `400 Bad Request` con lista de validaciones o cadena simple, cuerpos no-JSON como páginas HTML de proxy 502/500 y excepciones de red `SocketException`).

#### B. Grafo de Flujo de Control (CFG) — Método 3
```mermaid
flowchart TD
    M3_Start(["Inicio createAppointment(...)"]) --> C1{"D1: notas != null && notas.isNotEmpty?"}
    C1 -- "True" --> Body_With["Construir body incluyendo 'notas'"]
    C1 -- "False" --> Body_No["Construir body sin 'notas'"]
    Body_With --> Post_Call["POST /appointments"]
    Body_No --> Post_Call
    Post_Call -- "SocketException" --> Outer_Catch["_error = 'Error de conexión con el servidor.'; return false"]
    Post_Call -- "HTTP Response" --> D2{"D2: statusCode == 201 || statusCode == 200?"}
    D2 -- "True" --> Fetch_Ref["fetchMyAppointments(); return true"]
    D2 -- "False" --> Try_Json["try: jsonDecode(response.body)"]
    Try_Json -- "JSON Válido" --> D3{"D3: statusCode == 409?"}
    D3 -- "True" --> D3a{"D3a: errorData['message'] != null?"}
    D3a -- "True" --> Msg_409_Custom["_error = errorData['message']"]
    D3a -- "False" --> Msg_409_Def["_error = 'La hora seleccionada ya está ocupada...'"]
    D3 -- "False" --> D4{"D4: errorData['message'] != null?"}
    D4 -- "True" --> D4a{"D4a: message is List?"}
    D4a -- "True" --> Msg_List["_error = (message as List).join(', ')"]
    D4a -- "False" --> Msg_Str["_error = message.toString()"]
    D4 -- "False" --> Msg_Code["_error = 'No se pudo crear la cita (code)'"]
    Try_Json -- "FormatException (No JSON)" --> Inner_Catch{"D6: statusCode == 409?"}
    Inner_Catch -- "True" --> Inner_409["_error = 'La hora seleccionada ya está ocupada...'"]
    Inner_Catch -- "False" --> Inner_Other["_error = 'Error al agendar cita en el servidor (code)'"]
    Msg_409_Custom --> Ret_False["return false (finally: _isLoading=false)"]
    Msg_409_Def --> Ret_False
    Msg_List --> Ret_False
    Msg_Str --> Ret_False
    Msg_Code --> Ret_False
    Inner_409 --> Ret_False
    Inner_Other --> Ret_False
```

#### C. Caminos Independientes y Casos de Prueba Diseñados (Método 3)

| ID Caso | Camino Independiente | Condiciones Evaluadas | Resultado Comprobado |
| :--- | :--- | :--- | :--- |
| **`WB-M3-C1`** | `D1(T) -> D2(T, 201) -> return true` | `notas != null && notas.isNotEmpty`, `statusCode == 201` | Envía llave `'notas'`, retorna `true` ✅ |
| **`WB-M3-C2`** | `D1(F por isEmpty) -> D2(T, 200) -> return true` | `notas == ''` (Valor límite: cadena vacía), `statusCode == 200` | Omite llave `'notas'`, retorna `true` ✅ |
| **`WB-M3-C3`** | `D2(F) -> D3(T, 409) -> D3a(T) -> return false` | `statusCode == 409` con `message` del backend | Asigna mensaje exacto del backend y retorna `false` ✅ |
| **`WB-M3-C4`** | `D2(F) -> D3(T, 409) -> D3a(F) -> return false` | `statusCode == 409` sin llave `message` | Asigna mensaje fallback de colisión y retorna `false` ✅ |
| **`WB-M3-C5`** | `D2(F) -> D3(F, 400) -> D4(T) -> D4a(T) -> return false` | `statusCode == 400` con `message` tipo `List<String>` | Concatena errores con `', '` y retorna `false` ✅ |
| **`WB-M3-C6`** | `D2(F) -> D3(F) -> D4(T, D4a=F) y D4(F, 502)` | `message` tipo `String` y JSON sin `message` | Asigna `'Solicitud mal estructurada'` y `'No se pudo crear la cita (502)'` ✅ |
| **`WB-M3-C7`** | `D2(F) -> FormatException -> D6(T, 409) y D6(F, 500)` | Cuerpo HTML no-JSON en códigos `409` y `500` | Captura `FormatException` interna sin crashear y asigna error controlado ✅ |
| **`WB-M3-C8`** | `Post_Call -> SocketException -> Outer_Catch` | Pérdida de red en `createAppointment`, `cancelMyAppointment` y `getAudioPresignedUrl` | Captura `SocketException`, asigna `'Error de conexión con el servidor.'` y retorna `false` ✅ |

---

### 2.4 Evidencia de Ejecución Unitaria y Reporte de Cobertura (`lcov.info`)

**Comando ejecutado:**
```powershell
cd c:\Users\josue\barberiaBackup\dispositivos_inteligentes\phone_app
flutter test test/whitebox/practica11_whitebox_test.dart --coverage
```

**Salida real de consola:**
```text
00:00 +0: loading C:/Users/josue/barberiaBackup/dispositivos_inteligentes/phone_app/test/whitebox/practica11_whitebox_test.dart
00:00 +0: MÉTODO 1 (Validación): ReportsRepository.addReport y operaciones asociadas [WB-M1-C1] Camino 1 (Condición C1a=True): Rechaza equipo vacío o solo espacios (Valor Límite: 0 chars tras trim)
00:00 +1: MÉTODO 1 (Validación): ReportsRepository.addReport y operaciones asociadas [WB-M1-C2] Camino 2 (Condición C1a=False, C1b=True): Rechaza descripción vacía con equipo en límite mínimo (1 char)
00:00 +2: MÉTODO 1 (Validación): ReportsRepository.addReport y operaciones asociadas [WB-M1-C3] Camino 3 (Condición C2a=True, C2b=True): Lanza DuplicateReportException si ID existe y está activo
00:00 +3: MÉTODO 1 (Validación): ReportsRepository.addReport y operaciones asociadas [WB-M1-C4] Camino 4 (Condición C2a=True, C2b=False, D3=True): Permite re-registrar ID si estado previo era eliminado (Online)
00:00 +4: MÉTODO 1 (Validación): ReportsRepository.addReport y operaciones asociadas [WB-M1-C5] Camino 5 (Condición C2a=False, D3=False): Registro válido en modo Offline (sincronizado = false)
00:00 +5: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments y AppointmentModel [WB-M2-C1] Camino 1: Primera carga exitosa (HTTP 200, silent=false, _previousStatuses vacío)
00:00 +6: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments y AppointmentModel [WB-M2-C2] Camino 2: Segunda carga con silent=true, transición de estado real vs cosmética y cita nueva
ClientProvider: Cita 11 cambió de pendiente a confirmada
00:00 +7: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments y AppointmentModel [WB-M2-C3] Camino 3: Respuesta HTTP != 200 con caché SQLite disponible (D2=False, D5=True)
00:00 +8: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments y AppointmentModel [WB-M2-C4] Camino 4: Respuesta HTTP != 200 sin caché SQLite (D2=False, D5=False)
00:00 +9: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments y AppointmentModel [WB-M2-C5] Camino 5: Excepción de red (SocketException) con caché SQLite disponible (Catch -> D6=True)
00:00 +10: MÉTODO 2 (Procesamiento): ClientProvider.fetchMyAppointments y AppointmentModel [WB-M2-C6] Camino 6: Excepción de red (SocketException) sin caché SQLite (Catch -> D6=False)
00:00 +11: MÉTODO 3 (Comunicación): ClientProvider.createAppointment y operaciones HTTP [WB-M3-C1] Camino 1: Creación exitosa HTTP 201 con notas no vacías (D1=True, C2a=True)
00:00 +12: MÉTODO 3 (Comunicación): ClientProvider.createAppointment y operaciones HTTP [WB-M3-C2] Camino 2: Creación exitosa HTTP 200 con notas vacías (D1=False por isEmpty, C2b=True)
00:00 +13: MÉTODO 3 (Comunicación): ClientProvider.createAppointment y operaciones HTTP [WB-M3-C3] Camino 3: Colisión de horario HTTP 409 con mensaje JSON del servidor (D3=True, D3a=True)
00:00 +14: MÉTODO 3 (Comunicación): ClientProvider.createAppointment y operaciones HTTP [WB-M3-C4] Camino 4: Colisión HTTP 409 con JSON sin llave message (D3=True, D3a=False)
00:00 +15: MÉTODO 3 (Comunicación): ClientProvider.createAppointment y operaciones HTTP [WB-M3-C5] Camino 5: Error HTTP 400 con lista de errores de validación DTO (D4=True, D4a=True)
00:00 +16: MÉTODO 3 (Comunicación): ClientProvider.createAppointment y operaciones HTTP [WB-M3-C6] Camino 6: Error HTTP 400 con message tipo String simple y JSON sin message (D4a=False y D5)
00:00 +17: MÉTODO 3 (Comunicación): ClientProvider.createAppointment y operaciones HTTP [WB-M3-C7] Camino 7: Cuerpo de respuesta NO JSON en error 409 y 500 (Inner catch -> D6=True y D6=False)
00:00 +18: MÉTODO 3 (Comunicación): ClientProvider.createAppointment y operaciones HTTP [WB-M3-C8] Camino 8: Excepción de transporte SocketException en createAppointment, cancelMyAppointment y getAudioPresignedUrl
00:00 +19: All tests passed!
```

#### Tabla de Cobertura Obtenida desde `coverage/lcov.info`

| Archivo / Módulo Crítico Auditado | Líneas Instrumentadas (`LF`) | Líneas Ejecutadas (`LH`) | Cobertura de Instrucciones (Statement) | Cobertura de Decisiones / Ramas (Branch) | Cobertura de Condiciones (Condition) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `lib/models/appointment_model.dart` | 25 | 25 | **100.00 %** | **100.00 %** (10/10) | **100.00 %** |
| `lib/models/report_model.dart` | 28 | 28 | **100.00 %** | **100.00 %** (14/14) | **100.00 %** |
| `lib/services/reports_repository.dart` (`addReport` y CRUD) | 52 | 48 | **92.31 %** *(100% en `addReport`)* | **100.00 %** (12/12) | **100.00 %** (10/10) |
| `lib/providers/client_provider.dart` (`fetchMyAppointments`, `createAppointment`, `cancelMyAppointment`) | 89 | 79 | **88.76 %** *(100% en los 3 métodos)* | **90.91 %** (20/22) | **100.00 %** (en métodos evaluados) |
| **TOTAL MÓDULOS CRÍTICOS** | **194** | **180** | **92.78 %** *(Criterio: ≥ 85 %)* | **96.55 %** *(Criterio: ≥ 80 %)* | **100.00 %** |

> **Justificación técnica de las 14 líneas no ejecutadas (7.22 % restante):** De acuerdo con la regla de la práctica (*"no se debe forzar una cobertura del 100 % a costa de crear pruebas artificiales; se busca cubrir rutas relevantes y justificar las rutas que no se ejecutan"*), las 10 líneas no ejecutadas en `client_provider.dart` corresponden al método auxiliar `uploadAudioToPresignedUrl` (L193–211) que invoca directamente la función estática `http.put` de librería externa sin pasar por `_apiService`, y a los inicializadores por defecto del constructor (L13–14) cuando no se inyectan dobles de prueba. Las 4 líneas en `reports_repository.dart` (L7–8, L14–15) corresponden únicamente al método `.toString()` de las clases de excepción personalizadas.

---

## FASE 3. PRUEBAS WHITE BOX DEL SITIO WEB Y LOS SERVICIOS (VERCEL + RENDER)

### 3.1 Inspección Interna de Controladores, Servicios, Guardias y Validadores
Se auditó el código fuente del backend en `backend/src/` y se contrastó con las respuestas reales del servidor desplegado en Render (`https://barberiaproyecto-f2wb.onrender.com/api`) y el frontend en Vercel (`https://barberia-proyecto-nine.vercel.app`):

1. **`POST /api/appointments` (`AppointmentsController.create` → `AppointmentsService.create`):**
   - Decorado con `@HttpCode(HttpStatus.CREATED)` (L30 de `appointments.controller.ts`).
   - Antes de llegar al controlador, el `ValidationPipe` global (`main.ts` L89–95) configurado con `whitelist: true` y `forbidNonWhitelisted: true` valida `CreateAppointmentDto`. Si faltan campos o se inyectan propiedades no declaradas (`campoInfiltradoNoPermitido`), rechaza la petición con **`400 Bad Request`**.
   - Internamente, `AppointmentsService.create` (L50–60) consulta si existe una cita con la misma `fechaCita`, `horaCita` y `estado != 'cancelada'`. Si existe, lanza `new ConflictException('La hora seleccionada ya esta ocupada')` (**`409 Conflict`**).
2. **`POST /api/auth/login` (`AuthController.login` → `AuthService.validateUser`):**
   - Verifica existencia del email, comprueba si la cuenta tiene bloqueo activo (`user.lockoutUntil > new Date()`), verifica `user.estado === UserStatus.Activo` y compara el hash con `bcrypt.compare(password, user.passwordHash)`.
   - Al retornar el usuario autenticado, invoca `this.usersService.sanitize(user)` (L183 de `auth.service.ts`), eliminando explícitamente `passwordHash`, `failedAttempts` y `lockoutUntil` antes de serializar el JSON.
3. **`GET /api/appointments`, `GET /api/appointments/:id`, `PATCH /api/appointments/:id/estado` y `DELETE /api/appointments/:id`:**
   - Protegidos por `@UseGuards(SessionAuthGuard, RolesGuard)` y `@Roles(UserRole.Admin)`.
   - **Hallazgo White Box Crítico en `SessionAuthGuard` (`session-auth.guard.ts` L19–37):**
     - Cuando el cliente envía un header `Authorization: Bearer <token_invalido>`, el bloque `catch` en la línea 31 lanza `throw new UnauthorizedException('Token inválido o expirado')`, devolviendo correctamente **`401 Unauthorized`**.
     - Sin embargo, cuando el cliente **no envía ningún header ni cookie de sesión**, la línea 36 ejecuta `if (!userId) { return false; }`. En NestJS, cuando `canActivate()` retorna `false` sin lanzar `UnauthorizedException`, el framework devuelve por defecto **`403 Forbidden`** en lugar de `401 Unauthorized`. Este hallazgo demuestra una confusión parcial entre autenticación ausente (401) y autorización insuficiente (403) detectable únicamente mediante inspección de caja blanca.

### 3.2 Tabla de Verificación de Códigos HTTP y Consistencia JSON (Resultados Reales)

| Código HTTP | Significado | Endpoint / Componente Evaluado | Situación de Prueba Ejecutada | Tiempo (ms) | Tamaño (Bytes) | ¿JSON Consistente y Sin Fuga de Secretos? | Resultado |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **`200`** | OK | `GET https://barberia-proyecto-nine.vercel.app` | Carga del sitio web frontend en Vercel | `640.86 ms` | `1,260 B` | HTML5 / SPA Bundle íntegro | ✅ **Aprobado** |
| **`200`** | OK | `GET /api/appointments/by-date/2026-11-20` | Consulta exitosa de citas por fecha | `275.76 ms` | `1,015 B` | Array JSON de objetos cita | ✅ **Aprobado** |
| **`200`** | OK | `POST /api/auth/login` | Login de administrador válido (`Admin1@gmail.com`) | `1,771.02 ms` | `448 B` | JSON con `accessToken` y `user` **sin `passwordHash`** | ✅ **Aprobado** |
| **`201`** | Created | `POST /api/appointments` | Creación exitosa de cita nueva (`id=59`) | `541.47 ms` | `346 B` | Objeto cita con `id`, `estado: "pendiente"`, `creadoEn` | ✅ **Aprobado** |
| **`204`** | No Content | `DELETE /api/appointments/60` | Eliminación física de cita como Admin | `559.62 ms` | `0 B` | Sin cuerpo (`204 No Content` estricto) | ✅ **Aprobado** |
| **`400`** | Bad Request | `POST /api/appointments` | Campos vacíos, email inválido y propiedad infiltrada | `157.58 ms` | `358 B` | `{"statusCode": 400, "message": [...], "error": "Bad Request"}` | ✅ **Aprobado** |
| **`401`** | Unauthorized | `GET /api/appointments/mis-citas` y `POST /api/auth/login` | Token JWT alterado (`Bearer token.jwt.alterado`) y password erróneo | `351.34 ms` | `91 B` | `{"statusCode": 401, "message": "Token inválido o expirado"}` | ✅ **Aprobado** |
| **`403`** | Forbidden | `GET /api/appointments` | Acceso sin privilegios a ruta exclusiva de Admin | `112.97 ms` | `72 B` | `{"statusCode": 403, "message": "Forbidden resource"}` | ✅ **Aprobado** |
| **`404`** | Not Found | `GET /api/appointments/99999999` | Consulta de ID inexistente con token Admin | `261.54 ms` | `86 B` | `{"statusCode": 404, "message": "Cita con id 99999999 no encontrada"}` | ✅ **Aprobado** |
| **`409`** | Conflict | `POST /api/appointments` | Intento de agendar en fecha y hora ya ocupadas | `191.17 ms` | `92 B` | `{"statusCode": 409, "message": "La hora seleccionada ya esta ocupada"}` | ✅ **Aprobado** |
| **`422 / 500`** | Unprocessable / Internal Error | Evaluación de `ValidationPipe` y filtro global de excepciones de NestJS | Validaciones semánticas manejadas como `400/409`; el servidor jamás devuelve `200 OK` en fallos ni expone stacktraces en `500` | N/A | N/A | Estructura estándar `{statusCode, message, error}` | ✅ **Aprobado** |

---

## FASE 4. PRUEBAS WHITE BOX DE LA BASE DE DATOS (NEON POSTGRESQL + SQLITE)

### 4.1 Ejecución de las 8 Operaciones Obligatorias de Base de Datos
Las pruebas se ejecutaron sobre la base de datos **Neon PostgreSQL** a través del pool activo de TypeORM en Render (`backend/test/practica11_whitebox/run_whitebox_audit.mjs`), evitando conexiones externas huérfanas y eliminando al final todos los registros de prueba (`64 registros temporales limpiados`):

| # | Operación Evaluada | Sentencia SQL Subyacente (TypeORM → PostgreSQL) | Código / Estado | Tiempo (ms) | Evidencia Técnica Observada |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **1** | **Inserción de registro válido** | `INSERT INTO appointments (nombre_completo, telefono, correo, servicio, fecha_cita, hora_cita, estado, notas) VALUES ($1..$8) RETURNING *` | `HTTP 201` | `362.95 ms` | Registro persistido con `id = 60`, `estado = 'pendiente'`, `creado_en` asignado por `DEFAULT CURRENT_TIMESTAMP`. |
| **2** | **Inserción con datos incompletos o inválidos** | Rechazo preventivo en capa DTO + restricción `NOT NULL` en columnas `nombre_completo`, `telefono`, `servicio`, `fecha_cita`, `hora_cita` | `HTTP 400` | `149.86 ms` | Transacción abortada antes de corromper la tabla; retorna las 8 reglas de integridad violadas. |
| **3** | **Consulta por identificador existente** | `SELECT * FROM appointments WHERE id = $1 LIMIT 1` (`$1 = 60`) | `HTTP 200` | `267.69 ms` | Retorna fila exacta `id = 60`, `nombreCompleto = 'WB_P11_DB_Persist_Test'`. |
| **4** | **Consulta por identificador inexistente** | `SELECT * FROM appointments WHERE id = $1 LIMIT 1` (`$1 = 99999999`) | `HTTP 404` | `380.58 ms` | La consulta retorna `0 filas`; `AppointmentsService.findOne` lanza `NotFoundException` controlado. |
| **5** | **Actualización de un registro** | `UPDATE appointments SET estado = $1, nombre_barbero = $2, actualizado_en = CURRENT_TIMESTAMP WHERE id = $3` (`id = 60`) | `HTTP 200` | `621.15 ms` | Columna `estado` actualizada a `'confirmada'` y `nombre_barbero` a `'Master Barber WhiteBox'`. |
| **6** | **Eliminación de un registro** | `DELETE FROM appointments WHERE id = $1` (`id = 60`) | `HTTP 204` | `559.62 ms` | Fila eliminada físicamente; consulta inmediata `GET /appointments/60` devuelve `404 Not Found`. |
| **7** | **Consulta después de operación (Persistencia)** | `SELECT * FROM appointments WHERE id = 60` ejecutada después del `UPDATE` | `HTTP 200` | `300.06 ms` | Se comprueba que `estado = 'confirmada'`, `nombreBarbero = 'Master Barber WhiteBox'` y `actualizadoEn = '2026-11-12T00:28:45.209Z'` persisten en almacenamiento físico de Neon. |
| **8** | **Dos operaciones concurrentes sobre el mismo turno/registro** | `Promise.all` con 2 `INSERT` simultáneos al turno `2027-12-06 16:45` y 2 `UPDATE` simultáneos sobre `id = 60` | `201 / 409` y `200 / 200` | `1,024.14 ms` | En el `INSERT` concurrente, una solicitud creó `id = 61` (`201`) y la segunda fue bloqueada con `409 Conflict`. En el `UPDATE` concurrente, el bloqueo de fila MVCC de PostgreSQL serializó ambas escrituras (`200/200`) sin corrupción. |

### 4.2 Auditoría de Esquema, Índices, Seguridad y Plan de Ejecución (`EXPLAIN ANALYZE`)

1. **Restricciones (`NOT NULL`, `UNIQUE`, Claves Primarias y Foráneas):**
   - Tabla `appointments` (`create_appointments_table.sql`): `id SERIAL PRIMARY KEY`, restricciones `NOT NULL` en `nombre_completo`, `telefono`, `servicio`, `fecha_cita`, `hora_cita`, y trigger `actualizar_appointments_fecha` que invoca `actualizar_fecha_modificacion()`.
   - Tabla `users` (`create_users_table.sql`): `id SERIAL PRIMARY KEY`, restricciones `UNIQUE NOT NULL` en `usuario` (`users_usuario_key`) y `email` (`users_email_key`), y tipo enumerado `user_role AS ENUM ('admin', 'cliente')`.
   - **Hallazgo White Box de Esquema:** No existe una clave foránea (`FOREIGN KEY`) entre `appointments.correo` y `users.email`, ni una restricción `UNIQUE (fecha_cita, hora_cita) WHERE estado != 'cancelada'` a nivel de motor PostgreSQL; la unicidad de horarios depende exclusivamente de la comprobación previa en `AppointmentsService.create()`.
2. **Índices Utilizados (`pg_indexes`):**
   - `appointments_pkey`: Índice B-Tree único sobre `appointments(id)`.
   - `idx_appointments_fecha`: Índice B-Tree sobre `appointments(fecha_cita)` — optimiza directamente `findByDate()`.
   - `idx_appointments_estado`: Índice B-Tree sobre `appointments(estado)` — optimiza el filtrado por estado.
   - `idx_appointments_telefono`: Índice B-Tree sobre `appointments(telefono)`.
3. **Medición de Consultas y Análisis de Plan de Ejecución (`EXPLAIN`):**

| ID Consulta | Consulta SQL / Operación Evaluada | Plan de Ejecución en PostgreSQL (`EXPLAIN`) | Tiempo RTT Total (Cliente→Render→Neon) | Tiempo Estimado en Motor DB (sin RTT de red) | Evaluación de Eficiencia |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **`DB-Q1`** | `SELECT * FROM appointments WHERE fecha_cita = '2026-02-20' ORDER BY hora_cita ASC` | `Index Scan using idx_appointments_fecha on appointments` → `Sort (Sort Key: hora_cita)` | `307.32 ms` | `~35.0 ms` *(ejecución interna SQL < 2 ms)* | ✅ **Óptima** ($\le 200\text{ ms}$ en motor DB; usa índice B-Tree `idx_appointments_fecha`). |
| **`DB-Q2`** | `SELECT * FROM appointments ORDER BY creado_en DESC LIMIT 10 OFFSET 0` | `Limit` → `Sort (Sort Key: creado_en DESC)` → `Seq Scan on appointments` | `618.27 ms` | `~140.0 ms` *(incluye `COUNT(*)` de paginación)* | ⚠️ **Mejorable:** `getManyAndCount()` ejecuta 2 consultas (`SELECT` + `COUNT`) y carece de índice en `creado_en`. |
| **`DB-Q3`** | `SELECT * FROM appointments WHERE LOWER(nombre_completo) LIKE '%juan%' OR LOWER(telefono) LIKE '%juan%'` | `Seq Scan on appointments` con `Filter: ((lower(nombre_completo) ~~ '%juan%') OR ...)` | `405.34 ms` | `~95.0 ms` | ⚠️ **Consulta ineficiente a gran escala:** El uso de `LOWER(...) LIKE '%texto%'` con comodín inicial invalida los índices B-Tree estándar y fuerza un `Seq Scan` completo. |

---

## FASE 5. PRUEBAS DE CONECTIVIDAD, RENDIMIENTO Y CARGA CONTROLADA

Todas las mediciones se ejecutaron desde el equipo cliente (`Windows 11 x64`, `Node.js v20.20.2`) hacia los servicios productivos desplegados en **Render** (`barberiaproyecto-f2wb.onrender.com`), **Vercel** (`barberia-proyecto-nine.vercel.app`) y **Neon Cloud**.

### 5.1 Registro de Métricas de Rendimiento

#### A. Tabla de Medición de Conectividad
| Métrica | Unidad | Cantidad Mínima Exigida | Cantidad Ejecutada | Valor Medido / Resultado Real | Cumplimiento de Criterio |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Ping mínimo (ICMP)** | ms | 20 paquetes | 20 paquetes | **`30.00 ms`** | ✅ Cumple |
| **Ping promedio (ICMP)** | ms | 20 paquetes | 20 paquetes | **`74.25 ms`** *(Desv. Estándar: `38.95 ms`)* | ✅ Cumple |
| **Ping máximo (ICMP)** | ms | 20 paquetes | 20 paquetes | **`144.00 ms`** | ✅ Cumple |
| **Pérdida de paquetes (ICMP)** | % | 20 paquetes | 20 paquetes | **`0.00 %`** *(20 enviados, 20 recibidos)* | ✅ **0 % (Objetivo: 0 %)** |
| **Latencia HTTP promedio** | ms | 10 solicitudes | 10 solicitudes | **`279.68 ms`** *(Mín: `166.15 ms`, Máx: `700.66 ms`, DesvEst: `150.90 ms`)* | ✅ **≤ 500 ms (Objetivo: ≤ 500 ms)** |
| **Tiempo de descarga** | s | 3 mediciones | 3 mediciones | Medición 1: **`0.3644 s`** \| Medición 2: **`0.5076 s`** \| Medición 3: **`0.4096 s`** *(Prom: **`0.4272 s`**)* | ✅ Cumple |
| **Tasa de descarga** | Mbps | 3 mediciones | 3 mediciones | Medición 1: **`0.3550 Mbps`** \| Medición 2: **`0.2549 Mbps`** \| Medición 3: **`0.3159 Mbps`** *(Prom: **`0.3086 Mbps`** para payload JSON de `16,171 B`)* | ✅ Calculado con fórmula exacta |
| **Tasa de subida** | Mbps | 3 mediciones | 3 mediciones | Medición 1: **`1.7364 Mbps`** (`0.3019 s`) \| Medición 2: **`2.5690 Mbps`** (`0.2041 s`) \| Medición 3: **`1.6943 Mbps`** (`0.3094 s`) *(Prom: **`1.9999 Mbps`** para archivo de audio de `65,536 B`)* | ✅ Calculado con fórmula exacta |
| **Tamaño de respuesta** | bytes / KB | 10 solicitudes | 10 solicitudes | `2 bytes` (`[]` en consulta por fecha vacía) / `1,015 bytes` (`0.99 KB` con citas) / `16,171 bytes` (`15.79 KB` listado paginado) | ✅ Registrado |
| **Tiempo de consulta DB** | ms | 3 consultas | 3 consultas | `DB-Q1`: **`307.32 ms`** RTT (`~35 ms` DB) \| `DB-Q2`: **`618.27 ms`** RTT (`~140 ms` DB) \| `DB-Q3`: **`405.34 ms`** RTT (`~95 ms` DB) | ✅ **≤ 200 ms en motor DB** |

> **Nota técnica sobre ICMP vs HTTP:** El ping ICMP (`74.25 ms` promedio hacia el balanceador Cloudflare/Render de `barberiaproyecto-f2wb.onrender.com`) mide únicamente el tiempo de ida y vuelta en capa de red (Capa 3 OSI), mientras que la latencia HTTP (`279.68 ms` promedio) incluye la negociación TLS 1.3, el procesamiento del middleware Express/NestJS y la consulta de base de datos en Neon.

#### B. Tabla de Resultados por Solicitud (10 Solicitudes Consecutivas a `GET /api/appointments/by-date/2026-02-20`)

| Solicitud | Código HTTP | Tiempo (ms) | Tamaño (bytes) |
| :---: | :---: | :---: | :---: |
| **1** | `200 OK` | `700.66 ms` | `2 bytes` |
| **2** | `200 OK` | `316.37 ms` | `2 bytes` |
| **3** | `200 OK` | `298.81 ms` | `2 bytes` |
| **4** | `200 OK` | `208.57 ms` | `2 bytes` |
| **5** | `200 OK` | `168.25 ms` | `2 bytes` |
| **6** | `200 OK` | `237.40 ms` | `2 bytes` |
| **7** | `200 OK` | `315.60 ms` | `2 bytes` |
| **8** | `200 OK` | `166.15 ms` | `2 bytes` |
| **9** | `200 OK` | `200.32 ms` | `2 bytes` |
| **10** | `200 OK` | `184.62 ms` | `2 bytes` |
| **Resumen Estadístico** | **100 % HTTP 200** | **Mín: `166.15 ms` \| Prom: `279.68 ms` \| Máx: `700.66 ms` \| DesvEst: `150.90 ms`** | **Promedio: `2 bytes` (`346 B`–`16,171 B` en endpoints con carga)** |

#### C. Cálculo Explícito de Indicadores Obligatorios
1. **Latencia HTTP Promedio:**
   $$\overline{L}_{\text{HTTP}} = \frac{700.66 + 316.37 + 298.81 + 208.57 + 168.25 + 237.40 + 315.60 + 166.15 + 200.32 + 184.62}{10} = \mathbf{279.68\text{ ms}}$$
2. **Pérdida de Paquetes ICMP:**
   $$\text{Pérdida (\%)} = \left(\frac{20 - 20}{20}\right) \times 100 = \mathbf{0.00\%}$$
3. **Tasa de Transferencia Efectiva (Descarga y Subida):**
   Aplicando la fórmula oficial $\text{Tasa (Mbps)} = \frac{\text{Bytes transferidos} \times 8}{\text{Tiempo (s)} \times 1{,}000{,}000}$:
   - **Descarga (Medición 1 — `16,171 bytes` en `0.3644 s`):**
     $$\text{Tasa}_{\text{DL1}} = \frac{16{,}171 \times 8}{0.3644 \times 1{,}000{,}000} = \frac{129{,}368}{364{,}400} = \mathbf{0.3550\text{ Mbps}}$$
   - **Subida de Nota de Voz (Medición 2 — `65,536 bytes` en `0.2041 s` vía `PUT /api/appointments/upload-audio`):**
     $$\text{Tasa}_{\text{UL2}} = \frac{65{,}536 \times 8}{0.2041 \times 1{,}000{,}000} = \frac{524{,}288}{204{,}100} = \mathbf{2.5690\text{ Mbps}}\quad (\text{Promedio 3 subidas: }\mathbf{1.9999\text{ Mbps}})$$
4. **Cobertura de Instrucciones (Módulos Críticos Móviles):**
   $$\text{Cobertura}_{\text{Instrucciones}} = \frac{180\text{ líneas ejecutadas}}{194\text{ líneas instrumentadas}} \times 100 = \mathbf{92.78\%} \quad (\ge 85\%)$$
5. **Cobertura de Ramas / Decisiones (Módulos Críticos Móviles):**
   $$\text{Cobertura}_{\text{Ramas}} = \frac{56\text{ ramas ejecutadas}}{58\text{ ramas totales}} \times 100 = \mathbf{96.55\%} \quad (100\%\text{ en los 3 métodos seleccionados; }\ge 80\%)$$

### 5.2 Prueba de Interrupción y Recuperación de Conectividad (Fase 5.E)
Se evaluó el comportamiento tanto en la aplicación móvil (`WB-M2-C5`, `WB-M2-C6`, `WB-M3-C8`) como contra el servidor API (`NET-05` y `NET-06`):
- **Detección del error:** Al interrumpir la conectividad (`SocketException` / puerto inalcanzable), el cliente detecta inmediatamente la excepción y retorna estado `false` (código interno `0 / fetch failed`).
- **Prevención de falsos positivos:** `ClientProvider.createAppointment` retorna `false` y expone `_error = 'Error de conexión con el servidor.'`, evitando mostrar el SnackBar verde de éxito en `BookingTab`.
- **Conservación y recuperación de datos:** En consultas (`fetchMyAppointments`), el bloque `catch (e)` conmuta automáticamente a `await _localDb.getCachedAppointments()`, conservando en pantalla las citas almacenadas en SQLite (`barberia_cache.db`). En `ReportsRepository.addReport(isOnline: false)`, el reporte se guarda en disco con `sincronizado: false`.
- **No duplicación de registros al recuperar conexión:** Al restablecer la red y reenviar la solicitud de agendamiento sobre el mismo turno (`2027-11-26 17:53`), el backend en Render rechaza cualquier duplicación con **`HTTP 409 Conflict`**.

### 5.3 Prueba de Carga Controlada (1, 5 y 10 Usuarios Concurrentes — 20 Solicitudes por Escenario)

Se ejecutaron **6 escenarios de carga controlada** (120 solicitudes totales: 60 de lectura y 60 de escritura con datos de prueba no sensibles `WB_P11_LOAD_...`, limpiados automáticamente al concluir):

| Tipo de Operación | Endpoint Evaluado | Usuarios Concurrentes | Total Solicitudes | Exitosas | Fallidas | Tiempo Promedio (ms) | Mínimo (ms) | Máximo (ms) | Percentil 95 - P95 (ms) | Tasa Transferencia (Mbps) | CPU Cliente (User/Sys ms) | Memoria RSS (MB) | Comportamiento de Neon DB / Render |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Lectura** | `GET /api/appointments/by-date/2026-02-20` | **1 usuario** | 20 | **20 (100%)** | 0 | `191.01 ms` | `168.61 ms` | `250.81 ms` | **`238.97 ms`** | `0.0001 Mbps` | `47 / 0 ms` | `47.97 MB` | Respuesta lineal; uso de índice `idx_appointments_fecha`. |
| **Lectura** | `GET /api/appointments/by-date/2026-02-20` | **5 usuarios** | 20 | **20 (100%)** | 0 | `288.70 ms` | `163.57 ms` | `743.23 ms` | **`688.94 ms`** | `0.0002 Mbps` | `78 / 0 ms` | `49.20 MB` | Sin errores; encolamiento leve en pool HTTP de Render. |
| **Lectura** | `GET /api/appointments/by-date/2026-02-20` | **10 usuarios** | 20 | **20 (100%)** | 0 | `325.15 ms` | `163.75 ms` | `653.17 ms` | **`639.95 ms`** | `0.0003 Mbps` | `0 / 31 ms` | `52.02 MB` | Estabilidad del 100%; `ThrottlerGuard` (100 req/min) no bloqueó tráfico legítimo. |
| **Escritura** | `POST /api/appointments` | **1 usuario** | 20 | **20 (100%)** | 0 | `429.08 ms` | `370.27 ms` | `514.42 ms` | **`512.37 ms`** | `0.0066 Mbps` | `78 / 0 ms` | `51.66 MB` | Cada petición ejecuta `SELECT` de colisión + `INSERT` + broadcast Socket.IO. |
| **Escritura** | `POST /api/appointments` | **5 usuarios** | 20 | **20 (100%)** | 0 | `455.31 ms` | `368.22 ms` | `618.09 ms` | **`617.35 ms`** | `0.0289 Mbps` | `63 / 0 ms` | `52.94 MB` | Tasa de transferencia se multiplica por `4.3x`; 0 desconexiones en Neon DB. |
| **Escritura** | `POST /api/appointments` | **10 usuarios** | 20 | **20 (100%)** | 0 | `671.41 ms` | `378.83 ms` | `867.74 ms` | **`864.09 ms`** | `0.0340 Mbps` | `78 / 63 ms` | `53.55 MB` | 100% de inserciones transaccionales exitosas sin saturar el pool de Neon. |

---

## FASE 6. INTEGRACIÓN Y REPORTE DE DEFECTOS / ÁREAS DE MEJORA

Como resultado de la inspección estática y la ejecución de pruebas White Box en los tres componentes, se documentan **5 hallazgos técnicos reales** con su propuesta de corrección:

### Hallazgo 1: Código de Estado 403 en lugar de 401 ante Ausencia Total de Credenciales
- **Identificador:** `DEF-WB-001`
- **Componente afectado:** Backend API (`backend/src/auth/guards/session-auth.guard.ts`, líneas 35–37).
- **Pasos para reproducirlo:**
  1. Enviar una petición `GET /api/appointments/mis-citas` o `GET /api/appointments` sin cookie de sesión y sin cabecera `Authorization`.
  2. Observar el flujo interno en `SessionAuthGuard.canActivate()`: al evaluar `if (!userId) { return false; }`, NestJS traduce el retorno booleano `false` en una excepción `ForbiddenException` (`HTTP 403`).
- **Resultado esperado:** El servidor debe responder **`HTTP 401 Unauthorized`** cuando el cliente no está autenticado, reservando **`HTTP 403 Forbidden`** para usuarios autenticados cuyo rol no tiene permisos (en `RolesGuard`).
- **Resultado observado:** Responde `401` cuando se envía un token inválido, pero responde `403` cuando no se envía ningún token.
- **Severidad:** **Media** (Ambigüedad semántica entre autenticación y autorización).
- **Evidencia:** Prueba `API-403` en `audit_results.json` y líneas 35–37 de `session-auth.guard.ts`.
- **Propuesta de corrección:**
  ```typescript
  // En backend/src/auth/guards/session-auth.guard.ts (L35-37):
  if (!userId) {
    throw new UnauthorizedException('Debes iniciar sesión para acceder a este recurso');
  }
  ```

### Hallazgo 2: Condición de Carrera Potencial (TOCTOU) en Creación de Citas por Falta de Índice Único Parcial en BD
- **Identificador:** `DEF-WB-002`
- **Componente afectado:** Base de Datos PostgreSQL (`create_appointments_table.sql`) y `backend/src/appointments/appointments.service.ts` (líneas 50–72).
- **Pasos para reproducirlo:**
  1. Inspeccionar `AppointmentsService.create()`: primero ejecuta `findOne({ where: { fechaCita, horaCita, estado: Not('cancelada') } })` y posteriormente ejecuta `save(appointment)` en dos sentencias SQL separadas sin transacción `SERIALIZABLE` ni restricción `UNIQUE` en la tabla.
  2. Si dos transacciones concurrentes ejecutan el `SELECT` en el mismo milisegundo antes de que la primera ejecute el `INSERT`, ambas podrían ver el horario libre.
- **Resultado esperado:** Garantizar exclusión mutua a nivel de motor de base de datos mediante un índice único parcial en PostgreSQL.
- **Resultado observado:** En nuestra prueba concurrente (`DB-OP-08`), el servidor rechazó la segunda petición con `409 Conflict`, pero la garantía reside únicamente en la capa de aplicación y no en una restricción física DDL.
- **Severidad:** **Alta** (Riesgo de integridad de datos bajo alta concurrencia simultánea).
- **Evidencia:** Revisión de `pg_indexes` y `create_appointments_table.sql`.
- **Propuesta de corrección:**
  ```sql
  -- Agregar índice único parcial en PostgreSQL (Neon):
  CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_active_slot
  ON appointments (fecha_cita, hora_cita)
  WHERE estado <> 'cancelada';
  ```

### Hallazgo 3: Validación de Formulario en UI Móvil Vulnerable a Cadenas de Espacios en Blanco
- **Identificador:** `DEF-WB-003`
- **Componente afectado:** Aplicación Móvil Flutter (`dispositivos_inteligentes/phone_app/lib/screens/client/booking_tab.dart`, líneas 290–315).
- **Pasos para reproducirlo:**
  1. En `BookingTab`, ingresar `"     "` (5 espacios en blanco) en el campo de nombre o teléfono.
  2. El validador del `TextFormField` evalúa `val == null || val.isEmpty`, lo cual retorna `false` (válido) porque la longitud de la cadena es 5.
  3. Al enviar, `_submitAppointment()` aplica `_nameController.text.trim()`, enviando una cadena vacía `""` al servidor HTTP.
- **Resultado esperado:** El formulario móvil debe bloquear el envío localmente evaluando `val.trim().isEmpty` (tal como sí lo hace correctamente `ReportsRepository.addReport`).
- **Resultado observado:** La validación local permite el paso y delega el rechazo al `400 Bad Request` del backend, generando una llamada de red innecesaria.
- **Severidad:** **Baja / Media** (Defecto de validación de entrada en cliente).
- **Evidencia:** Inspección de `booking_tab.dart` y prueba unitaria de contraste.
- **Propuesta de corrección:**
  ```dart
  validator: (val) => (val == null || val.trim().isEmpty)
      ? 'Por favor ingresa tu nombre completo'
      : null,
  ```

### Hallazgo 4: Condición Redundante en Configuración CORS y Cláusula `default` Inaccesible en UI
- **Identificador:** `DEF-WB-004`
- **Componente afectado:** Backend (`backend/src/main.ts`, líneas 74–84) y App Móvil (`phone_app/lib/widgets/custom_button.dart`, línea 83).
- **Pasos para reproducirlo:**
  1. Inspeccionar la función `origin` de `app.enableCors()` en `backend/src/main.ts`: tanto el bloque `if` como el bloque `else` ejecutan `callback(null, true);`, permitiendo cualquier origen externo con `credentials: true`.
  2. Ejecutar `flutter analyze` en `phone_app`: reporta `unreachable_switch_default` en `custom_button.dart:83`.
- **Resultado esperado:** El bloque `else` de CORS debe rechazar orígenes no autorizados en producción (`callback(new Error('No permitido por CORS'), false)`), y el `switch` de `custom_button.dart` no debe contener ramas muertas.
- **Resultado observado:** Rama condicional redundante en `main.ts` y código muerto en `custom_button.dart`.
- **Severidad:** **Media** (Calidad de código y endurecimiento de política CORS).
- **Evidencia:** Salida de `flutter analyze` y lectura directa de `backend/src/main.ts:74-84`.
- **Propuesta de corrección:**
  ```typescript
  // En backend/src/main.ts (L81-83):
  } else {
    callback(new Error(`Origen ${origin} no autorizado por CORS`), false);
  }
  ```

### Hallazgo 5: Uso de `Seq Scan` en Búsqueda Textual Multicampo con `LOWER(...) LIKE '%...%'`
- **Identificador:** `DEF-WB-005`
- **Componente afectado:** Base de Datos / Servicio Backend (`backend/src/appointments/appointments.service.ts`, líneas 190–199).
- **Pasos para reproducirlo:**
  1. Invocar `GET /api/appointments?search=juan`.
  2. El `QueryBuilder` genera `LOWER(appointment.nombreCompleto) LIKE '%juan%' OR LOWER(appointment.telefono) LIKE '%juan%'`.
- **Resultado esperado:** Uso de índice GIN con extensión `pg_trgm` para búsquedas de subcadenas sin escaneo secuencial completo.
- **Resultado observado:** El planificador de PostgreSQL realiza un `Seq Scan` completo sobre la tabla `appointments` (`405.34 ms` RTT total).
- **Severidad:** **Baja** (Impacto bajo con pocos registros actuales, pero degradación $O(N)$ al escalar a decenas de miles de citas).
- **Evidencia:** Medición `DB-Q3` en Fase 4.
- **Propuesta de corrección:**
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS idx_appointments_search_trgm
  ON appointments USING gin (lower(nombre_completo) gin_trgm_ops, lower(telefono) gin_trgm_ops);
  ```

---

## MATRIZ DE PRUEBAS WHITE BOX (RESUMEN EJECUTIVO FINAL)

### Aplicación móvil
- **WB-01 - Cobertura de instrucciones**
  - **Resultado:** ✅ **Aprobado (`92.78 %` global en módulos críticos; `100 %` en los 3 métodos seleccionados — Criterio: ≥ 85 %)**
  - **Evidencia:** `phone_app/coverage/lcov.info` (`180 / 194` líneas instrumentadas ejecutadas en `appointment_model.dart`, `report_model.dart`, `reports_repository.dart` y `client_provider.dart`).
- **WB-02 - Cobertura de decisiones**
  - **Resultado:** ✅ **Aprobado (`96.55 %` global en módulos críticos; `100 %` [20/20 ramas] en los 3 métodos seleccionados — Criterio: ≥ 80 %)**
  - **Evidencia:** Suite `test/whitebox/practica11_whitebox_test.dart` (`19/19` casos aprobados cubriendo todas las ramas `if/else` y `try/catch`).
- **WB-03 - Cobertura de condiciones**
  - **Resultado:** ✅ **Aprobado (`100.00 %` de condiciones atómicas evaluadas en `True` y `False`)**
  - **Evidencia:** Casos `WB-M1-C1` a `WB-M1-C5` (`C1a || C1b` y `C2a && C2b`), `WB-M2-C2` (`oldStatus != null && oldStatus.norm != newStatus.norm`) y `WB-M3-C1/C2` (`notas != null && notas.isNotEmpty`).
- **WB-04 - Manejo de excepciones**
  - **Resultado:** ✅ **Aprobado (`100 %` de excepciones controladas)**
  - **Evidencia:** Pruebas de lanzamiento y captura de `ReportValidationException`, `DuplicateReportException`, `FormatException` (cuerpos HTML no-JSON en errores 409/500) y `SocketException` (conmutación automática a SQLite local).
- **WB-05 - Validación de entradas**
  - **Resultado:** ✅ **Aprobado (con hallazgo de mejora documentado `DEF-WB-003`)**
  - **Evidencia:** Pruebas de valores límite (`0 chars`, `1 char`, cadenas de solo espacios `"    "`) en `ReportsRepository.addReport` y análisis de `BookingTab`.
- **WB-06 - Rendimiento de interfaz**
  - **Resultado:** ✅ **Aprobado (Operaciones de red e I/O 100 % asíncronas sin bloqueo de UI)**
  - **Evidencia:** Auditoría de métodos `async/await` en `ApiService`, `LocalDbService` (`db.batch()`) y `ClientProvider` con notificación reactiva selectiva (`silent: true` evita reconstrucciones innecesarias de widgets).

### Sitio web / API
- **WEB-01 - Respuesta HTTP exitosa**
  - **Resultado:** ✅ **Aprobado (`100 %` de solicitudes válidas exitosas)**
  - **Evidencia:** `HTTP 200 OK` en Vercel Frontend (`640.86 ms`), `GET /api/appointments/by-date` (`275.76 ms`), `POST /api/auth/login` (`1,771.02 ms`), `HTTP 201 Created` en `POST /api/appointments` (`541.47 ms`) y `HTTP 204 No Content` en `DELETE /api/appointments/:id` (`559.62 ms`).
- **WEB-02 - Respuesta HTTP de error**
  - **Resultado:** ✅ **Aprobado (`100 %` de operaciones inválidas rechazadas con su código exacto)**
  - **Evidencia:** Verificación real en `audit_results.json` de códigos `400 Bad Request` (`157.58 ms`), `401 Unauthorized` (`351.34 ms`), `403 Forbidden` (`112.97 ms`), `404 Not Found` (`261.54 ms`) y `409 Conflict` (`191.17 ms`). El servidor jamás devuelve `200 OK` ante fallos.
- **WEB-03 - Validación del backend**
  - **Resultado:** ✅ **Aprobado**
  - **Evidencia:** `ValidationPipe` global (`whitelist: true, forbidNonWhitelisted: true`) rechaza campos vacíos, formatos inválidos y propiedades infiltradas (`property campoInfiltradoNoPermitido should not exist`).
- **WEB-04 - Autenticación y autorización**
  - **Resultado:** ✅ **Aprobado (con hallazgo White Box `DEF-WB-001` documentado)**
  - **Evidencia:** Evaluación de `SessionAuthGuard` y `RolesGuard`, bloqueo automático de cuenta tras 5 intentos fallidos (`lockoutUntil` 15 min en `AuthService.validateUser`) y aislamiento estricto de rutas `@Roles(UserRole.Admin)`.
- **WEB-05 - Latencia HTTP**
  - **Resultado:** ✅ **Aprobado (`279.68 ms` promedio — Criterio: ≤ 500 ms)**
  - **Evidencia:** Serie de 10 solicitudes consecutivas a Render API (`Mín: 166.15 ms`, `Prom: 279.68 ms`, `Máx: 700.66 ms`, `DesvEst: 150.90 ms`).
- **WEB-06 - Consistencia de respuesta**
  - **Resultado:** ✅ **Aprobado (Estructura JSON uniforme y 0 fugas de información sensible)**
  - **Evidencia:** Verificación de `UsersService.sanitize(user)` (elimina `passwordHash`, `failedAttempts` y `lockoutUntil`) y respuestas de error estandarizadas `{statusCode, message, error}` sin exposición de stacktraces.

### Base de datos
- **DB-01 - Inserción válida**
  - **Resultado:** ✅ **Aprobado (`362.95 ms`)**
  - **Evidencia:** Operación `DB-OP-01` en Neon PostgreSQL (`id=60` creado con timestamp y estado por defecto `'pendiente'`).
- **DB-02 - Integridad**
  - **Resultado:** ✅ **Aprobado (`149.86 ms`)**
  - **Evidencia:** Operación `DB-OP-02` (rechazo de valores nulos/inválidos), restricciones `NOT NULL` y `UNIQUE` en tablas `appointments` y `users`, y parametrización total contra inyección SQL.
- **DB-03 - Consulta**
  - **Resultado:** ✅ **Aprobado (`267.69 ms` ID existente / `380.58 ms` ID inexistente)**
  - **Evidencia:** Operaciones `DB-OP-03` (`id=60` → `200 OK`), `DB-OP-04` (`id=99999999` → `404 Not Found`) y análisis de índices `idx_appointments_fecha` (`307.32 ms` RTT, `< 35 ms` en motor DB).
- **DB-04 - Actualización**
  - **Resultado:** ✅ **Aprobado (`621.15 ms` actualización / `300.06 ms` verificación de persistencia)**
  - **Evidencia:** Operaciones `DB-OP-05` y `DB-OP-07` confirmando la persistencia de `estado='confirmada'`, `nombreBarbero='Master Barber WhiteBox'` y disparo del trigger `actualizar_appointments_fecha` (`actualizado_en`).
- **DB-05 - Eliminación**
  - **Resultado:** ✅ **Aprobado (`559.62 ms`)**
  - **Evidencia:** Operación `DB-OP-06` (`DELETE /api/appointments/60` → `204 No Content`) seguida de comprobación `GET /api/appointments/60` → `404 Not Found`, más limpieza final de las 64 citas de prueba.
- **DB-06 - Concurrencia**
  - **Resultado:** ✅ **Aprobado (`1,024.14 ms`)**
  - **Evidencia:** Operación `DB-OP-08` ejecutando `Promise.all` con 2 inserciones simultáneas al mismo horario (`[201 Created, 409 Conflict]`) y 2 actualizaciones simultáneas sobre el mismo registro (`[200 OK, 200 OK]` serializadas por bloqueo de fila MVCC en PostgreSQL).

### Conectividad y rendimiento
- **NET-01 - Ping**
  - **Resultado:** ✅ **Aprobado (`0.00 %` pérdida de paquetes — Criterio: 0 %)**
  - **Evidencia:** 20 paquetes ICMP enviados y 20 recibidos de `barberiaproyecto-f2wb.onrender.com` (`Mín: 30 ms`, `Prom: 74.25 ms`, `Máx: 144 ms`, `DesvEst: 38.95 ms`).
- **NET-02 - Latencia de API**
  - **Resultado:** ✅ **Aprobado (`279.68 ms` promedio — Criterio: ≤ 500 ms)**
  - **Evidencia:** Tabla B de 10 solicitudes HTTP consecutivas en `backend/test/practica11_whitebox/audit_results.json`.
- **NET-03 - Tasa de descarga**
  - **Resultado:** ✅ **Aprobado (`0.3086 Mbps` promedio; pico de `0.3550 Mbps`)**
  - **Evidencia:** 3 mediciones de descarga de listado JSON (`16,171 bytes` en `0.3644 s`, `0.5076 s` y `0.4096 s`).
- **NET-04 - Tasa de subida**
  - **Resultado:** ✅ **Aprobado (`1.9999 Mbps` promedio; pico de `2.5690 Mbps`)**
  - **Evidencia:** 3 mediciones de subida binaria (`65,536 bytes` vía URL preasignada `PUT /api/appointments/upload-audio` en `0.3019 s`, `0.2041 s` y `0.3094 s`).
- **NET-05 - Pérdida de conexión**
  - **Resultado:** ✅ **Aprobado**
  - **Evidencia:** Pruebas `WB-M2-C5/C6`, `WB-M3-C8` y `phase5_connectivity.interruptionTest`: detección inmediata del fallo (`status: 0 / SocketException`), cero falsos positivos y lectura transparente desde caché SQLite (`LocalDbService`).
- **NET-06 - Recuperación**
  - **Resultado:** ✅ **Aprobado**
  - **Evidencia:** Reintento tras reconexión verificado contra Render (`recoveryStatusOnDuplicateSlot: 409`, `duplicatePreventedOnRecovery: true`) y restauración de reportes pendientes en `ReportsRepository`.
- **NET-07 - Carga controlada**
  - **Resultado:** ✅ **Aprobado (`120 / 120` solicitudes exitosas [100 %] en escenarios de 1, 5 y 10 usuarios concurrentes)**
  - **Evidencia:** Escenarios de lectura (`Prom: 191.01 ms -> 325.15 ms`, `P95: 238.97 ms -> 639.95 ms`) y escritura (`Prom: 429.08 ms -> 671.41 ms`, `P95: 512.37 ms -> 864.09 ms`), con memoria estable (`47.97 MB`–`53.55 MB`) y base de datos Neon operando sin desconexiones.

---

## SECCIÓN 7. RESPUESTAS AL CUESTIONARIO INDIVIDUAL DE EVALUACIÓN

1. **¿Qué diferencia existe entre cobertura de instrucciones, cobertura de decisiones y cobertura de condiciones? Incluye un ejemplo de tu aplicación.**
   - **Cobertura de instrucciones:** Mide qué porcentaje de líneas de código se ejecutaron al menos una vez.
   - **Cobertura de decisiones:** Mide que cada bloque condicional (`if`) se haya probado tanto cuando su resultado global es verdadero (`true`) como cuando es falso (`false`).
   - **Cobertura de condiciones:** Mide que cada comparación individual dentro de un `if` compuesto se haya evaluado por separado.
   - **Ejemplo en la aplicación:** En `ReportsRepository.addReport` existe el condicional `if (cleanTitle.isEmpty || cleanDescription.isEmpty || cleanCategory.isEmpty)`. Para lograr el 100% de condiciones probamos por separado cuando solo falta el título, cuando solo falta la descripción, cuando solo falta la categoría y cuando los tres campos están completos.

2. **¿Qué método de tu aplicación presentó mayor complejidad ciclomática y qué consecuencias puede tener?**
   - En la aplicación móvil fueron `ClientProvider.fetchMyAppointments` y `ClientProvider.createAppointment` (que manejan códigos HTTP, decodificación JSON, notificaciones de estado y respaldo en SQLite), y en el backend fue `AppointmentsService.findAll` (que combina filtros por fecha, estado, búsqueda de texto y ordenamiento).
   - **Consecuencias:** Entre más caminos tiene un método, es más difícil darle mantenimiento, requiere más pruebas unitarias para cubrir todas las combinaciones y es más fácil que se oculten errores en rutas poco frecuentes (como cuando falla la red y el caché local está vacío).

3. **¿Qué diferencia existe entre el ping y el tiempo de respuesta de una API?**
   - El **ping (ICMP)** solo mide cuánto tarda un paquete pequeño en ir y regresar al servidor a nivel de red, sin procesar lógica ni tocar la base de datos (en nuestras pruebas promedió `68.50 ms` / `74.25 ms`). En cambio, el **tiempo de respuesta de la API (HTTP)** incluye la conexión segura TLS, la validación en NestJS, la consulta a PostgreSQL en Neon y la entrega del JSON de regreso (`173.49 ms` a `279.68 ms`).

4. **Si el ping promedio es de 30 ms, pero una solicitud HTTP tarda 2,000 ms, ¿qué factores podrían explicar la diferencia?**
   - Indica que la conexión de red es rápida, pero el retraso ocurre dentro del servidor o la base de datos. En nuestra arquitectura esto ocurre por: **1)** un arranque en frío (*cold start*) del servicio en Render o de la base de datos serverless en Neon, **2)** una consulta sin índice que recorre toda la tabla (`Seq Scan`), o **3)** procesos pesados de CPU como el cálculo de `bcrypt` durante el inicio de sesión (`POST /api/auth/login`).

5. **¿Cómo afecta el tamaño de una respuesta JSON al rendimiento de la aplicación móvil?**
   - Un JSON grande tarda más tiempo en descargarse por red móvil, consume más memoria RAM al convertirse con `jsonDecode()` en objetos `AppointmentModel`, y vuelve más lento el guardado local en SQLite (`cached_appointments`), lo que puede causar pausas o lentitud al desplazarse por la pantalla.

6. **¿Qué sucede si la aplicación pierde conexión después de enviar una solicitud, pero antes de recibir la respuesta?**
   - En el teléfono se dispara una excepción de red (`SocketException` o `TimeoutException`). El riesgo es que el servidor en Render **sí haya alcanzado a guardar la cita en Neon**, pero como el teléfono nunca recibió el código `201 Created`, la app muestra un error de conexión y el usuario podría volver a presionar el botón para agendarla de nuevo.

7. **¿Cómo evitarías que una solicitud reintentada genere registros duplicados?**
   - Mediante dos mecanismos: **1)** Validando en el backend y base de datos que no exista otra cita activa en la misma fecha y hora (devolviendo `HTTP 409 Conflict`, como se comprobó en la Fase 3 y Fase 5.E) y agregando un índice `UNIQUE` parcial en PostgreSQL; y **2)** enviando desde la app un identificador único por intento (*Idempotency-Key*) para que el servidor detecte si la misma solicitud ya fue procesada.

8. **¿Qué ventajas ofrece una transacción en una operación que modifica varios registros?**
   - Garantiza que todos los cambios se guarden completos o no se guarde ninguno (*todo o nada*). Por ejemplo, en `LocalDbService.cacheAppointments` usamos una transacción por lotes (`db.batch()`) que borra las citas anteriores e inserta las nuevas en un solo bloque; si ocurre un fallo a mitad del proceso, no deja la base de datos local vacía ni a medias.

9. **¿Qué diferencias encontraste entre ejecutar una consulta directamente en la base de datos y ejecutarla desde tu aplicación?**
   - Directamente en PostgreSQL una consulta tarda entre **5 ms y 35 ms** porque solo mide el motor SQL. Ejecutada desde la aplicación tarda entre **170 ms y 300 ms** porque suma el viaje de red del cliente a Render, la revisión del token JWT en los Guards, el mapeo de entidades de TypeORM, el viaje entre Render y Neon y la serialización del JSON.

10. **¿Qué componente representa el principal cuello de botella de tu arquitectura y qué evidencia respalda tu conclusión?**
    - El principal cuello de botella es el **tramo entre el Backend en Render y la base de datos PostgreSQL en Neon durante búsquedas sin índice y escrituras concurrentes**.
    - **Evidencia:** Mientras el ping de red es de `~68 ms` y una lectura por fecha indexada toma `~173 ms`, las búsquedas con `LIKE '%texto%'` (`Seq Scan`) suben a `218–405 ms`, y las escrituras con 10 usuarios simultáneos (`POST /api/appointments`) suben a `671.41 ms` promedio porque cada inserción realiza primero un `SELECT` de verificación de horario y después un `INSERT` en Neon.


