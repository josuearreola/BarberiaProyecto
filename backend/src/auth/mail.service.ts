import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend?: Resend;

  private readonly fromAddress: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY?.trim();

    // En modo local/dev puede que no exista RESEND_API_KEY.
    // Para que el backend pueda arrancar y el frontend funcione,
    // deshabilitamos el envío de emails si falta la configuración.
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY no configurada. Se deshabilita el envío de correos en modo local/dev.',
      );
      this.resend = undefined;

      this.fromAddress = process.env.RESEND_FROM ?? 'onboarding@resend.dev';
      return;
    }

    this.resend = new Resend(apiKey);
    this.fromAddress = process.env.RESEND_FROM ?? 'onboarding@resend.dev';
    this.logger.log(`MailService inicializado con dominio: ${this.fromAddress}`);
  }


  async sendRegistrationVerification(email: string, verifyUrl: string): Promise<void> {
    if (!this.resend) return;

    const subject = 'Confirma tu cuenta en Barberia';
    const html = [
      '<h2>Confirma tu cuenta</h2>',
      '<p>Recibimos una solicitud de registro. Para activar tu cuenta, confirma tu correo:</p>',
      `<p><a href="${verifyUrl}">Confirmar mi cuenta</a></p>`,
      '<p>Si no fuiste tu, puedes ignorar este mensaje.</p>',
    ].join('');

    const text = [
      'Confirma tu cuenta en Barberia.',
      `Abre este enlace para confirmar tu cuenta: ${verifyUrl}`,
      'Si no fuiste tu, ignora este correo.',
    ].join('\n');

    await this.sendMail(email, subject, html, text);
  }

  async sendLoginAlert(
    email: string,
    details: {
      ip: string;
      userAgent: string;
      logoutEverywhereUrl: string;
    },
  ): Promise<void> {
    if (!this.resend) return;

    const subject = 'Nuevo inicio de sesion detectado';
    const html = [
      '<h2>Detectamos un inicio de sesion</h2>',
      `<p><strong>IP:</strong> ${details.ip}</p>`,
      `<p><strong>Dispositivo:</strong> ${details.userAgent}</p>`,
      '<p>Si fuiste tu, puedes ignorar este correo.</p>',
      `<p>Si no fuiste tu, protege tu cuenta ahora:</p><p><a href="${details.logoutEverywhereUrl}">Cerrar sesion en todos los dispositivos</a></p>`,
    ].join('');

    const text = [
      'Nuevo inicio de sesion detectado.',
      `IP: ${details.ip}`,
      `Dispositivo: ${details.userAgent}`,
      `Si no fuiste tu, cierra sesion en todos los dispositivos: ${details.logoutEverywhereUrl}`,
    ].join('\n');

    await this.sendMail(email, subject, html, text);
  }

  private async sendMail(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    if (!this.resend) return;

    try {
      const result = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
        text,
      });

      if (result.error) {
        this.logger.error(
          `Resend error enviando a ${to}: ${JSON.stringify(result.error)}`,
        );
        throw new InternalServerErrorException(
          'No se pudo enviar el correo de verificacion.',
        );
      }

      this.logger.log(`Correo enviado exitosamente a ${to} (ID: ${result.data?.id})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`No se pudo enviar correo a ${to}: ${message}`);

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'No se pudo enviar el correo de verificacion.',
      );
    }
  }
}
