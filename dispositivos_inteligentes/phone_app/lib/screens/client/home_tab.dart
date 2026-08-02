import 'package:flutter/material.dart';
import '../../theme.dart';
import 'package:phone_app/screens/client/device_link_screen.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});

  final List<Map<String, dynamic>> services = const [
    {
      'title': 'Corte Clásico',
      'duration': '45 min',
      'price': '\$150',
      'icon': Icons.content_cut,
      'description': 'Corte tradicional a tijera o máquina con acabado perfecto.',
      'image': 'assets/images/corteClasico.png',
    },
    {
      'title': 'Perfilado de Barba',
      'duration': '30 min',
      'price': '\$100',
      'icon': Icons.face,
      'description': 'Alineación y rebaje de barba con toalla caliente y navaja.',
      'image': 'assets/images/arregloBarba.png',
    },
    {
      'title': 'Paquete Completo',
      'duration': '1h 15min',
      'price': '\$220',
      'icon': Icons.star,
      'description': 'Corte de cabello + Perfilado de barba + Masaje facial.',
      'image': 'assets/images/paqueteCompleto.jpg',
    },
    {
      'title': 'Tinte / Decoloración',
      'duration': '2h',
      'price': '\$350+',
      'icon': Icons.color_lens,
      'description': 'Cambio de look radical o retoque de color.',
      'image': 'assets/images/cortePremium.png',
    }
  ];

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(15),
      itemCount: services.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return const Padding(
            padding: EdgeInsets.only(bottom: 20, top: 10),
            child: Text(
              'Nuestros Servicios',
              style: TextStyle(
                color: AppColors.amarillo,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          );
        }
        
        final service = services[index - 1];
        
        return Card(
          color: AppColors.azulOscuro,
          elevation: 4,
          margin: const EdgeInsets.only(bottom: 15),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.amarillo.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(service['icon'], color: AppColors.amarillo, size: 30),
                ),
                const SizedBox(width: 15),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        service['title'],
                        style: const TextStyle(
                          color: AppColors.blanco,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        service['description'],
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.access_time, color: Colors.white54, size: 16),
                              const SizedBox(width: 4),
                              Text(service['duration'], style: const TextStyle(color: Colors.white54, fontSize: 13)),
                            ],
                          ),
                          Text(
                            service['price'],
                            style: const TextStyle(
                              color: AppColors.amarillo,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      )
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.image_search, color: AppColors.amarillo),
                  tooltip: 'Ver estilo',
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (ctx) => Dialog(
                        backgroundColor: AppColors.azulOscuro,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            ClipRRect(
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                              child: Image.asset(
                                service['image'],
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => const Padding(
                                  padding: EdgeInsets.all(50.0),
                                  child: Icon(Icons.broken_image, size: 50, color: Colors.white54),
                                ),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(15.0),
                              child: Text(
                                service['title'],
                                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                            ),
                            TextButton(
                              onPressed: () => Navigator.of(ctx).pop(),
                              child: const Text('Cerrar', style: TextStyle(color: AppColors.amarillo)),
                            ),
                            const SizedBox(height: 10),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
