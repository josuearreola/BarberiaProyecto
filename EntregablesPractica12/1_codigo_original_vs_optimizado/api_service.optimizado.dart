// ignore_for_file: uri_does_not_exist, undefined_class, undefined_function, undefined_identifier, invalid_override, unnecessary_import, deprecated_member_use
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  // OPCIÓN 1: Producción en Render (Activo por defecto)
  static const String baseUrl = 'https://barberiaproyecto-f2wb.onrender.com/api';

  // OPCIÓN 2: Local en Emulador de Android Studio (10.0.2.2 equivale al localhost de tu PC)
  // static const String baseUrl = 'http://10.0.2.2:3000/api';

  // OPCIÓN 3: Local en Celular Físico vía Wi-Fi (Coloca la IP local de tu PC, ej. 192.168.1.85)
  // static const String baseUrl = 'http://192.168.1.85:3000/api';

  /// Cliente HTTP persistente compartido para reutilizar conexiones TCP/TLS (Keep-Alive).
  static final http.Client _sharedClient = http.Client();

  final http.Client _client;
  final String _effectiveBaseUrl;
  final FlutterSecureStorage _storage;
  final Future<String?> Function()? _tokenReader;
  final Duration requestTimeout;
  final List<Duration> retryDelays;
  VoidCallback? onUnauthorized;

  ApiService({
    http.Client? client,
    String? customBaseUrl,
    FlutterSecureStorage? storage,
    this._tokenReader,
    this.requestTimeout = const Duration(seconds: 10),
    this.retryDelays = const [
      Duration(milliseconds: 250),
      Duration(milliseconds: 750),
      Duration(milliseconds: 1750),
    ],
    this.onUnauthorized,
  })  : _client = client ?? _sharedClient,
        _effectiveBaseUrl = (customBaseUrl ?? baseUrl).replaceAll(RegExp(r'/$'), ''),
        _storage = storage ?? const FlutterSecureStorage();

  Future<Map<String, String>> _getHeaders({Map<String, String>? extraHeaders}) async {
    final token = _tokenReader != null
        ? await _tokenReader()
        : await _storage.read(key: 'jwt_token');
    return {
      'Content-Type': 'application/json',
      'x-app-client': 'barberia-smart-device',
      if (token != null) 'Authorization': 'Bearer $token',
      ...?extraHeaders,
    };
  }

  bool _shouldRetryStatus(int statusCode, {required bool isSafeOrIdempotent}) {
    if (statusCode == 401 || statusCode == 403) {
      onUnauthorized?.call();
      return false;
    }
    if (statusCode == 429 || statusCode == 502 || statusCode == 503 || statusCode == 504) {
      return isSafeOrIdempotent;
    }
    if (statusCode == 500 && isSafeOrIdempotent) {
      return true;
    }
    return false;
  }

  Future<http.Response> _executeWithRetry(
    Future<http.Response> Function() operation, {
    required bool isSafeOrIdempotent,
  }) async {
    final maxAttempts = isSafeOrIdempotent ? (retryDelays.length + 1) : 1;
    Object? lastError;

    for (int attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        final response = await operation().timeout(requestTimeout);
        if (_shouldRetryStatus(response.statusCode, isSafeOrIdempotent: isSafeOrIdempotent) &&
            attempt < retryDelays.length) {
          await Future.delayed(retryDelays[attempt]);
          continue;
        }
        return response;
      } on TimeoutException catch (e) {
        lastError = e;
      } on SocketException catch (e) {
        lastError = e;
      } on http.ClientException catch (e) {
        lastError = e;
      }

      if (!isSafeOrIdempotent || attempt >= retryDelays.length) {
        throw lastError;
      }
      await Future.delayed(retryDelays[attempt]);
    }

    throw lastError ?? Exception('Error de red inesperado');
  }

  Future<http.Response> post(
    String endpoint,
    Map<String, dynamic> body, {
    String? idempotencyKey,
  }) async {
    final headers = await _getHeaders(
      extraHeaders: idempotencyKey != null ? {'Idempotency-Key': idempotencyKey} : null,
    );
    final payload = jsonEncode(body);
    final uri = Uri.parse('$_effectiveBaseUrl$endpoint');

    return _executeWithRetry(
      () => _client.post(uri, headers: headers, body: payload),
      // Solo reintenta escrituras automáticamente si cuentan con Idempotency-Key (RES-07).
      isSafeOrIdempotent: idempotencyKey != null && idempotencyKey.isNotEmpty,
    );
  }

  Future<http.Response> get(String endpoint) async {
    final headers = await _getHeaders();
    final uri = Uri.parse('$_effectiveBaseUrl$endpoint');

    return _executeWithRetry(
      () => _client.get(uri, headers: headers),
      isSafeOrIdempotent: true,
    );
  }

  Future<http.Response> patch(
    String endpoint,
    Map<String, dynamic> body, {
    String? idempotencyKey,
  }) async {
    final headers = await _getHeaders(
      extraHeaders: idempotencyKey != null ? {'Idempotency-Key': idempotencyKey} : null,
    );
    final payload = jsonEncode(body);
    final uri = Uri.parse('$_effectiveBaseUrl$endpoint');

    return _executeWithRetry(
      () => _client.patch(uri, headers: headers, body: payload),
      isSafeOrIdempotent: idempotencyKey != null && idempotencyKey.isNotEmpty,
    );
  }

  Future<http.Response> delete(String endpoint) async {
    final headers = await _getHeaders();
    final uri = Uri.parse('$_effectiveBaseUrl$endpoint');

    return _executeWithRetry(
      () => _client.delete(uri, headers: headers),
      isSafeOrIdempotent: true,
    );
  }
}
