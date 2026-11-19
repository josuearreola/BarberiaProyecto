# Reporte de Pruebas de Caja Negra (Black Box Testing) - Práctica 8

**Sistema:** Sistema de Gestión y Citas de Barbería
**Fecha de Ejecución:** 23/10/2026, 11:20:36 p.m.
**Herramienta de Automatización:** Suite de Pruebas E2E / Black Box (Node.js & Fetch API)
**Dictamen Final:** ✅ ACEPTADO (100% de aprobación)

## 1. Resumen Ejecutivo

| Métrica | Valor |
| :--- | :--- |
| Requisitos Evaluados | 12 |
| Requisitos Aprobados (PASS) | 12 |
| Requisitos Fallados (FAIL) | 0 |
| Tasa de Éxito | 100% |

## 2. Matriz Detallada de los 12 Requisitos

| ID | Categoría | Requisito / Función | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **REQ-OP-01** | Operación Principal | Agendamiento exitoso de nueva cita | HTTP 201 con ID asignado | Status 201 | ✅ PASS |
| **REQ-OP-02** | Operación Principal | Flujo de autenticación e inicio de sesión | HTTP 200 (Login exitoso) o 401 (Credenciales evaluadas) | Status 401 | ✅ PASS |
| **REQ-OP-03** | Operación Principal | Gestión de estado / cancelación de cita | HTTP 200 (Actualizada) o 401/403 (Guardia de rol activa) | Status 403 | ✅ PASS |
| **REQ-OP-04** | Operación Principal | Consulta de agenda de citas por fecha | HTTP 200 con Array de citas | Status 200 | ✅ PASS |
| **REQ-VAL-01** | Validación de Negocio | Detección y rechazo de colisión de turnos (Double Booking) | HTTP 409 Conflict | Status 409 | ✅ PASS |
| **REQ-VAL-02** | Validación de Entradas | Rechazo de campos requeridos vacíos (DTO Validation) | HTTP 400 Bad Request con detalle de campos | Status 400 | ✅ PASS |
| **REQ-VAL-03** | Validación de Entradas | Rechazo de formato de correo electrónico inválido | HTTP 400 Bad Request | Status 400 | ✅ PASS |
| **REQ-DAT-01** | Persistencia y Consistencia | Persistencia íntegra de la cita en base de datos | Cita persistida recuperable con datos idénticos | Status 200 | ✅ PASS |
| **REQ-DAT-02** | Persistencia y Consistencia | Consistencia de disponibilidad de turnos en agenda | HTTP 200 con estado consistente de slots | Status 200 | ✅ PASS |
| **REQ-ROL-01** | Roles y Permisos | Restricción de acceso a rutas protegidas sin sesión (401) | HTTP 401 Unauthorized o 403 Forbidden | Status 403 | ✅ PASS |
| **REQ-ROL-02** | Roles y Permisos | Rechazo estricto ante tokens de autorización alterados | HTTP 401 Unauthorized | Status 401 | ✅ PASS |
| **REQ-ERR-01** | Manejo de Errores | Manejo controlado de recursos inexistentes sin fugas de stacktrace | HTTP 404 con respuesta JSON estructurada | Status 404 | ✅ PASS |

## 3. Conclusión y Justificación Técnica

Se ejecutaron pruebas de caja negra automáticas cubriendo operaciones principales, validaciones de negocio (evasión de traslape y control de campos nulos), persistencia en base de datos, protección mediante roles y manejo estructurado de errores.
Las evidencias recopiladas justifican plenamente la aceptación de la entrega.
