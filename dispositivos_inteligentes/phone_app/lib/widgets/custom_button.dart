import 'package:flutter/material.dart';
import '../theme.dart';

enum CustomButtonState { normal, disabled, loading, success, error }

class CustomButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final CustomButtonState state;
  final bool isSecondary;
  final IconData? icon;

  const CustomButton({
    super.key,
    required this.text,
    required this.onPressed,
    this.state = CustomButtonState.normal,
    this.isSecondary = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    Color backgroundColor;
    Color textColor;
    Widget content;

    switch (state) {
      case CustomButtonState.disabled:
        backgroundColor = AppColors.grisClaro.withOpacity(0.3);
        textColor = AppColors.grisClaro;
        content = _buildTextContent(textColor, theme);
        break;
        
      case CustomButtonState.loading:
        backgroundColor = isSecondary ? AppColors.azulOscuro : AppColors.amarillo;
        textColor = isSecondary ? AppColors.blanco : AppColors.negro;
        content = SizedBox(
          height: 24,
          width: 24,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            valueColor: AlwaysStoppedAnimation<Color>(textColor),
          ),
        );
        break;

      case CustomButtonState.success:
        backgroundColor = AppColors.verdeExito;
        textColor = AppColors.blanco;
        content = Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_outline, color: AppColors.blanco),
            const SizedBox(width: 8),
            Text(
              '¡Éxito!',
              style: theme.textTheme.labelLarge?.copyWith(color: textColor),
            ),
          ],
        );
        break;

      case CustomButtonState.error:
        backgroundColor = AppColors.rojo;
        textColor = AppColors.blanco;
        content = Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.blanco),
            const SizedBox(width: 8),
            Text(
              'Error',
              style: theme.textTheme.labelLarge?.copyWith(color: textColor),
            ),
          ],
        );
        break;

      case CustomButtonState.normal:
      default:
        backgroundColor = isSecondary ? AppColors.azulOscuro : AppColors.amarillo;
        textColor = isSecondary ? AppColors.blanco : AppColors.negro;
        content = icon != null 
          ? Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: textColor),
                const SizedBox(width: 8),
                _buildTextContent(textColor, theme),
              ],
            )
          : _buildTextContent(textColor, theme);
        break;
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      height: 50,
      width: double.infinity,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor,
          disabledBackgroundColor: backgroundColor,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          elevation: state == CustomButtonState.disabled ? 0 : 2,
        ),
        onPressed: (state == CustomButtonState.normal && onPressed != null) 
            ? onPressed 
            : null,
        child: content,
      ),
    );
  }

  Widget _buildTextContent(Color textColor, ThemeData theme) {
    return Text(
      text,
      style: theme.textTheme.labelLarge?.copyWith(color: textColor),
    );
  }
}
