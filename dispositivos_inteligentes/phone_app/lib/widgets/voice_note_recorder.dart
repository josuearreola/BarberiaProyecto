import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../theme.dart';

class VoiceNoteRecorder extends StatefulWidget {
  final Function(String? audioPath) onAudioChanged;

  const VoiceNoteRecorder({
    super.key,
    required this.onAudioChanged,
  });

  @override
  State<VoiceNoteRecorder> createState() => _VoiceNoteRecorderState();
}

class _VoiceNoteRecorderState extends State<VoiceNoteRecorder>
    with SingleTickerProviderStateMixin {
  late final AudioRecorder _audioRecorder;
  late final AudioPlayer _audioPlayer;

  bool _isRecording = false;
  String? _recordedPath;

  // Temporizador de grabación
  Timer? _recordTimer;
  int _recordDuration = 0; // en segundos
  static const int _maxDuration = 60; // máximo 60 segundos por nota

  // Estado del reproductor
  bool _isPlaying = false;
  Duration _currentPosition = Duration.zero;
  Duration _totalDuration = Duration.zero;

  StreamSubscription? _playerStateSubscription;
  StreamSubscription? _positionSubscription;
  StreamSubscription? _durationSubscription;

  // Animación de pulso para cuando esté grabando
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _audioRecorder = AudioRecorder();
    _audioPlayer = AudioPlayer();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.25).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _initAudioPlayerListeners();
  }

  void _initAudioPlayerListeners() {
    _playerStateSubscription = _audioPlayer.onPlayerStateChanged.listen((state) {
      if (!mounted) return;
      setState(() {
        _isPlaying = state == PlayerState.playing;
      });
    });

    _positionSubscription = _audioPlayer.onPositionChanged.listen((pos) {
      if (!mounted) return;
      setState(() {
        _currentPosition = pos;
      });
    });

    _durationSubscription = _audioPlayer.onDurationChanged.listen((dur) {
      if (!mounted) return;
      setState(() {
        _totalDuration = dur;
      });
    });

    _audioPlayer.onPlayerComplete.listen((_) {
      if (!mounted) return;
      setState(() {
        _isPlaying = false;
        _currentPosition = Duration.zero;
      });
    });
  }

  @override
  void dispose() {
    _recordTimer?.cancel();
    _playerStateSubscription?.cancel();
    _positionSubscription?.cancel();
    _durationSubscription?.cancel();
    _audioPlayer.dispose();
    _audioRecorder.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _startRecording() async {
    try {
      // 1. Verificar y solicitar permisos de micrófono
      final micStatus = await Permission.microphone.request();
      if (!micStatus.isGranted) {
        if (!mounted) return;
        if (micStatus.isPermanentlyDenied) {
          _showSettingsDialog();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Se requiere permiso de micrófono para grabar notas de voz'),
              backgroundColor: AppColors.rojo,
            ),
          );
        }
        return;
      }

      // Detener reproducción si estuviera activa
      if (_isPlaying) {
        await _audioPlayer.stop();
      }

      // 2. Crear ruta de archivo temporal
      final tempDir = await getTemporaryDirectory();
      final filePath =
          '${tempDir.path}/cita_nota_${DateTime.now().millisecondsSinceEpoch}.m4a';

      // 3. Iniciar grabación AAC LC
      await _audioRecorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 128000,
          sampleRate: 44100,
        ),
        path: filePath,
      );

      setState(() {
        _isRecording = true;
        _recordDuration = 0;
      });

      // 4. Iniciar cronómetro
      _recordTimer?.cancel();
      _recordTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) return;
        setState(() {
          _recordDuration++;
        });

        if (_recordDuration >= _maxDuration) {
          _stopRecording();
        }
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error al iniciar grabación: $e'),
          backgroundColor: AppColors.rojo,
        ),
      );
    }
  }

  Future<void> _stopRecording() async {
    _recordTimer?.cancel();
    try {
      final path = await _audioRecorder.stop();
      if (!mounted) return;

      setState(() {
        _isRecording = false;
        _recordedPath = path;
        _currentPosition = Duration.zero;
      });

      if (path != null) {
        widget.onAudioChanged(path);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error al detener grabación: $e'),
          backgroundColor: AppColors.rojo,
        ),
      );
    }
  }

  Future<void> _cancelRecording() async {
    _recordTimer?.cancel();
    try {
      await _audioRecorder.cancel();
      if (!mounted) return;
      setState(() {
        _isRecording = false;
        _recordDuration = 0;
      });
    } catch (_) {}
  }

  Future<void> _deleteRecordedAudio() async {
    if (_isPlaying) {
      await _audioPlayer.stop();
    }
    if (_recordedPath != null) {
      try {
        final file = File(_recordedPath!);
        if (await file.exists()) {
          await file.delete();
        }
      } catch (_) {}
    }
    setState(() {
      _recordedPath = null;
      _currentPosition = Duration.zero;
      _totalDuration = Duration.zero;
      _isPlaying = false;
    });
    widget.onAudioChanged(null);
  }

  Future<void> _togglePlayPause() async {
    if (_recordedPath == null) return;

    if (_isPlaying) {
      await _audioPlayer.pause();
    } else {
      await _audioPlayer.play(DeviceFileSource(_recordedPath!));
    }
  }

  void _showSettingsDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.azulOscuro,
        title: const Text('Permiso de Micrófono', style: TextStyle(color: Colors.white)),
        content: const Text(
          'El acceso al micrófono está deshabilitado en los ajustes de tu teléfono. Por favor habilítalo para poder grabar tu nota de voz.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.amarillo),
            onPressed: () {
              Navigator.pop(ctx);
              openAppSettings();
            },
            child: const Text('Abrir Ajustes', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );
  }

  String _formatDuration(int seconds) {
    final mins = (seconds ~/ 60).toString().padLeft(2, '0');
    final secs = (seconds % 60).toString().padLeft(2, '0');
    return '$mins:$secs';
  }

  String _formatTimeDuration(Duration duration) {
    final mins = duration.inMinutes.toString().padLeft(2, '0');
    final secs = (duration.inSeconds % 60).toString().padLeft(2, '0');
    return '$mins:$secs';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.azulOscuro,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _isRecording
              ? AppColors.rojo
              : (_recordedPath != null ? AppColors.amarillo : Colors.white12),
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Encabezado
          Row(
            children: [
              Icon(
                Icons.mic_rounded,
                color: _isRecording
                    ? AppColors.rojo
                    : (_recordedPath != null ? AppColors.amarillo : Colors.white70),
                size: 22,
              ),
              const SizedBox(width: 8),
              const Text(
                'Nota de Voz para el Barbero',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
              const Spacer(),
              if (_recordedPath == null && !_isRecording)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Opcional',
                    style: TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // Contenido según el estado
          if (_isRecording)
            _buildRecordingState()
          else if (_recordedPath != null)
            _buildPlaybackState()
          else
            _buildIdleState(),
        ],
      ),
    );
  }

  // 1. Estado inicial: botón para grabar
  Widget _buildIdleState() {
    return Column(
      children: [
        const Text(
          '¿Tienes alguna instrucción especial sobre tu corte? Graba una nota de voz para tu barbero.',
          style: TextStyle(color: Colors.white60, fontSize: 13),
        ),
        const SizedBox(height: 16),
        Center(
          child: InkWell(
            onTap: _startRecording,
            borderRadius: BorderRadius.circular(30),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.amarillo, Color(0xFFE58D05)],
                ),
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.amarillo.withValues(alpha: 0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.mic, color: Colors.black, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Grabar Nota de Voz',
                    style: TextStyle(
                      color: Colors.black,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // 2. Estado grabando: pulso, cronómetro y botón de terminar
  Widget _buildRecordingState() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ScaleTransition(
              scale: _pulseAnimation,
              child: Container(
                width: 14,
                height: 14,
                decoration: const BoxDecoration(
                  color: AppColors.rojo,
                  shape: BoxShape.circle,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'GRABANDO... ${_formatDuration(_recordDuration)} / 01:00',
              style: const TextStyle(
                color: AppColors.rojo,
                fontWeight: FontWeight.bold,
                fontSize: 14,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Botón cancelar
            OutlinedButton.icon(
              onPressed: _cancelRecording,
              icon: const Icon(Icons.close, color: Colors.white70, size: 18),
              label: const Text('Cancelar', style: TextStyle(color: Colors.white70)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.white24),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              ),
            ),
            const SizedBox(width: 16),
            // Botón finalizar
            ElevatedButton.icon(
              onPressed: _stopRecording,
              icon: const Icon(Icons.stop_rounded, color: Colors.white, size: 20),
              label: const Text('Finalizar', style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.rojo,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // 3. Estado con audio grabado: reproductor y botón de eliminar
  Widget _buildPlaybackState() {
    final maxSec = _totalDuration.inMilliseconds > 0
        ? _totalDuration.inMilliseconds.toDouble()
        : 1.0;
    final currentSec = _currentPosition.inMilliseconds
        .clamp(0, maxSec.toInt())
        .toDouble();

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black26,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              // Botón Play / Pause
              IconButton(
                onPressed: _togglePlayPause,
                icon: Icon(
                  _isPlaying ? Icons.pause_circle_filled : Icons.play_circle_fill,
                  color: AppColors.amarillo,
                  size: 38,
                ),
              ),
              // Barra de reproducción
              Expanded(
                child: Column(
                  children: [
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        trackHeight: 3,
                        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                        activeTrackColor: AppColors.amarillo,
                        inactiveTrackColor: Colors.white24,
                        thumbColor: AppColors.amarillo,
                      ),
                      child: Slider(
                        value: currentSec,
                        max: maxSec,
                        onChanged: (val) async {
                          await _audioPlayer
                              .seek(Duration(milliseconds: val.toInt()));
                        },
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _formatTimeDuration(_currentPosition),
                            style: const TextStyle(color: Colors.white54, fontSize: 11),
                          ),
                          Text(
                            _formatTimeDuration(_totalDuration),
                            style: const TextStyle(color: Colors.white54, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              // Botón descartar
              IconButton(
                tooltip: 'Descartar y regrabar',
                onPressed: _deleteRecordedAudio,
                icon: const Icon(Icons.delete_outline_rounded,
                    color: Colors.white54, size: 22),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            const Icon(Icons.check_circle, color: AppColors.verdeExito, size: 14),
            const SizedBox(width: 6),
            const Expanded(
              child: Text(
                'Nota de voz lista. Se subirá al confirmar tu cita.',
                style: TextStyle(color: AppColors.verdeExito, fontSize: 12),
              ),
            ),
            TextButton(
              onPressed: _deleteRecordedAudio,
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: const Size(50, 24),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Regrabar',
                style: TextStyle(color: AppColors.amarillo, fontSize: 12),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
