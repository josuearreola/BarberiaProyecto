# 💈 Sistema de Agendamiento y Ecosistema Multipantalla - Barbería Premium

Este es el repositorio central del sistema completo de agendamiento y monitoreo inteligente para la barbería de lujo. El proyecto integra una plataforma web administrativa y de clientes junto a un ecosistema de dispositivos inteligentes interconectados en tiempo real.

---

## 🚀 Arquitectura General del Sistema

El ecosistema está compuesto por 5 módulos principales distribuidos en la siguiente estructura:

### 💻 Core Web (Arquitectura Cliente-Servidor)
*   **[backend/](./backend):** API REST robusta desarrollada en **NestJS**, con persistencia en la nube mediante **Neon PostgreSQL (Serverless)**, autenticación con tokens **JWT**, contraseñas encriptadas con **bcrypt**, auditoría interna, y control estricto de orígenes CORS.
*   **[frontend/](./frontend):** Panel de administración y portal de clientes desarrollado en **Angular 19** con diseño moderno, responsive y gestión dinámica de citas, barberos, servicios y promociones.

### 📱 Ecosistema de Dispositivos Inteligentes ([dispositivos_inteligentes/](./dispositivos_inteligentes))
*   **[phone_app](./dispositivos_inteligentes/phone_app):** Aplicación móvil nativa en **Flutter** para el cliente. Permite gestionar citas, ver el catálogo, y actuar como puente (Bridge BLE/WebSockets) para el reloj inteligente.
*   **[barberia_wear](./dispositivos_inteligentes/barberia_wear):** Aplicación para relojes **Wear OS** (Android) en **Flutter**. Simula sensores de salud (batería, ritmo cardíaco) y muestra el tiempo restante de la cita del cliente sincronizada.
*   **[tv_pwa](./dispositivos_inteligentes/tv_pwa):** Progressive Web App (PWA) optimizada para **Smart TV 1080p** con navegación nativa por **D-pad** (flechas y enter), Safe Zone reglamentaria, e integración en tiempo real por WebSockets para mostrar citas y colas de atención vigentes.

---

## 📁 Estructura del Proyecto

```
web7mo/
├── backend/                       # Servidor NestJS (API & WebSockets)
├── frontend/                      # Cliente web administrativo (Angular)
├── dispositivos_inteligentes/     # Módulos IoT y Smart Screens
│   ├── phone_app/                 # App móvil en Flutter (Cliente)
│   ├── barberia_wear/             # App del reloj inteligente Wear OS
│   └── tv_pwa/                    # PWA optimizada para Smart TV
├── create_appointments_table.sql  # Script de base de datos SQL
└── README.md                      # Documentación del proyecto
```

---

## ⚙️ Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd BarberiaProyecto
```

### 2. Base de Datos (Neon PostgreSQL)
Crea una base de datos en [Neon Tech](https://neon.tech/) y ejecuta los scripts de creación de tablas:
*   `create_appointments_table.sql`
*   `create_users_table.sql`

### 3. Configurar Backend (NestJS)
```bash
cd backend
npm install
# Crear archivo .env en base al ejemplo .env.example
# Configurar DATABASE_URL, PORT, JWT_SECRET, y orígenes CORS
npm run start:dev
```
*   El servidor se levantará en: `http://localhost:3000/api`

### 4. Configurar Frontend (Angular)
```bash
cd ../frontend
npm install
npm run start
```
*   Acceso al portal web: `http://localhost:4200`

---

## 📲 Configuración y Ejecución del Ecosistema IoT

### Prerrequisitos
1.  **Android Studio** instalado con dos emuladores activos:
    *   Un teléfono Android (ej: API 34 o superior) en el puerto `5556`.
    *   Un reloj Wear OS (ej: API 30 o superior, Large Round) en el puerto `5554`.

### 1. Desplegar PWA para Smart TV (tv_pwa)
```bash
cd ../dispositivos_inteligentes/tv_pwa
npm install
npm run build
# Levantar servidor de desarrollo para TV
npm install -g http-server
http-server dist/tv-pwa/browser -p 8080
```
*   **Navegación Smart TV:** Abre `http://localhost:8080` en Chrome, presiona F12 y activa la resolución de pantalla **1920x1080**. Navega por las tarjetas utilizando las **flechas del teclado** (Arrow Keys) y presiona **Enter** sobre la Galería de Estilos para cambiar el fondo de pantalla interactivo.

### 2. Lanzar la App Móvil (phone_app)
```bash
cd ../phone_app
flutter pub get
# Ejecutar en el emulador del teléfono
flutter run
```

### 3. Lanzar la App del Reloj (barberia_wear)
```bash
cd ../barberia_wear
flutter pub get
# Ejecutar en el emulador del reloj inteligente
flutter run
```

---

## 🔄 Flujo de Sincronización en Tiempo Real

1.  **Wear OS a Teléfono (BLE/Sockets):** Abre la aplicación en el reloj y presiona **Vincular**. Comenzará a transmitir datos de salud simulados. Abre la app del teléfono en el módulo **Vincular Wear OS**, presiona **Buscar Reloj** para conectarlos.
2.  **Sincronización de Citas:** Desde la app móvil del cliente, presiona **Sincronizar Próxima Cita**. El sistema buscará en la base de datos tu cita vigente y la enviará al reloj, que calculará en tiempo real los minutos y horas restantes para tu servicio.
3.  **Monitoreo en Smart TV (WebSocket):** Al crear una nueva cita o modificar un estado desde el celular, la Smart TV PWA refleja el cambio al instante sin necesidad de recargar la página, mostrando la cola de atención actualizada a los clientes en la sala de espera.
