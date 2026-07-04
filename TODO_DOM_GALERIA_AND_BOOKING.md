# TODO - Actividad DOM (Booking mini tabla)

## Objetivo
Convertir la sección de booking en una app 100% frontend con DOM dinámico:
- Crear/editar/eliminar citas desde la vista
- Mostrar una mini tabla/lista de citas creadas
- Actualizar el DOM sin modales

## Plan (pasos)
1. Revisar `frontend/src/app/components/booking/booking.html` y `booking.ts` (hecho).
2. Modificar `booking.html` para agregar una 3ra columna con una mini tabla:
   - contenedor con `id="client-appointments-grid"`
   - botones Editar/Eliminar por cada fila
3. Modificar `booking.ts`:
   - deshabilitar el llamado a backend en `onSubmit`
   - implementar almacenamiento en `localStorage` para citas
   - usar DOM real para renderizar/actualizar filas:
     - `document.createElement`
     - `appendChild`
     - `remove()`
     - actualizar texto con `textContent`
4. Asegurar modo edición:
   - al presionar Editar, llenar el formulario con la cita
   - cambiar botón de “Confirmar Reserva” a “Guardar Cambios”
5. Guardar/actualizar/Eliminar:
   - actualizar localStorage y re-render del grid.
6. Probar manualmente en el navegador:
   - Crear cita -> aparece en mini tabla
   - Editar -> cambia los valores en tabla y formulario
   - Eliminar -> desaparece de tabla


