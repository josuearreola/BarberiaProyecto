import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 1. Obtener o generar token CSRF para la sesión actual
    let csrfToken = req.session ? (req.session as any).csrfToken : null;
    if (!csrfToken) {
      csrfToken = crypto.randomBytes(32).toString('hex');
      if (req.session) {
        (req.session as any).csrfToken = csrfToken;
      }
    }

    const sessionSameSite =
      (process.env.SESSION_SAME_SITE as 'lax' | 'strict' | 'none' | undefined) ||
      'lax';

    // 2. Establecer la cookie XSRF-TOKEN para que Angular la lea automáticamente
    // Angular busca esta cookie por defecto y la envía de vuelta en la cabecera 'X-XSRF-TOKEN'
    res.cookie('XSRF-TOKEN', csrfToken, {
      httpOnly: false, // Debe ser false para que Angular pueda leerla desde JS
      sameSite: sessionSameSite,
      secure: sessionSameSite === 'none' ? true : (process.env.NODE_ENV === 'production'),
      path: '/',
    });

    // 3. Validar peticiones de modificación (POST, PUT, PATCH, DELETE)
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    
    // Bypass para aplicaciones móviles y dispositivos inteligentes
    const isAppClient = req.headers['x-app-client'] === 'barberia-smart-device';

    if (!safeMethods.includes(req.method) && !isAppClient) {
      const headerToken = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
      const bodyToken = req.body ? req.body._csrf : null;

      const receivedToken = headerToken || bodyToken;

      if (!receivedToken || receivedToken !== csrfToken) {
        res.status(403).json({
          statusCode: 403,
          message: 'Error de validación CSRF. Petición no autorizada.',
          error: 'Forbidden',
        });
        return;
      }
    }

    next();
  }
}
