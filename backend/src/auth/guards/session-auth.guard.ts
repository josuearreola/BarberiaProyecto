import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
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
    const userId = request.session?.userId as number | undefined;
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
