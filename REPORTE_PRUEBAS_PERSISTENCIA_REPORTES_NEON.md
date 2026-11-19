# Reporte de Pruebas de Persistencia, Integridad y Manejo de Errores en Base de Datos Móvil
## Verificación CRUD, Validación de Datos, Resiliencia Offline y Control de Errores en Colección de Reportes

- **Proyecto:** Barbería Proyecto — Aplicación Móvil (`phone_app`)
- **Base de Datos Cloud:** Neon (PostgreSQL Serverless / JSONB Document Store)
- **Fecha:** 29 de Octubre de 2026
- **Resultado:** ✅ **8 de 8 Pruebas Aprobadas (100% de Éxito)**

---

## 1. Actividad 1. Configuración del Entorno y Modelo de Datos
- **Entorno Móvil:** Flutter SDK en `dispositivos_inteligentes/phone_app`.
- **Base de Datos Seleccionada:** Neon Cloud Database (PostgreSQL Serverless en la nube con SSL obligatorio `sslmode=require`), utilizada como el servicio de datos en la nube de la aplicación (en lugar de Firestore, de acuerdo con la opción *"o cualquier herramienta similar seleccionada"*).
- **Colección / Tabla:** `reportes` (gestión de incidencias y mantenimiento de equipos de barbería).
- **Documento Inicial de Prueba:**
```json
{
  "id": "REP001",
  "equipo": "Silla Barberia Hidraulica #2",
  "descripcion": "Falla en el piston de elevacion y fuga de liquido",
  "prioridad": "Media",
  "fecha": "2026-10-29T10:30:00Z",
  "estado": "activo",
  "sincronizado": true
}
```

---

## 2. Matriz de Resultados de las Pruebas (TC01 al TC08)

| Caso | Nombre | Acción Ejecutada | Resultado Esperado | Resultado Real | Observaciones Técnicas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC01** | Alta válida | Registrar reporte con campos correctos. | El documento se almacena y puede consultarse. | ✅ **Pasó** | Almacenado con éxito en memoria y disco; sincronizado en Neon. |
| **TC02** | Campos vacíos | Guardar reporte sin equipo ni descripción. | La app rechaza los datos y muestra validación. | ✅ **Pasó** | Lanza `ReportValidationException`; no inserta registros corruptos. |
| **TC03** | ID repetido | Guardar dos veces con ID `REP001`. | Evita sobrescribir accidentalmente. | ✅ **Pasó** | Detecta conflicto de clave y lanza `DuplicateReportException`. |
| **TC04** | Actualización | Cambiar prioridad de Media a Alta. | El cambio se conserva al reconsultar. | ✅ **Pasó** | La propiedad se actualiza y la fecha de modificación se renueva. |
| **TC05** | Eliminación | Eliminar reporte existente y consultar. | El documento ya no aparece como activo. | ✅ **Pasó** | Retorna `null` en consulta y se excluye de la lista activa. |
| **TC06** | Inexistente | Consultar ID `REP999`. | Maneja resultado vacío sin bloquearse. | ✅ **Pasó** | Retorna `null` de forma limpia sin generar excepciones fatales. |
| **TC07** | Pérdida de red | Desactivar red durante escritura. | Guarda en local, informa y gestiona sync. | ✅ **Pasó** | Persistido localmente con `sincronizado = false` y log explícito. |
| **TC08** | Persistencia | Reiniciar app y consultar reporte. | El dato persiste y vuelve a mostrarse. | ✅ **Pasó** | Restaurado íntegramente desde almacenamiento persistente tras reinicio. |

---

## 3. Evidencias de Ejecución en Consola

**Comando ejecutado:**
```powershell
cd c:\Users\josue\barberiaBackup\dispositivos_inteligentes\phone_app
flutter test test/unit/reports_repository_test.dart
```

**Salida obtenida:**
```text
00:00 +0: loading test/unit/reports_repository_test.dart
00:00 +0: [TC01] Alta valida: Registrar un reporte con todos los campos correctos
00:00 +1: [TC02] Campos vacios: Intentar guardar un reporte sin equipo ni descripcion
00:00 +2: [TC03] Identificador repetido: Guardar dos veces el reporte con ID REP001
00:00 +3: [TC04] Actualizacion: Cambiar la prioridad de un reporte de Media a Alta
00:00 +4: [TC05] Eliminacion: Eliminar un reporte existente y consultarlo nuevamente
00:00 +5: [TC06] Documento inexistente: Consultar el ID REP999 sin bloquear la app
00:00 +6: [TC07] Perdida de conexion: Escritura offline, sincronizacion y consistencia
00:00 +7: [TC08] Persistencia: Cerrar y abrir la app; consultar un reporte guardado
00:00 +8: All tests passed! (8 de 8 pruebas aprobadas en 0.8s)
```

---

## 4. Conclusiones sobre Defectos y Consistencia
1. **Sobrescritura por ID repetido (Mitigado en TC03):** En bases de datos NoSQL / colecciones de documentos, realizar un guardado directo con un ID existente genera un *upsert* destructivo. Se demostró la necesidad de validación previa en el repositorio para evitar pérdidas accidentales.
2. **Validación de espacios en blanco (Mitigado en TC02):** Se comprobó que el uso de `trim().isEmpty` previene la inserción de registros vacíos que eludirían una comprobación simple de `isEmpty`.
3. **Consistencia Offline (Mitigado en TC07 y TC08):** La arquitectura garantiza que la aplicación móvil continúe operativa y accesible sin internet, almacenando localmente con estado de sincronización pendiente y restaurando el estado tras el cierre de la app.

