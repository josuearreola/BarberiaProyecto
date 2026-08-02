# 💈 Sistema de Agendamiento - Barbería Premium

Sistema completo de agendamiento para barbería desarrollado con Angular, NestJS y PostgreSQL (Neon).

## 🚀 Tecnologías

### Frontend
- **Angular 19** - Framework web moderno
- **TypeScript** - Tipado estático
- **SCSS** - Estilos avanzados

### Backend
- **NestJS** - Framework Node.js progresivo
- **TypeORM** - ORM para TypeScript
- **PostgreSQL (Neon)** - Base de datos en la nube
- **Class Validator** - Validación de datos

## 📁 Estructura del Proyecto

```
web7mo/
├── backend/                 # API REST con NestJS
│   ├── src/
│   │   ├── appointments/   # Módulo de agendamientos
│   │   ├── app.module.ts   # Módulo principal
│   │   └── main.ts         # Punto de entrada
│   └── .env.example        # Variables de entorno ejemplo
├── frontend/               # Aplicación Angular
│   └── src/
│       ├── app/
│       │   ├── components/ # Componentes UI
│       │   └── services/   # Servicios HTTP
│       └── environments/   # Configuración de entornos
└── create_appointments_table.sql  # Script SQL

```

## Instalación y Configuración

### Prerrequisitos
- Node.js 18+
- pnpm (recomendado) o npm
- PostgreSQL (Neon cuenta)
- Git

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd web7mo
```

### 2. Configurar Backend

```bash
cd backend
pnpm install

# Copiar y configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Neon
```

### 3. Configurar Base de Datos

Ejecuta el script SQL en tu consola de Neon:
```bash
# Archivo: create_appointments_table.sql
```

### 4. Configurar Frontend

```bash
cd ../frontend
pnpm install
```

## 🔧 Ejecución en Desarrollo

### Backend
```bash
cd backend
pnpm run start:dev
# Servidor corriendo en http://localhost:3000/api
```

### Frontend
```bash
cd frontend
pnpm start
# Aplicación corriendo en http://localhost:4200
```

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/appointments` | Crear nueva cita |
| GET | `/api/appointments` | Obtener todas las citas |
| GET | `/api/appointments/:id` | Obtener cita por ID |
| GET | `/api/appointments/fecha/:fecha` | Obtener citas por fecha |
| PATCH | `/api/appointments/:id/estado` | Actualizar estado |
| DELETE | `/api/appointments/:id` | Eliminar cita |

## 🎨 Características

✅ Sistema completo de agendamiento
✅ Validación de formularios
✅ Integración con base de datos PostgreSQL
✅ API RESTful documentada
✅ Diseño responsive
✅ Mensajes de éxito/error
✅ Estados de citas (pendiente, confirmado, cancelado)
✅ Búsqueda por fecha
✅ Horarios flexibles

##  Variables de Entorno

### Backend (.env)
```env
DATABASE_URL=tu_conexion_neon
PORT=3000
FRONTEND_URL=http://localhost:4200
```

Ver `.env.example` para más detalles.

## Documentación

Para documentación detallada sobre la configuración del sistema, consulta:
- [CONFIGURACION_SISTEMA.md](./CONFIGURACION_SISTEMA.md)
