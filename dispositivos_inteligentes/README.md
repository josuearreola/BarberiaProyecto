# 💈 Ecosistema de Dispositivos Inteligentes - Barbería Premium

Este directorio contiene las aplicaciones que integran el ecosistema IoT y multipantalla del sistema de agendamiento para la barbería.

## 📁 Contenido del Directorio

- **[phone_app](./phone_app):** Aplicación móvil principal desarrollada en Flutter para clientes.
- **[barberia_wear](./barberia_wear):** Aplicación para relojes inteligentes (Wear OS) desarrollada en Flutter.
- **[tv_pwa](./tv_pwa):** Progressive Web App (PWA) optimizada para Smart TV 1080p con navegación D-pad.

---

## 🚀 Instrucciones de Ejecución Simultánea

Para evaluar el correcto funcionamiento del ecosistema (simultaneidad de 3 dispositivos comunicados en tiempo real), sigue estos pasos:

### 1. Requisitos Previos e Infraestructura
* Asegúrate de tener el backend NestJS corriendo en tu máquina local:
  ```bash
  # En el directorio root/backend:
  npm run start:dev
  ```
* Asegúrate de tener activos y en ejecución dos emuladores de Android en Android Studio:
  1. Un emulador de teléfono Android (ej: **sdk gphone16k** en puerto `5556`).
  2. Un emulador de reloj Android Wear OS (ej: **sdk gwear** en puerto `5554`).

---

### 2. Ejecutar la PWA para Smart TV (Dispositivo 1)
La PWA corre en un servidor local y se puede auditar mediante las herramientas de desarrollo del navegador.
```bash
# Ir a la carpeta de la PWA
cd tv_pwa

# Instalar dependencias si no lo has hecho
npm install

# Compilar la PWA
npm run build

# Levantar el servidor local (ej: con http-server o similar en el puerto 8080)
# Si no tienes http-server, instálalo globalmente con: npm install -g http-server
http-server dist/tv-pwa/browser -p 8080
```
* **Acceso:** Abre [http://localhost:8080](http://localhost:8080) en Google Chrome o Microsoft Edge.
* **Modo TV:** Abre las Herramientas de Desarrollador (F12), activa la emulación de dispositivos y selecciona la resolución personalizada **Smart TV 1080p (1920x1080)**.
* **Navegación:** Usa las flechas del teclado (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`) para moverte por las tarjetas y presiona `Enter` para cambiar dinámicamente el fondo de pantalla contextual.

---

### 3. Ejecutar la App del Teléfono (Dispositivo 2)
```bash
# Ir a la carpeta de la app móvil
cd phone_app

# Obtener dependencias
flutter pub get

# Lanzar en el emulador del teléfono (asegúrate de seleccionar el id del teléfono, ej. 2)
flutter run
```

---

### 4. Ejecutar la App del Reloj Wear OS (Dispositivo 3)
```bash
# Ir a la carpeta del reloj
cd ../barberia_wear

# Obtener dependencias
flutter pub get

# Lanzar en el emulador de Wear OS (selecciona el id del reloj, ej. 1)
flutter run
```

---

## 🔄 Flujo de Prueba de Sincronización

1. **Vincular Reloj:** En la pantalla del Wear OS, presiona el botón **Vincular**. El reloj comenzará a transmitir datos simulados de ritmo cardíaco y batería por Sockets al backend.
2. **Conectar Teléfono:** Abre la app del teléfono, inicia sesión con un usuario cliente (ej: `Cliente12@gmail.com`), ve a la sección **Vincular Wear OS** y presiona **Buscar Reloj**. Se establecerá la conexión.
3. **Ver Citas en TV:** Al cargar la TV, verás todas las citas del día actual consumidas dinámicamente desde la API (los turnos pasados se verán atenuados en gris y los vigentes en rojo).
4. **Sincronizar Cita:** En la pantalla de vinculación del celular, presiona **Sincronizar Próxima Cita**. El celular detectará tu próxima cita vigente de la base de datos (ej. la de las 15:00) y la enviará al reloj. El reloj calculará el tiempo restante real exacto utilizando coordenadas de tiempo UTC absolutas.
