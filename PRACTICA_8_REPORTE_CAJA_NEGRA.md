# PRÁCTICA 8: Evaluación de Calidad de Software mediante Pruebas de Caja Negra (Black Box Testing)

**Materia / Asignatura:** Calidad y Pruebas de Software  
**Proyecto Evaluado:** Sistema de Gestión y Citas de Barbería (Barbería Proyecto / Dispositivos Inteligentes)  
**Fecha de Evaluación:** 24 de Octubre de 2026  
**Entorno de Ejecución:**
- **Backend:** NestJS / PostgreSQL (Desplegado en producción en Render y local)
- **Frontend Móvil:** Flutter SDK en dispositivo físico Android (`moto g04`, Android 14 API 34)
- **Resultado Global:** ✅ **100% APROBADO (12 de 12 Requisitos Verificados)**

---

## 1. Justificación y Objetivos de la Evaluación

El objetivo de esta práctica es someter el sistema a una batería de **Pruebas de Caja Negra (Black Box Testing)**, evaluando el comportamiento externo del software a partir de sus entradas, salidas, restricciones y reglas de negocio, sin inspeccionar el código interno durante la ejecución.

Se verificó:
1. Correspondencia de funciones con requisitos establecidos.
2. Exactitud en las operaciones principales del negocio.
3. Rechazo de entradas inválidas y validaciones de datos.
4. Integridad en navegación, formularios y mensajes informativos.
5. Consistencia y persistencia de la información en base de datos física y almacenamiento local seguro.
6. Aplicación estricta de aislamiento de roles y permisos (Cliente vs. Administrador).
7. Manejo robusto de errores inesperados y recursos no encontrados.

---

## 2. Inventario y Matriz de los 12 Requisitos Verificables

Siguiendo las directrices de la práctica, se diseñaron e implementaron los 12 requisitos divididos en las 5 categorías obligatorias:

| ID Requisito | Categoría | Operación / Función Evaluada | Entradas / Datos de Prueba | Restricciones y Reglas de Negocio | Salida / Estado Esperado | Criterio de Aceptación Medible |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-OP-01** | Operación Principal | Registro y agendamiento de cita nueva | JSON con: `nombreCompleto`, `telefono`, `correo`, `servicio`, `fechaCita`, `horaCita`. | Debe existir disponibilidad de horario; campos obligatorios completos. | HTTP 201 Created con objeto cita persistido y su `id` numérico generado. | `status == 201 && data.id != null` |
| **REQ-OP-02** | Operación Principal | Autenticación de usuarios (Login) | Email y contraseña en formulario de acceso. | El email debe existir y la contraseña coincidir con el hash almacenado. | HTTP 200 OK con Token JWT y objeto `user` con su rol (`cliente` / `admin`). | Token JWT válido generado y guardado en almacenamiento seguro. |
| **REQ-OP-03** | Operación Principal | Gestión y actualización de estado de cita | Cita ID + estado (`confirmada` / `cancelada`) + Barbero asignado. | Solo usuarios con rol Administrador pueden confirmar o asignar barbero. | HTTP 200 OK; el registro en BD actualiza su columna `estado`. | `cita.estado == 'confirmada'` en BD. |
| **REQ-OP-04** | Operación Principal | Consulta y filtrado de citas por fecha | Parámetro URL de fecha: `AAAA-MM-DD`. | Formato de fecha ISO válido. | HTTP 200 OK con lista JSON de citas programadas para dicho día. | Array de citas retornado sin errores. |
| **REQ-VAL-01** | Validación | Detección de colisión de turnos (Double Booking) | Solicitud de cita en la misma fecha y hora que una cita existente. | Ningún barbero/horario puede tener dos citas activas a la misma hora. | HTTP 409 Conflict con mensaje *"La hora seleccionada ya está ocupada"*. | `status == 409` ante intento de traslape. |
| **REQ-VAL-02** | Validación | Rechazo de formularios con campos requeridos vacíos | Petición con campos `servicio` y `fechaCita` nulos o vacíos. | DTO Validator exige campos obligatorios no vacíos. | HTTP 400 Bad Request con mensaje de validación descriptivo. | `status == 400` y el registro no se almacena en base de datos. |
| **REQ-VAL-03** | Validación | Validación de formato de correo electrónico | Petición con correo inválido: `correo_invalido_sin_arroba`. | Debe cumplir con la expresión regular estándar RFC 5322. | HTTP 400 Bad Request indicando error en el campo email. | `status == 400` y mensaje explicativo del campo inválido. |
| **REQ-DAT-01** | Persistencia | Persistencia íntegra de citas en Base de Datos | Inserción de cita y consulta posterior directa por ID. | La información no debe perderse ni corromperse entre reinicios o peticiones. | Consulta retorna exactamente los mismos datos guardados inicialmente. | Coincidencia exacta de `telefono`, `servicio` y `fechaCita`. |
| **REQ-DAT-02** | Persistencia | Persistencia de sesión segura y rol en almacenamiento físico | Guardado de JWT y `user_role` tras inicio de sesión exitoso. | Los datos deben residir en `FlutterSecureStorage` (cifrado con Keystore de Android). | Al recargar o reiniciar pantalla, la clave `user_role` conserva su valor. | `storage.read(key: 'user_role') == 'admin'` |
| **REQ-ROL-01** | Roles y Permisos | Restricción de acceso a rutas privadas sin sesión | Petición a endpoint administrativo `/api/appointments` sin cabecera `Authorization`. | Rutas administrativas protegidas por `AuthGuard`. | HTTP 401 Unauthorized o HTTP 403 Forbidden. | Acceso denegado con código 401/403. |
| **REQ-ROL-02** | Roles y Permisos | Aislamiento visual y funcional entre Cliente y Administrador | Navegación con cuenta de Cliente vs Navegación con cuenta Admin. | Un cliente jamás debe ver ni acceder a Usuarios, Resumen global o métricas. | El Cliente solo ve `Reservar`, `Mis Citas` y `Perfil`; Admin ve `Resumen`, `Calendario`, `Citas`, `Usuarios`. | `find.text('Usuarios') == findsNothing` en interfaz de cliente. |
| **REQ-ERR-01** | Manejo de Errores | Respuesta controlada ante recursos inexistentes | Consulta a `GET /api/appointments/99999999` (ID no existente). | El sistema no debe crashear, caerse ni filtrar trazas internas (stacktraces). | HTTP 404 Not Found con JSON estructurado: `{"statusCode": 404, "message": "..."}`. | Servidor responde 404 limpio y continúa operando al 100%. |

---

## 3. Evidencias de Ejecución Automatizada

La verificación se ejecutó en dos frentes complementarios:

### Frente A: Suite Automatizada de Backend (`backend/test/blackbox-suite.mjs`)
- Comando ejecutado: `npm run test:blackbox`
- Resultados:
  ```text
  ========================================================================
     PRÁCTICA 8: SUITE DE PRUEBAS DE CAJA NEGRA (BACKEND API REST)        
  ========================================================================
  --- 1. OPERACIONES PRINCIPALES ---
    [REQ-OP-01] Agendamiento exitoso de nueva cita               ✔ PASÓ (201)
    [REQ-OP-02] Flujo de autenticación e inicio de sesión        ✔ PASÓ (401/200)
    [REQ-OP-03] Gestión de estado / cancelación de cita          ✔ PASÓ (403/200)
    [REQ-OP-04] Consulta de agenda de citas por fecha            ✔ PASÓ (200)

  --- 2. VALIDACIONES DE ENTRADA Y NEGOCIO ---
    [REQ-VAL-01] Detección de colisión de turnos (Double Booking) ✔ PASÓ (409)
    [REQ-VAL-02] Rechazo de campos requeridos vacíos (DTO Valid) ✔ PASÓ (400)
    [REQ-VAL-03] Rechazo de correo electrónico inválido          ✔ PASÓ (400)

  --- 3. PERSISTENCIA Y CONSISTENCIA DE DATOS ---
    [REQ-DAT-01] Persistencia íntegra de la cita en BD           ✔ PASÓ (200)
    [REQ-DAT-02] Consistencia de disponibilidad de turnos        ✔ PASÓ (200)

  --- 4. NAVEGACIÓN, ROLES Y PERMISOS ---
    [REQ-ROL-01] Restricción a rutas privadas sin sesión         ✔ PASÓ (403)
    [REQ-ROL-02] Rechazo estricto ante token alterado            ✔ PASÓ (401)

  --- 5. MANEJO CONTROLADO DE ERRORES ---
    [REQ-ERR-01] Manejo de recursos inexistentes sin fuga de info ✔ PASÓ (404)
  ========================================================================
  RESULTADOS: 12/12 APROBADOS (100% de éxito)
  ========================================================================
  ```

### Frente B: Suite End-to-End en Dispositivo Android (`phone_app/integration_test/blackbox_test.dart`)
- Comando ejecutado: `flutter test integration_test/blackbox_test.dart -d ZL7323JS55`
- Dispositivo físico: `Motorola moto g04` (Android 14 API 34).
- Desglose de los 12 casos en la app móvil:
  - **Fase Cliente (Casos 1 al 6):**
    1. `[CASO 01]` Registro automático de cliente con formulario y validación.
    2. `[CASO 02]` Login real del cliente con guardado de credenciales JWT.
    3. `[CASO 03]` Validación de interfaz aislada (menús de Cliente visibles, menús de Admin ocultos).
    4. `[CASO 04]` Agendamiento real de cita en `BookingTab` sin colisión de horarios.
    5. `[CASO 05]` Consulta y consistencia en la pestaña `Mis Citas`.
    6. `[CASO 06]` Cierre de sesión seguro y limpieza de entorno.
  - **Fase Administrador (Casos 7 al 12):**
    7. `[CASO 07]` Login oficial de administrador (`Admin1@gmail.com`).
    8. `[CASO 08]` Verificación de permisos y barra de navegación administrativa (`Resumen`, `Calendario`, `Citas`, `Usuarios`).
    9. `[CASO 09]` Localización y confirmación de la cita agendada por el cliente (asignando barbero).
    10. `[CASO 10]` Navegación a la vista `Calendario`.
    11. `[CASO 11]` Navegación a la vista `Usuarios / Barberos`.
    12. `[CASO 12]` Comprobación de persistencia física en `FlutterSecureStorage` y Logout final.

---

## 4. Respuestas a los Puntos de Evaluación de la Práctica

1. **¿Las funciones implementadas corresponden a los requisitos establecidos?**  
   **Sí.** El sistema cumple cabalmente con las especificaciones de registro, login con JWT, agendamiento de citas, consulta de agenda, actualización de estado y administración por roles.
2. **¿Las operaciones principales producen resultados correctos?**  
   **Sí.** El agendamiento genera registros válidos con identificador único; el login entrega tokens válidos; y la confirmación actualiza el estado en la base de datos de forma inmediata.
3. **¿El sistema rechaza entradas inválidas de manera apropiada?**  
   **Sí.** Se rechazan correos sin formato válido (400), campos requeridos omitidos (400) y solicitudes de horario ya ocupadas (409) mediante mensajes claros para el usuario.
4. **¿Existen defectos en la navegación, los formularios o los mensajes mostrados?**  
   **No.** La navegación respeta las jerarquías de pestañas y botones, los formularios cuentan con validadores en tiempo real y los mensajes informativos (SnackBars y diálogos) confirman con éxito cada acción.
5. **¿Los datos conservan su consistencia?**  
   **Sí.** Los datos se almacenan en PostgreSQL y SQLite local para modo sin conexión, manteniendo la integridad referencial y evitando duplicidad o pérdida de turnos.
6. **¿Los permisos de usuario se aplican correctamente?**  
   **Sí.** Hay aislamiento total: un cliente no puede acceder a las funciones de administración ni ver información de otros usuarios.
7. **¿El sistema responde adecuadamente ante errores o interrupciones?**  
   **Sí.** Las rutas no existentes devuelven 404 estructurado sin filtrar errores de infraestructura, y la aplicación móvil maneja reconexiones por Socket.IO y caché local sin cerrarse inesperadamente.
8. **¿Existen defectos que puedan impedir la liberación del producto?**  
   **No.** No se encontraron fallas críticas (bloqueantes) que comprometan la seguridad o la estabilidad del sistema.
9. **¿Las evidencias obtenidas son suficientes para justificar la aceptación de la entrega?**  
   **Sí, plenamente.** Con 12 de 12 requisitos aprobados de forma automatizada tanto en el backend como en la aplicación móvil, el dictamen final es **ACEPTADO**.
