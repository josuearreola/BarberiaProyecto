import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../../theme.dart';
import 'consulta_web_iframe.dart';

class ConsultaWebScreen extends StatefulWidget {
  const ConsultaWebScreen({super.key});

  @override
  State<ConsultaWebScreen> createState() => _ConsultaWebScreenState();
}

class _ConsultaWebScreenState extends State<ConsultaWebScreen> {
  static const String _defaultUrl =
      'https://www.mirikbeauty.com/post/10-cortes-de-pelo-modernos-para-hombre-en-2025';

  late TextEditingController _urlController;
  bool _isLoading = false;
  String? _errorMessage;
  String? _responseBody;
  int? _statusCode;
  bool _simulateOffline = false;
  String? _iframeViewType;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: _defaultUrl);
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  void _setupIframe(String url) {
    if (kIsWeb) {
      final viewType = 'iframe-view-${url.hashCode}-${DateTime.now().millisecondsSinceEpoch}';
      registerIframeView(viewType, url);
      _iframeViewType = viewType;
    }
  }

  Future<void> _consultarInformacion() async {
    FocusScope.of(context).unfocus();

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _responseBody = null;
      _statusCode = null;
      _iframeViewType = null;
    });

    await Future.delayed(const Duration(milliseconds: 300));

    // RF06: Prueba 2 - Simular sin conexión
    if (_simulateOffline) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'No fue posible obtener la información.';
        });
      }
      return;
    }

    final urlText = _urlController.text.trim();
    if (urlText.isEmpty) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'No fue posible obtener la información.';
        });
      }
      return;
    }

    try {
      final uri = Uri.parse(urlText);
      http.Response response;

      if (kIsWeb) {
        final proxyUrl = 'https://api.allorigins.win/raw?url=${Uri.encodeComponent(urlText)}';
        response = await http.get(Uri.parse(proxyUrl)).timeout(const Duration(seconds: 10));
      } else {
        response = await http.get(
          uri,
          headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        ).timeout(const Duration(seconds: 10));
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _setupIframe(urlText);
        if (mounted) {
          setState(() {
            _isLoading = false;
            _statusCode = response.statusCode;
            _responseBody = response.body;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = 'No fue posible obtener la información.';
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'No fue posible obtener la información.';
        });
      }
    }
  }

  // Decodifica entidades HTML habituales
  String _decodeEntities(String str) {
    return str
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll('&aacute;', 'á')
        .replaceAll('&eacute;', 'é')
        .replaceAll('&iacute;', 'í')
        .replaceAll('&oacute;', 'ó')
        .replaceAll('&uacute;', 'ú')
        .replaceAll('&ntilde;', 'ñ')
        .replaceAll('&Aacute;', 'Á')
        .replaceAll('&Eacute;', 'É')
        .replaceAll('&Iacute;', 'Í')
        .replaceAll('&Oacute;', 'Ó')
        .replaceAll('&Uacute;', 'Ú')
        .replaceAll('&Ntilde;', 'Ñ');
  }

  // Extrae el título del documento HTML o OpenGraph
  String _extractTitle(String htmlString) {
    final ogMatch = RegExp(
      "<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"']",
      caseSensitive: false,
    ).firstMatch(htmlString);
    if (ogMatch != null && ogMatch.groupCount >= 1) {
      return _decodeEntities(ogMatch.group(1)!.trim());
    }

    final match = RegExp(
      r'<title>(.*?)</title>',
      caseSensitive: false,
      dotAll: true,
    ).firstMatch(htmlString);
    if (match != null && match.groupCount >= 1) {
      return _decodeEntities(match.group(1)!.replaceAll(RegExp(r'\s+'), ' ').trim());
    }
    return 'Recurso Web Obtenido';
  }

  // Extrae la descripción o resumen del documento HTML
  String _extractDescription(String htmlString) {
    final descMatch = RegExp(
      "<meta[^>]+(?:name|property)=[\"'](?:description|og:description)[\"'][^>]+content=[\"']([^\"']+)[\"']",
      caseSensitive: false,
    ).firstMatch(htmlString);
    if (descMatch != null && descMatch.groupCount >= 1) {
      return _decodeEntities(descMatch.group(1)!.trim());
    }
    return '';
  }

  // Extrae la imagen destacada (og:image o twitter:image)
  String _extractImage(String htmlString) {
    final imgMatch = RegExp(
      "<meta[^>]+(?:property|name)=[\"'](?:og:image|twitter:image)[\"'][^>]+content=[\"']([^\"']+)[\"']",
      caseSensitive: false,
    ).firstMatch(htmlString);
    if (imgMatch != null && imgMatch.groupCount >= 1) {
      return imgMatch.group(1)!.trim();
    }
    return '';
  }

  // Limpieza robusta de HTML para extraer texto legible sin código script ni estilos
  String _stripHtml(String htmlString) {
    String text = htmlString;
    // 1. Eliminar bloques de script, style, noscript y comentarios HTML
    text = text.replaceAll(RegExp(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', caseSensitive: false), ' ');
    text = text.replaceAll(RegExp(r'<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>', caseSensitive: false), ' ');
    text = text.replaceAll(RegExp(r'<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>', caseSensitive: false), ' ');
    text = text.replaceAll(RegExp(r'<!--[\s\S]*?-->'), ' ');

    // 2. Reemplazar saltos de línea y etiquetas de bloques de texto
    text = text.replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n');
    text = text.replaceAll(RegExp(r'</?(p|h[1-6]|div|li|tr|blockquote)[^>]*>', caseSensitive: false), '\n');

    // 3. Remover el resto de etiquetas HTML
    text = text.replaceAll(RegExp(r'<[^>]*>'), ' ');

    // 4. Decodificar entidades
    text = _decodeEntities(text);

    // 5. Filtrar líneas vacías y unirlas limpiamente
    final lines = text
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    return lines.join('\n\n');
  }

  // Vista visual rica de la página web (Funciona en Android y todas las plataformas SIN MainActivity)
  Widget _buildVisualPageReader(
    String url,
    String title,
    String description,
    String imageUrl,
    String cleanText,
  ) {
    final uri = Uri.tryParse(url);
    final host = uri?.host ?? 'sitio-web.com';
    final paragraphs = cleanText
        .split('\n\n')
        .where((p) => p.trim().length > 15)
        .toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(14.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Barra de dirección web simulada (con candado HTTPS)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.black54,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white12),
            ),
            child: Row(
              children: [
                const Icon(Icons.lock_rounded, color: Colors.greenAccent, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    host,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.greenAccent.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'HTTPS 200 OK',
                    style: TextStyle(
                      color: Colors.greenAccent,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Imagen de portada del artículo (si existe en la página)
          if (imageUrl.isNotEmpty) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                imageUrl,
                height: 180,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Título principal del sitio / artículo
          Text(
            title.isNotEmpty ? title : 'Contenido Web',
            style: const TextStyle(
              color: AppColors.amarillo,
              fontSize: 18,
              fontWeight: FontWeight.bold,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 10),

          // Tarjeta de descripción destacada
          if (description.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.amarillo.withOpacity(0.08),
                borderRadius: BorderRadius.circular(8),
                border: const Border(left: BorderSide(color: AppColors.amarillo, width: 3.5)),
              ),
              child: Text(
                description,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                  fontStyle: FontStyle.italic,
                  height: 1.4,
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],

          Row(
            children: [
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.amarillo,
                  side: const BorderSide(color: AppColors.amarillo),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                ),
                icon: const Icon(Icons.copy, size: 14),
                label: const Text('Copiar URL', style: TextStyle(fontSize: 12)),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: url));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Enlace copiado al portapapeles.'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white70,
                  side: const BorderSide(color: Colors.white24),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                ),
                icon: const Icon(Icons.text_fields, size: 14),
                label: const Text('Copiar Texto', style: TextStyle(fontSize: 12)),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: cleanText));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Texto extraído copiado al portapapeles.'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
              ),
            ],
          ),

          const Divider(color: Colors.white24, height: 24),

          // Secciones de contenido estructurado extraído de la página
          if (paragraphs.isNotEmpty)
            ...paragraphs.take(25).map(
                  (para) => Padding(
                    padding: const EdgeInsets.only(bottom: 12.0),
                    child: Text(
                      para,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13.5,
                        height: 1.5,
                      ),
                    ),
                  ),
                )
          else
            Text(
              cleanText.isNotEmpty ? cleanText : 'Sin texto visible disponible.',
              style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textContent = _responseBody != null ? _stripHtml(_responseBody!) : '';
    final pageTitle = _responseBody != null ? _extractTitle(_responseBody!) : '';
    final pageDescription = _responseBody != null ? _extractDescription(_responseBody!) : '';
    final pageImage = _responseBody != null ? _extractImage(_responseBody!) : '';
    final urlText = _urlController.text.trim();

    return Scaffold(
      backgroundColor: AppColors.negro,
      appBar: AppBar(
        title: const Text(
          'ConsultaWeb',
          style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.blanco),
        ),
        backgroundColor: AppColors.azulOscuro,
        centerTitle: true,
        elevation: 2,
        iconTheme: const IconThemeData(color: AppColors.amarillo),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header con RF01: Al iniciar la aplicación deberá mostrar "Consulta de información"
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.azulOscuro,
                    AppColors.azulOscuro.withOpacity(0.7),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.amarillo.withOpacity(0.3)),
              ),
              child: const Column(
                children: [
                  Icon(Icons.public, color: AppColors.amarillo, size: 40),
                  SizedBox(height: 8),
                  // RF01: Al iniciar la aplicación deberá mostrar "Consulta de información"
                  Text(
                    'Consulta de información',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppColors.amarillo,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Extensión del sitio personal',
                    style: TextStyle(fontSize: 13, color: Colors.white70),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Sección de Configuración de la URL (Prueba 3: Modificación de la URL)
            Card(
              color: AppColors.azulOscuro,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.white.withOpacity(0.1)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.link, color: AppColors.amarillo, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'URL preasignada',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                              ),
                            ),
                          ],
                        ),
                        if (_urlController.text != _defaultUrl)
                          TextButton.icon(
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(60, 30),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            icon: const Icon(Icons.refresh, size: 16, color: AppColors.amarillo),
                            label: const Text('Restablecer', style: TextStyle(color: AppColors.amarillo, fontSize: 12)),
                            onPressed: () {
                              setState(() {
                                _urlController.text = _defaultUrl;
                              });
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _urlController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      maxLines: 2,
                      minLines: 1,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.black38,
                        hintText: 'https://...',
                        hintStyle: const TextStyle(color: Colors.white38),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Interruptor para simular prueba "Sin Conexión" (Prueba 2)
                    Row(
                      children: [
                        Switch(
                          value: _simulateOffline,
                          activeColor: Colors.redAccent,
                          onChanged: (val) {
                            setState(() {
                              _simulateOffline = val;
                            });
                          },
                        ),
                        const Expanded(
                          child: Text(
                            'Simular modo sin conexión (Prueba 2)',
                            style: TextStyle(color: Colors.white70, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // RF02: Deberá existir un botón: CONSULTAR (o "Consultar información")
            ElevatedButton.icon(
              onPressed: _isLoading ? null : _consultarInformacion,
              icon: _isLoading
                  ? const SizedBox.shrink()
                  : const Icon(Icons.search, color: Colors.black),
              label: Text(
                _isLoading ? 'Consultando...' : 'CONSULTAR',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.1,
                  color: Colors.black,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.amarillo,
                disabledBackgroundColor: AppColors.amarillo.withOpacity(0.5),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 4,
              ),
            ),

            const SizedBox(height: 24),

            // Área de Estado y Respuesta (RF04, RF05, RF06)
            const Text(
              'Resultado de la Consulta:',
              style: TextStyle(
                color: Colors.white70,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),

            // RF05: Mientras se realiza la petición deberá mostrarse "Consultando..."
            if (_isLoading)
              Container(
                padding: const EdgeInsets.all(30),
                decoration: BoxDecoration(
                  color: AppColors.azulOscuro,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.amarillo.withOpacity(0.3)),
                ),
                child: const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(AppColors.amarillo),
                    ),
                    SizedBox(height: 20),
                    Text(
                      'Consultando...',
                      style: TextStyle(
                        color: AppColors.amarillo,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'Conectando con la URL preasignada...',
                      style: TextStyle(color: Colors.white60, fontSize: 13),
                    ),
                  ],
                ),
              )

            // RF06: Si existe un error de conexión deberá mostrarse "No fue posible obtener la información."
            else if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.redAccent.withOpacity(0.6)),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.wifi_off_rounded, color: Colors.redAccent, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      _errorMessage!,
                      style: const TextStyle(
                        color: Colors.redAccent,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Verifique su conexión a internet o la dirección URL e intente nuevamente.',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              )

            // RF04: La información obtenida deberá mostrarse en pantalla.
            else if (_responseBody != null)
              DefaultTabController(
                length: 3,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.azulOscuro,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.amarillo.withOpacity(0.4)),
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.amarillo.withOpacity(0.1),
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 22),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Código de respuesta: ${_statusCode ?? 200} OK',
                                style: const TextStyle(
                                  color: Colors.greenAccent,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black45,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '${(_responseBody!.length / 1024).toStringAsFixed(1)} KB',
                                style: const TextStyle(color: AppColors.amarillo, fontSize: 11),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const TabBar(
                        indicatorColor: AppColors.amarillo,
                        labelColor: AppColors.amarillo,
                        unselectedLabelColor: Colors.white60,
                        isScrollable: false,
                        tabs: [
                          Tab(icon: Icon(Icons.web, size: 18), text: 'Página Web'),
                          Tab(icon: Icon(Icons.article_outlined, size: 18), text: 'Vista Texto'),
                          Tab(icon: Icon(Icons.code, size: 18), text: 'Código HTML'),
                        ],
                      ),
                      SizedBox(
                        height: 520,
                        child: TabBarView(
                          children: [
                            // Pestaña 1: Renderizado visual del contenido de la página web
                            ClipRRect(
                              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
                              child: kIsWeb && _iframeViewType != null
                                  ? buildIframeWidget(_iframeViewType!)
                                  : _buildVisualPageReader(
                                      urlText,
                                      pageTitle,
                                      pageDescription,
                                      pageImage,
                                      textContent,
                                    ),
                            ),

                            // Pestaña 2: Texto limpio extraído del sitio web
                            Padding(
                              padding: const EdgeInsets.all(14.0),
                              child: SingleChildScrollView(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (pageTitle.isNotEmpty) ...[
                                      Text(
                                        pageTitle,
                                        style: const TextStyle(
                                          color: AppColors.amarillo,
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const Divider(color: Colors.white24, height: 20),
                                    ],
                                    Text(
                                      textContent.isNotEmpty
                                          ? textContent
                                          : 'Sin contenido de texto disponible.',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 13,
                                        height: 1.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            // Pestaña 3: HTML crudo de la respuesta
                            Padding(
                              padding: const EdgeInsets.all(14.0),
                              child: SingleChildScrollView(
                                child: SelectableText(
                                  _responseBody!,
                                  style: const TextStyle(
                                    fontFamily: 'monospace',
                                    color: Colors.lightGreenAccent,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              )

            // Estado inicial antes de presionar el botón
            else
              Container(
                padding: const EdgeInsets.all(30),
                decoration: BoxDecoration(
                  color: AppColors.azulOscuro.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white10),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.touch_app, color: Colors.white38, size: 40),
                    SizedBox(height: 12),
                    Text(
                      'Presiona el botón "CONSULTAR" para realizar la petición HTTP.',
                      style: TextStyle(color: Colors.white60, fontSize: 14),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 30),

            // Guía de Pruebas de la Práctica 3
            Card(
              color: Colors.black26,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: AppColors.amarillo.withOpacity(0.2)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '📋 Guía de Pruebas de la Práctica 3:',
                      style: TextStyle(
                        color: AppColors.amarillo,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _buildTestItem('Prueba 1 — Con conexión',
                        'Presione CONSULTAR con Wi-Fi/Datos activos para cargar el contenido de la URL.'),
                    _buildTestItem('Prueba 2 — Sin conexión',
                        'Active el switch "Simular modo sin conexión" o desactive internet y presione CONSULTAR para verificar el mensaje de error.'),
                    _buildTestItem('Prueba 3 — Modificación de la URL',
                        'Edite la URL en el campo superior e intente realizar la consulta a otra dirección.'),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTestItem(String title, String description) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.arrow_right_rounded, color: AppColors.amarillo, size: 20),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(fontSize: 12, color: Colors.white70),
                children: [
                  TextSpan(
                    text: '$title: ',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  TextSpan(text: description),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
