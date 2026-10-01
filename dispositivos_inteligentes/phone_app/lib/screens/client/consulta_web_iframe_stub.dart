import 'package:flutter/material.dart';

void registerIframeView(String viewType, String url) {
  // Sin implementación en plataformas no web (Android / iOS / Windows)
}

Widget buildIframeWidget(String viewType) {
  return const Center(
    child: Text('Vista Iframe no disponible en esta plataforma.'),
  );
}
