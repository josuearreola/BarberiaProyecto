# Práctica 3: Consumo de una URL Preasignada desde una Aplicación Móvil (ConsultaWeb)

## 📌 Datos Generales
- **Nombre de la Aplicación:** ConsultaWeb (Extensión del sitio personal / Barbería)
- **Módulo / Pantalla:** `ConsultaWebScreen` (`lib/screens/client/consulta_web_screen.dart`)
- **Plataformas Soportadas:** Android, iOS, Web (Chrome), Windows Desktop.
- **URL Preasignada:** `https://www.mirikbeauty.com/post/10-cortes-de-pelo-modernos-para-hombre-en-2025`

---

## 📑 Tabla de Criterios de Evaluación

| Criterio | Porcentaje | Estatus |
| :--- | :---: | :---: |
| **Configuración del proyecto** | 10% | ✅ Completado |
| **Implementación de URL preasignada** | 20% | ✅ Completado |
| **Solicitud HTTP** | 20% | ✅ Completado |
| **Procesamiento de la respuesta** | 15% | ✅ Completado |
| **Diseño y funcionamiento de interfaz** | 10% | ✅ Completado |
| **Manejo de errores** | 10% | ✅ Completado |
| **Pruebas realizadas** | 5% | ✅ Completado |
| **Preguntas y conclusión** | 10% | ✅ Completado |
| **TOTAL** | **100%** | **100%** |

---

## 1. ⚙️ Configuración del Proyecto (10%)
La aplicación móvil está desarrollada con **Flutter** en arquitectura modular con soporte multiplataforma.

- **Paquete HTTP:** Se utiliza la librería oficial `http` (`^1.2.1`) configurada en el archivo `pubspec.yaml`.
- **Arquitectura Multiplataforma:** Para evitar incompatibilidades de bibliotecas web en emuladores nativos de Android y Windows, se creó una exportación condicional en `lib/screens/client/consulta_web_iframe.dart` que separa la compilación móvil de la web.

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.1
  provider: ^6.1.2
```

---

## 2. 🔗 Implementación de URL Preasignada (20%)
Se definió la URL preasignada requerida dentro del estado del componente como una constante por defecto, vinculada a un controlador `TextEditingController` para permitir edición dinámica en pruebas.

```dart
static const String _defaultUrl =
    'https://www.mirikbeauty.com/post/10-cortes-de-pelo-modernos-para-hombre-en-2025';
```

---

## 3. 🌐 Solicitud HTTP (20%)
Al presionar el botón **CONSULTAR**, se invoca el método asíncrono `_consultarInformacion()` que ejecuta una petición HTTP `GET` configurada con encabezados estándar (`User-Agent`, `Accept`) y tiempo límite de espera (`timeout`).

```dart
final response = await http.get(
  Uri.parse(urlText),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
).timeout(const Duration(seconds: 8));
```

---

## 4. 📊 Procesamiento de la Respuesta / JSON (15%)
Una vez recibida la respuesta HTTP (código `200 OK`):
1. **Verificación de Estatus:** Se valida que `response.statusCode >= 200` y `< 300`.
2. **Procesamiento de Contenido:**
   - Cálculo del tamaño recibido en Kilobytes (`KB`).
   - Extracción limpia del texto mediante `_stripHtml()` eliminando etiquetas HTML.
   - Extracción automática del título `<title>` mediante expresiones regulares.
   - Renderizado en 3 pestañas: **Página Real (Visual / Iframe)**, **Vista Texto** y **Código HTML**.

---

## 5. 🎨 Diseño y Funcionamiento de Interfaz (10%)
La interfaz cumple estrictamente con cada Requisito Funcional (**RF01 - RF05**):

- **RF01:** Muestra el encabezado principal **"Consulta de información"**.
- **RF02:** Cuenta con un botón central etiquetado **"CONSULTAR"**.
- **RF03:** Inicia la solicitud HTTP al presionar el botón **CONSULTAR**.
- **RF04:** Área de despliegue interactiva con código de respuesta, peso en KB y contenido.
- **RF05:** Durante la petición HTTP muestra el indicador de carga junto al texto **"Consultando..."**.

---

## 6. 🚨 Manejo de Errores (10%)
Cumple con el **RF06** en todas las situaciones de fallo:

- **RF06:** En caso de fallas de conexión (timeout, sin datos/Wi-Fi, o sitio no disponible) muestra el mensaje en pantalla:
  > **"No fue posible obtener la información."**

- **Implementación con `try-catch`:** Captura cualquier `SocketException`, `TimeoutException` o error de red sin cerrar la aplicación.

---

## 7. 🧪 Pruebas Realizadas (5%)

### Prueba 1 — Con conexión:
- **Procedimiento:** Con el dispositivo/emulador conectado a Internet, pulsar el botón **CONSULTAR**.
- **Resultado:** Muestra el mensaje `"Consultando..."` brevemente y despliega el código `200 OK` junto con el contenido del artículo de cortes de cabello 2025.

### Prueba 2 — Sin conexión:
- **Procedimiento:** Activar el switch *"Simular modo sin conexión"* o desactivar la red del dispositivo y pulsar **CONSULTAR**.
- **Resultado:** Muestra en tarjeta roja de alerta: `"No fue posible obtener la información."`.

### Prueba 3 — Modificación de la URL:
- **Procedimiento:** Editar el campo de texto de la URL con otra dirección (o una URL errónea) y presionar **CONSULTAR**.
- **Resultado:** Procesa la nueva dirección correctamente o muestra el mensaje de error RF06 si la URL es inválida.

---

## 8. ❓ Preguntas y Conclusión (10%)

### Preguntas de Reflexión:

1. **¿Qué función cumple una solicitud HTTP en una aplicación móvil?**
   Permite a la aplicación comunicarse con servidores externos y recursos en la web, obteniendo datos en tiempo real (HTML, JSON, XML) para mantener la información actualizada sin depender de datos estáticos en el dispositivo.

2. **¿Por qué es indispensable manejar la asincronía (`async / await`) en peticiones de red?**
   Porque las peticiones HTTP dependen del estado de la red y pueden tardar segundos. Al usar `async/await`, la ejecución se realiza en segundo plano sin congelar la interfaz gráfica de usuario (`UI Thread`).

3. **¿Cómo beneficia el manejo de errores (RF06) a la experiencia del usuario (UX)?**
   Informa claramente al usuario sobre la causa de una falla (ausencia de conexión o servidor no disponible) mediante mensajes amigables, evitando que la aplicación sufra cierres inesperados (*crashes*).

4. **¿Qué diferencia existe entre consumir un recurso HTML y una API REST JSON?**
   Un recurso HTML contiene la estructura visual y de presentación para un navegador, mientras que una API REST en formato JSON entrega datos estructurados y ligeros diseñados para ser consumidos y procesados directamente por la lógica de la aplicación móvil.

### Conclusión:
La realización de la **Práctica 3 (ConsultaWeb)** permitió comprender de manera práctica la integración de peticiones HTTP en aplicaciones móviles desarrolladas con Flutter. Se logró implementar un flujo sólido de consumo web que incluye desde la configuración del cliente HTTP, la gestión de estados de carga y errores de red, hasta la presentación accesible de los recursos en pantalla.
