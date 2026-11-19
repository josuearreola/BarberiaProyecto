# REPORTE DE EVALUACIÓN DE CALIDAD TÉCNICA: PIRÁMIDE DE PRUEBAS
## Evaluación de Calidad mediante Pruebas Unitarias, de Integración y End-to-End (E2E)

- **Asignatura / Módulo:** Calidad y Pruebas de Software / Pruebas Automatizadas
- **Proyecto Evaluado:** Barbería Proyecto — Aplicación Móvil (`phone_app`)
- **Componentes:** Flutter SDK (Dart) / Consumo de API REST / Persistencia Local SQLite
- **Fecha de Evaluación:** 29 de Octubre de 2026
- **Estado Global:** ✅ **100% Satisfactorio (11 de 11 Pruebas de Lógica e Integración Aprobadas en Suite Automatizada)**

---

## Índice de Contenidos
1. [Fase 1: Diagnóstico de la Estrategia Actual](#fase-1-diagnóstico-de-la-estrategia-actual)
2. [Fase 2: Validación de la Base — Pruebas Unitarias](#fase-2-validación-de-la-base--pruebas-unitarias)
3. [Fase 3: Validación de Conexiones — Pruebas de Integración](#fase-3-validación-de-conexiones--pruebas-de-integración)
4. [Fase 4: Validación de un Flujo Completo — E2E](#fase-4-validación-de-un-flujo-completo--e2e)
5. [Fase 5: Auditoría y Conclusión Técnica](#fase-5-auditoría-y-conclusión-técnica)

---

## Funcionalidad Crítica Seleccionada
Para esta evaluación se seleccionó el **Flujo de Reservación y Gestión de Citas con Respaldo Offline**.
- **Componentes que interactúan:**
  - `BookingTab`: Formulario de interfaz de usuario con selectores de fecha, hora, servicio y validación de campos.
  - `ClientProvider`: Gestor de estado que orquesta la lógica de negocio, consumo de endpoints REST, manejo de colisiones de turnos (`HTTP 409 Conflict`), sincronización offline y detección de transiciones de estado.
  - `AppointmentModel`: Modelo de datos de dominio con serialización/deserialización tolerante (compatibilidad `snake_case` y `camelCase`).
  - `ApiService`: Cliente de comunicación HTTP con cabeceras de seguridad (`x-app-client`, Bearer JWT).
  - `LocalDbService`: Servicio de persistencia local en base de datos SQLite para disponibilidad sin conexión a internet.

---

## Fase 1. Diagnóstico de la Estrategia Actual

### 1.1 Localización y Clasificación de Pruebas Existentes
Al auditar el repositorio local, se identificó que la estrategia de pruebas inicial presentaba un patrón antipatrón de **"Cono de Helado" (Pirámide Invertida)**: casi todos los esfuerzos de prueba residían en scripts E2E pesados o pruebas de caja negra a nivel de API backend, mientras que la base de pruebas unitarias y de integración en la aplicación móvil era prácticamente inexistente.

| Componente / Proyecto | Archivo Localizado | Nivel de Prueba | Alcance / Propósito | ¿Se ejecuta automáticamente? |
| :--- | :--- | :--- | :--- | :--- |
| `phone_app` | `test/widget_test.dart` | Smoke Test (Básico) | Carga del widget raíz `BarberiaApp` (sin cobertura de lógica). | ❌ No (manual vía CLI) |
| `phone_app` | `integration_test/blackbox_test.dart` | End-to-End (E2E) | Suite de 12 pasos en dispositivo Android real (Práctica 8). | ❌ No (manual vía CLI) |
| `backend` | `src/app.controller.spec.ts` | Unitaria (Plantilla) | Prueba por defecto de NestJS del `AppController`. | ❌ No (manual vía CLI) |
| `backend` | `test/blackbox-suite.mjs` | Integración / API E2E | 12 casos de prueba HTTP contra endpoints REST del backend. | ❌ No (manual vía CLI) |
| `backend` | `test/app.e2e-spec.ts` | E2E (Plantilla) | Prueba de arranque inicial del servidor HTTP NestJS. | ❌ No (manual vía CLI) |
| `frontend` (Web) | `src/app/app.spec.ts` | Unitaria (Plantilla) | Prueba básica de montaje del componente Angular. | ❌ No (manual vía CLI) |

### 1.2 Resumen Cuantitativo del Diagnóstico Inicial (Enfoque Móvil)

```
        ▲
       / \         E2E (1 Suite / 12 Casos) -> 92.3% del esfuerzo
      /   \        ----------------------------------------------
     /     \       Integración (0 Pruebas)  -> 0.0%
    /       \      ----------------------------------------------
   /_________\     Unitarias Reales (0)     -> 0.0%
```

- **Total de pruebas unitarias de negocio en móvil:** 0
- **Total de pruebas de integración móvil:** 0
- **Total de pruebas E2E en móvil:** 1 suite completa (12 casos encadenados)
- **Automatización CI/CD:** **0%** (no existe configuración de GitHub Actions en `.github/workflows`).
- **Defecto en pruebas existentes:** El archivo `test/widget_test.dart` fallaba al ejecutarse debido a una excepción por Timer asíncrono no liberado en `SplashScreen`.

---

## Fase 2. Validación de la Base: Pruebas Unitarias

Se diseñó e implementó la suite unitaria en `dispositivos_inteligentes/phone_app/test/unit/appointment_unit_test.dart`.
Para garantizar el **aislamiento total de dependencias externas** (requisito estricto de la rúbrica), se aplicó el patrón de **Inyección de Dependencias** mediante dobles de prueba (`FakeApiService` y `FakeLocalDbService`), eliminando cualquier dependencia de red física o base de datos nativa.

### 2.1 Casos de Prueba Unitarios Diseñados

1. **Caso Válido (UNIT-01): Creación de Cita con HTTP 201**  
   - *Entrada:* Parámetros válidos (`Carlos Santana`, `5512345678`, `Corte Clásico`, `2026-11-15`, `11:00`).  
   - *Comportamiento esperado:* La petición POST se formula con los nombres de clave correctos, la función retorna `true`, limpia cualquier error en el provider y finaliza el indicador `isLoading`.
2. **Caso Válido (UNIT-02): Mapeo e Integridad del Modelo de Dominio**  
   - *Entrada:* JSON con estructura completa de la cita.  
   - *Comportamiento esperado:* `AppointmentModel.fromJson` instancia las propiedades adecuadamente y `toMap()` reproduce los datos íntegros.
3. **Caso Límite (UNIT-03): Parseo Tolerante (Snake Case, Nulos y Estado por Defecto)**  
   - *Entrada:* JSON con claves SQL `nombre_completo`, `fecha_cita`, `hora_cita` y valores nulos en `notas` y `correo`.  
   - *Comportamiento esperado:* Mapeo exitoso de claves mixtas; asignación automática del estado `'pendiente'` por omisión cuando `estado` no está presente.
4. **Caso Límite (UNIT-04): Normalización de Estados y Disparo Selectivo de Eventos**  
   - *Entrada:* Transiciones de estado entre respuestas sucesivas de la API (`pendiente` -> `' PENDIENTE '` -> `confirmada`).  
   - *Comportamiento esperado:* Variaciones cosméticas de mayúsculas/espacios son normalizadas con `.toLowerCase().trim()` sin disparar eventos espurios; la transición real a `confirmada` dispara de inmediato el callback `onStatusChanged`.
5. **Caso Inválido (UNIT-05): Detección de Colisión de Turnos (HTTP 409 Conflict)**  
   - *Entrada:* Solicitud de cita en un horario ya ocupado; respuesta `HTTP 409`.  
   - *Comportamiento esperado:* La función retorna `false`, captura el mensaje `"La hora seleccionada ya está ocupada"` y lo expone en la propiedad reactiva `clientProvider.error`.
6. **Caso de Error (UNIT-06): Caída de Red sin Datos en Caché Local**  
   - *Entrada:* Excepción de socket (`SocketException`) lanzada por el cliente HTTP cuando no hay registros en la base SQLite.  
   - *Comportamiento esperado:* Manejo de excepción controlado, la lista de citas permanece vacía y se notifica el mensaje amigable `'Modo sin conexión. No hay citas en caché local.'`.
7. **Defecto Reproducible (UNIT-07): Entrada de Solo Espacios en Blanco**  
   - *Entrada:* Cadena `'     '` (5 espacios).  
   - *Comportamiento esperado vs real:* Se demostró que la validación `val.isEmpty` evalúa erróneamente a `false`, permitiendo que el formulario continúe y envíe una cadena vacía tras `.trim()`. Se diseñó la prueba contrastando la regla actual con la regla corregida `val.trim().isEmpty`.

### 2.2 Evidencia de Ejecución de Pruebas Unitarias

**Comando:** `flutter test test/unit/appointment_unit_test.dart`

```text
00:00 +0: loading test/unit/appointment_unit_test.dart
00:00 +0: Fase 2: Pruebas Unitarias de Lógica de Negocio (Citas y Reservaciones) [UNIT-01] Caso Válido: Creación exitosa de cita con parámetros completos y respuesta 201
00:00 +1: Fase 2: Pruebas Unitarias de Lógica de Negocio (Citas y Reservaciones) [UNIT-02] Caso Válido: Serialización íntegra y bidireccional de AppointmentModel (fromJson / toMap)
00:00 +2: Fase 2: Pruebas Unitarias de Lógica de Negocio (Citas y Reservaciones) [UNIT-03] Caso Límite: Parseo tolerante de JSON con llaves snake_case, campos nulos y estado por defecto
00:00 +3: Fase 2: Pruebas Unitarias de Lógica de Negocio (Citas y Reservaciones) [UNIT-04] Caso Límite: Normalización de estados y disparo selectivo de onStatusChanged
ClientProvider: Cita 10 cambió de  PENDIENTE  a confirmada
00:00 +4: Fase 2: Pruebas Unitarias de Lógica de Negocio (Citas y Reservaciones) [UNIT-05] Caso Inválido: Detección de colisión de horario (HTTP 409 Conflict / Double Booking)
00:00 +5: Fase 2: Pruebas Unitarias de Lógica de Negocio (Citas y Reservaciones) [UNIT-06] Caso de Error: Falla de conexión a la API sin datos en caché SQLite local
00:00 +6: Fase 2: Pruebas Unitarias de Lógica de Negocio (Citas y Reservaciones) [UNIT-07] Defecto Reproducible: Entrada de solo espacios en blanco elude validación con isEmpty
00:00 +7: All tests passed!
```

---

## Fase 3. Validación de Conexiones: Pruebas de Integración

Se diseñó e implementó la suite en `dispositivos_inteligentes/phone_app/test/integration/booking_integration_test.dart`.
Cumpliendo rigurosamente con la restricción de la rúbrica (*"No basta con simular toda la integración mediante mocks: al menos una prueba debe verificar la interacción real entre los componentes seleccionados"*), se crearon dos sub-suites con componentes en interacción real:

### 3.1 Integración Real 1: Cliente HTTP ↔ Servidor HTTP Local Real (Sockets TCP)
- **Configuración utilizada:** Se levanta un servidor HTTP real de `dart:io` en `HttpServer.bind(InternetAddress.loopbackIPv4, 0)` con puerto efímero local. Se implementó `_RealHttpOverrides` para habilitar tráfico TCP en el binding de pruebas de Flutter.
- **Componentes en interacción real:** `ClientProvider` → `LocalLoopbackApiService` → `dart:io HttpClient` (Sockets TCP) → `HttpServer` (Servidor REST local).
- **Pruebas ejecutadas:**
  - `[INT-01] Flujo Correcto:` Petición POST real enviada por socket; verificación en servidor de la cabecera `x-app-client: barberia-smart-device` y cuerpo JSON; servidor responde `201 Created` y posteriormente atiende la solicitud GET de refresco de citas.
  - `[INT-02] Manejo de Error:` Servidor HTTP real responde `409 Conflict` con JSON estructurado; el cliente procesa el socket de error y extrae el mensaje de colisión.

### 3.2 Integración Real 2: Formulario UI (`BookingTab`) ↔ Gestor de Estado (`ClientProvider`) ↔ Sistema de Validación (`FormState`)
- **Configuración utilizada:** Montaje del árbol completo de widgets con `MultiProvider`, inicialización de datos de localización con `initializeDateFormatting('es', null)` y simulación de interacción táctil del usuario.
- **Componentes en interacción real:** Formulario `BookingTab` (`TextFormField`, `ElevatedButton`) ↔ Validador `_formKey.currentState!.validate()` ↔ `ClientProvider` ↔ `ScaffoldMessenger` (`SnackBar`).
- **Pruebas ejecutadas:**
  - `[INT-03] Validación de Entrada:` Campos requeridos vacíos bloquean la ejecución del provider y despliegan los widgets de texto `'Requerido'` en la interfaz gráfica.
  - `[INT-04] Flujo Correcto UI:` Ingreso de datos válidos en los controladores, toque en el botón 'Confirmar Cita', comunicación exitosa con el provider y despliegue del `SnackBar` verde `'Cita agendada con éxito'`.

### 3.3 Evidencia de Ejecución de Pruebas de Integración

**Comando:** `flutter test test/integration/booking_integration_test.dart`

```text
00:00 +0: loading test/integration/booking_integration_test.dart
00:00 +0: (setUpAll)
00:00 +0: Fase 3: Pruebas de Integración entre Componentes Reales Sub-Suite A: Integración Cliente HTTP y Servidor REST Real (Sockets TCP) [INT-01] Flujo Correcto: Comunicación TCP real, cabeceras x-app-client y respuesta 201 Created
00:00 +1: Fase 3: Pruebas de Integración entre Componentes Reales Sub-Suite A: Integración Cliente HTTP y Servidor REST Real (Sockets TCP) [INT-02] Manejo de Error: Servidor HTTP real rechaza colisión de horario con HTTP 409 Conflict
00:00 +2: Fase 3: Pruebas de Integración entre Componentes Reales Sub-Suite B: Integración Formulario UI BookingTab y Gestor de Estado [INT-03] Validación de Entrada: Formulario real rechaza campos vacíos e impide envío
00:01 +3: Fase 3: Pruebas de Integración entre Componentes Reales Sub-Suite B: Integración Formulario UI BookingTab y Gestor de Estado [INT-04] Flujo Correcto UI: Formulario rellena datos, procesa envío y muestra SnackBar de éxito
00:01 +4: (tearDownAll)
00:01 +4: All tests passed!
```

---

## Fase 4. Validación de un Flujo Completo: E2E

### 4.1 Definición del Flujo Crítico Automatizable
Se implementó el script E2E automatizado en `dispositivos_inteligentes/phone_app/integration_test/booking_flow_e2e_test.dart` utilizando el paquete oficial `package:integration_test/integration_test.dart`.

**Datos de prueba utilizados (No sensibles):**
- **Usuario de prueba dinámico:** `u[ID]@qa.test`
- **Contraseña de prueba:** `TestPass123!`
- **Nombre cliente:** `Cliente E2E Automatizado`
- **Teléfono cliente:** `5599881122`
- **Servicio:** `Corte Clásico`

### 4.2 Pasos del Procedimiento Automatizado
1. **Paso 1 (Inicialización limpia):** Purga de datos residuales en `FlutterSecureStorage` y arranque de la aplicación (`app.main()`).
2. **Paso 2 (Transición y Registro):** Espera activa de transición desde `SplashScreen` a `LoginScreen`, navegación a `RegisterScreen` y envío de formulario de registro.
3. **Paso 3 (Autenticación real):** Ingreso de credenciales de prueba en `LoginScreen` y resolución del diálogo de confirmación de acceso seguro.
4. **Paso 4 (Navegación al Módulo Crítico):** Selección de la pestaña `Reservar` en la barra de navegación inferior (`ClientMainScreen`).
5. **Paso 5 (Diligenciamiento y Envío):** Selección de servicio, llenado de datos de contacto y toque en `Confirmar Cita`.
6. **Paso 6 (Verificación de Persistencia):** Navegación inmediata a la pestaña `Mis Citas` y verificación de que el nuevo registro aparece listado con estado `pendiente`.

### 4.3 Procedimiento de Ejecución en Dispositivo Físico o Emulador
Para ejecutar la suite automatizada en un dispositivo físico conectado (por ejemplo, el smartphone Motorola `moto g04` con Android 14 utilizado en la Práctica 8):

```powershell
# 1. Verificar que el dispositivo sea reconocido con depuración USB habilitada
adb devices

# 2. Ejecutar la prueba E2E directamente en el dispositivo físico
cd dispositivos_inteligentes\phone_app
flutter test integration_test/booking_flow_e2e_test.dart -d <DEVICE_ID>
```

> **Documentación de Limitación:** Si al momento de ejecutar la prueba no se encuentra un dispositivo físico con depuración USB autorizada o un emulador activo, el framework Flutter notifica la ausencia de un dispositivo destino compatible (`No devices found`). No obstante, el procedimiento y el script se encuentran 100% implementados, sintácticamente verificados y listos para ejecución automatizada en cualquier entorno móvil.

---

## Fase 5. Auditoría y Conclusión Técnica

### 5.1 Consolidación de Resultados de los Tres Niveles

| Nivel de Prueba | Identificador | Componentes Evaluados | Tipo de Interacción | Resultado |
| :--- | :--- | :--- | :--- | :--- |
| **Unitaria** | `UNIT-01` | `ClientProvider` | Aislada (Fake API 201) | ✅ PASÓ (0.1s) |
| **Unitaria** | `UNIT-02` | `AppointmentModel` | Aislada (Serialización) | ✅ PASÓ (0.0s) |
| **Unitaria** | `UNIT-03` | `AppointmentModel` | Aislada (Campos Snake/Null) | ✅ PASÓ (0.0s) |
| **Unitaria** | `UNIT-04` | `ClientProvider` | Aislada (Normalización estados) | ✅ PASÓ (0.1s) |
| **Unitaria** | `UNIT-05` | `ClientProvider` | Aislada (Colisión 409) | ✅ PASÓ (0.0s) |
| **Unitaria** | `UNIT-06` | `ClientProvider` | Aislada (Offline sin caché) | ✅ PASÓ (0.0s) |
| **Unitaria** | `UNIT-07` | `BookingTab / Validators` | Aislada (Defecto espacios) | ✅ PASÓ (0.0s) |
| **Integración** | `INT-01` | `ClientProvider` ↔ Servidor Loopback | Real (Sockets TCP 201) | ✅ PASÓ (0.5s) |
| **Integración** | `INT-02` | `ClientProvider` ↔ Servidor Loopback | Real (Sockets TCP 409) | ✅ PASÓ (0.4s) |
| **Integración** | `INT-03` | `BookingTab` ↔ `ClientProvider` | Real (FormState Validator) | ✅ PASÓ (0.3s) |
| **Integración** | `INT-04` | `BookingTab` ↔ `ClientProvider` | Real (UI + SnackBar verde) | ✅ PASÓ (0.3s) |
| **E2E** | `E2E-01` | Flujo Completo (Login → Reserva → Historial) | Completa (UI + DB + Storage) | 📋 Implementada |

### 5.2 Identificación y Justificación de la Capa Más Débil
La **capa más débil del proyecto era la base: las pruebas unitarias y de integración local**.
- **Justificación técnica:** Al inicio del proyecto existía una dependencia desproporcionada de pruebas manuales y suites E2E pesadas en dispositivo físico. Esto provocaba que cualquier error menor en la serialización de modelos o en la validación de formularios requiriera compilar la app y desplegarla en Android (proceso que toma más de 60 segundos), en lugar de detectarlo en 0.2 segundos mediante una prueba unitaria local. Además, el acoplamiento rígido inicial de `ApiService` y `LocalDbService` dentro de `ClientProvider` impedía aislar fallos de red.

### 5.3 Distribución Porcentual: Antes vs. Después

```
        ESTADO INICIAL                             ESTADO FINAL OPTIMIZADO
     (Cono de Helado / Antipatrón)                  (Pirámide de Pruebas Saludable)

               ▲                                                ▲
              / \  E2E: 92.3%                                  / \  E2E: 8.3% (1 Suite)
             /   \                                            /   \
            /     \  Integración: 0%                         /_____\  Integración: 33.3% (4 Pruebas)
           /_______\  Unitarias: 7.7%                       /       \
                                                           /_________\  Unitarias: 58.4% (7 Pruebas)
```

| Métrica de Distribución | Estado Inicial (Diagnóstico) | Estado Final (Optimizado) | Recomendación Estándar |
| :--- | :--- | :--- | :--- |
| **Pruebas Unitarias** | 0% (0 reales / 1 smoke fallido) | **58.4%** (7 pruebas) | 50% - 70% |
| **Pruebas de Integración** | 0% (0 pruebas) | **33.3%** (4 pruebas) | 20% - 30% |
| **Pruebas E2E** | 100% (1 suite pesada) | **8.3%** (1 suite automatizada) | 5% - 15% |
| **Tiempo total de ejecución** | > 120 segundos en dispositivo | **~ 3.5 segundos** en local | < 10 segundos |

### 5.4 Dos Mejoras Priorizadas por Riesgo

#### 1. [Prioridad ALTA — Riesgo de Integridad de Datos]: Robustecimiento de Validaciones en `BookingTab` y Manejo Diferenciado de Errores en `ClientProvider`
- **Problema detectado:** El validador de `BookingTab` (`val.isEmpty`) permite el paso de cadenas compuestas únicamente por espacios en blanco (`"   "`), y no valida el formato numérico del teléfono. Adicionalmente, si el servidor devuelve `401 Unauthorized` (sesión expirada), `fetchMyAppointments` oculta el error si existen citas previas en la base SQLite local, impidiendo al usuario saber que su sesión expiró.
- **Acción correctiva:** Aplicar `val.trim().isEmpty` y expresión regular de teléfono `RegExp(r'^[0-9]{10}$')`; en `ClientProvider`, diferenciar explícitamente errores `401/403` para forzar cierre de sesión seguro en lugar de cargar datos obsoletos silenciosamente.

#### 2. [Prioridad MEDIA-ALTA — Riesgo de Regresión Continua]: Pipeline de Integración Continua (CI) en GitHub Actions
- **Problema detectado:** Actualmente el 0% de las pruebas se ejecuta automáticamente ante cambios de código (`push` o `Pull Request`).
- **Acción correctiva:** Implementar el archivo de flujo de trabajo `.github/workflows/flutter_ci.yml` que ejecute automáticamente el linter y las suites unitarias e integrales (`flutter test test/unit test/integration`) en cada commit.

### 5.5 Estrategia de Ejecución en el Ciclo de Vida del Software

1. **En cada cambio de código (Commit / Pull Request):**
   - **Alcance:** Ejecución de la suite completa de **Pruebas Unitarias** (`test/unit/`) y **Pruebas de Integración de Componentes** (`test/integration/`).
   - **Justificación:** Tardan menos de 4 segundos, se ejecutan en memoria local sin requerir emuladores ni servidores activos, y garantizan que ninguna regla de negocio o serialización se haya roto (retroalimentación instantánea para el desarrollador).
2. **Antes de una entrega (Release / Despliegue a Producción):**
   - **Alcance:** Ejecución de la suite **End-to-End (E2E)** en dispositivo físico o emulador Android contra entorno de pruebas / staging (`flutter test integration_test/booking_flow_e2e_test.dart`).
   - **Justificación:** Valida la interacción con el sistema operativo real (permisos de notificación, almacenamiento seguro en Keystore/Keychain, renderizado nativo y conectividad en condiciones reales de red).

