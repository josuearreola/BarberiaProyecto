#  Sistema de Agendamiento - Barbería

##  Configuración Completa

### Backend (NestJS + PostgreSQL)

**Dependencias instaladas:**
- TypeORM + PostgreSQL
- Class Validator + Class Transformer
- Config Module

**Estructura creada:**
```
backend/
├── .env                          # Variables de entorno
├── src/
│   ├── appointments/
│   │   ├── entities/
│   │   │   └── appointment.entity.ts
│   │   ├── dto/
│   │   │   └── create-appointment.dto.ts
│   │   ├── appointments.service.ts
│   │   ├── appointments.controller.ts
│   │   └── appointments.module.ts
│   ├── app.module.ts             # Configurado con TypeORM
│   └── main.ts                   # CORS habilitado
```

### Frontend (Angular)

**Servicios creados:**
```
frontend/src/app/
├── services/
│   └── appointment.service.ts    # Servicio API
├── environments/
│   ├── environment.ts            # Dev config
│   └── environment.prod.ts       # Prod config
└── components/booking/
    ├── booking.ts                # Componente actualizado
    ├── booking.html              # Con mensajes
    └── booking.css               # Estilos mejorados
```

##  Pasos para ejecutar

### 1. Base de Datos (Neon)

Ejecuta el script SQL en tu base de datos Neon:
```sql
-- Archivo: create_appointments_table.sql
-- Ya contiene todo lo necesario
```

Conéctate a tu consola de Neon y ejecuta el script completo.

### 2. Backend

```powershell
# En la carpeta backend
cd backend

# Ya instalado, solo ejecutar:
pnpm run start:dev
```

El backend estará corriendo en: **http://localhost:3000/api**

### 3. Frontend

```powershell
# En la carpeta frontend
cd frontend

# Ejecutar en modo desarrollo
ng serve
# o
pnpm start
```

El frontend estará corriendo en: **http://localhost:4200**

## 🔌 API Endpoints

**Base URL:** `http://localhost:3000/api`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/appointments` | Crear nueva cita |
| GET | `/appointments` | Obtener todas las citas |
| GET | `/appointments/:id` | Obtener cita por ID |
| GET | `/appointments/fecha/:fecha` | Obtener citas por fecha |
| PATCH | `/appointments/:id/estado` | Actualizar estado de cita |
| DELETE | `/appointments/:id` | Eliminar cita |

### Ejemplo de petición POST:

```json
{
  "nombreCompleto": "Juan Pérez",
  "telefono": "+52 442 123 4567",
  "correo": "juan@email.com",
  "servicio": "Corte Clásico",
  "fechaCita": "2026-02-20",
  "horaCita": "10:00 AM",
  "notas": "Notas adicionales (opcional)"
}
```

##  Estructura de la Base de Datos

**Tabla:** `appointments`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | SERIAL | ID auto-incremental |
| nombre_completo | VARCHAR(100) | Nombre del cliente |
| telefono | VARCHAR(20) | Teléfono de contacto |
| correo | VARCHAR(100) | Email (opcional) |
| servicio | VARCHAR(50) | Servicio seleccionado |
| fecha_cita | DATE | Fecha de la cita |
| hora_cita | VARCHAR(10) | Hora de la cita |
| estado | VARCHAR(20) | pendiente/confirmado/cancelado |
| notas | TEXT | Notas adicionales |
| creado_en | TIMESTAMP | Fecha de creación |
| actualizado_en | TIMESTAMP | Última actualización |

## Flujo de Datos

```
Cliente (Frontend)
    ↓
Formulario de Booking
    ↓
AppointmentService (HTTP)
    ↓
Backend API (NestJS)
    ↓
AppointmentsController
    ↓
AppointmentsService
    ↓
TypeORM Repository
    ↓
Base de Datos Neon (PostgreSQL)
```

##  Características

**Backend:**
- Validación de datos con class-validator
- Conexión segura a Neon con SSL
- CORS configurado para el frontend
- Logging de consultas SQL
- Manejo de errores robusto

 **Frontend:**
- Validación en tiempo real
- Mensajes de éxito/error
- Spinner durante el envío
- Integración completa con HttpClient
- Diseño responsive

 **Base de Datos:**
- Índices optimizados
- Triggers automáticos
- Timestamps automáticos
- Estructura en español

##  Variables de Entorno

**Backend (.env):**
```env
DATABASE_URL=postgresql://neondb_owner:npg_4auOzSyD9wfb@ep-purple-cherry-ai3hmtu3.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
PORT=3000
FRONTEND_URL=http://localhost:4200
```

**Frontend (environment.ts):**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api'
};
```

## 🧪 Probar la Conexión

### Opción 1: Desde el formulario
1. Abre http://localhost:4200
2. Navega a la sección "Agendar Cita"
3. Llena el formulario
4. Haz clic en "Confirmar Reserva"

### Opción 2: Con cURL
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "nombreCompleto": "Juan Pérez",
    "telefono": "+52 442 123 4567",
    "servicio": "Corte Clásico",
    "fechaCita": "2026-02-20",
    "horaCita": "10:00 AM"
  }'
```

### Opción 3: Con Thunder Client o Postman
Importa la siguiente colección y prueba los endpoints.

## 📊 Verificar los Datos

Conéctate a tu base de datos Neon y ejecuta:
```sql
SELECT * FROM appointments ORDER BY creado_en DESC;
```

## 🎉 ¡Todo Listo!

Tu sistema está completamente configurado y listo para recibir agendamientos. Los datos fluyen desde el formulario hasta la base de datos Neon sin problemas.

**Stack Completo:**
-  Frontend: Angular 19
-  Backend: NestJS
-  Base de Datos: PostgreSQL (Neon)
-  API: RESTful
-  Validaciones: class-validator
-  ORM: TypeORM