import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SecuritySessionsService } from '../security-sessions.service';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '../../users/entities/user.entity';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly securitySessionsService: SecuritySessionsService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let userId = request.session?.userId as number | undefined;

    // Si no hay sesión (ej. aplicación móvil), intentamos validar el Token JWT
    if (!userId && request.headers.authorization?.startsWith('Bearer ')) {
      const token = request.headers.authorization.split(' ')[1];
      try {
        // Validamos el token "al vuelo" sin alterar la inyección de dependencias de NestJS
        const secret = process.env.JWT_SECRET || 'dev_jwt_secret';
        const payload = jwt.verify(token, secret) as any;
        userId = payload.sub;
        
        request.session = request.session || {};
        request.session.userId = userId;
        request.session.role = payload.role;
      } catch (e) {
        throw new UnauthorizedException('Token inválido o expirado');
      }
    }

    if (!userId) {
      return false;
    }

    const loginAt = request.session?.loginAt as number | undefined;
    if (this.securitySessionsService.isSessionRevoked(userId, loginAt)) {
      return false;
    }

    try {
      const user = await this.usersService.findById(userId);
      return user.estado === UserStatus.Activo;
    } catch {
      return false;
    }
  }
}
