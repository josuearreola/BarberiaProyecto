import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../users/audit-log.service';
import { RegisterDto } from './dto/register.dto';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { MailService } from './mail.service';
import { SecuritySessionsService } from './security-sessions.service';

type RegisterTokenPayload = {
  type: 'register';
  usuario: string;
  telefono: string;
  email: string;
  passwordHash: string;
  role: UserRole;
};

type SecurityLogoutTokenPayload = {
  type: 'security-logout-all';
  userId: number;
};

const bcryptClient = bcrypt as {
  hash(password: string, rounds: number): Promise<string>;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly securitySessionsService: SecuritySessionsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async requestRegistration(dto: RegisterDto) {
    // Registro directo (modo local/dev): guardar en BD inmediatamente.
    // Se deja el flujo de confirmación por email comentado para después.
    const role = this.resolveRole(dto.email);
    const passwordHash = await this.hashPassword(dto.password);

    await this.usersService.createWithPasswordHash({
      usuario: dto.usuario,
      telefono: dto.telefono,
      email: dto.email,
      passwordHash,
      role,
      // estado por defecto en createInternal es Activo
    });

    return {
      ok: true,
      message: 'Cuenta creada correctamente. Ya puedes iniciar sesion.',
    };

    // --- Flujo original con confirmación por email ---
    // const token = await this.jwtService.signAsync(
    //   {
    //     type: 'register',
    //     usuario: dto.usuario,
    //     telefono: dto.telefono,
    //     email: dto.email,
    //     passwordHash,
    //     role,
    //   } satisfies RegisterTokenPayload,
    //   {
    //     expiresIn: (process.env.REGISTER_TOKEN_EXPIRES_IN || '30m') as any,
    //   },
    // );
    // const verifyUrl = `${this.getBackendBaseUrl()}/api/auth/register/confirm?token=${encodeURIComponent(token)}`;
    // await this.mailService.sendRegistrationVerification(dto.email, verifyUrl);
  }

  async confirmRegistrationToken(token: string) {
    const payload = await this.verifyToken<RegisterTokenPayload>(token);
    if (payload.type !== 'register') {
      throw new BadRequestException('Token de verificacion invalido');
    }

    // Algunos proveedores de correo abren enlaces para escanearlos; si el
    // token ya creo la cuenta anteriormente, tratamos esta confirmacion como valida.
    const existingUser = await this.usersService.findByEmailWithPassword(
      payload.email,
    );

    if (existingUser) {
      if (existingUser.passwordHash !== payload.passwordHash) {
        throw new BadRequestException('El correo ya esta registrado');
      }

      const safeUser = this.usersService.sanitize(existingUser);
      return {
        user: safeUser,
        accessToken: await this.issueAccessToken(safeUser),
      };
    }

    const user = await this.usersService.createWithPasswordHash({
      usuario: payload.usuario,
      telefono: payload.telefono,
      email: payload.email,
      passwordHash: payload.passwordHash,
      role: payload.role,
    });

    return {
      user,
      accessToken: await this.issueAccessToken(user),
    };
  }

  async register(dto: RegisterDto) {
    const role = this.resolveRole(dto.email);

    return this.usersService.create({
      usuario: dto.usuario,
      telefono: dto.telefono,
      email: dto.email,
      password: dto.password,
      role,
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      const remainingTime = Math.ceil(
        (new Date(user.lockoutUntil).getTime() - new Date().getTime()) / 60000,
      );
      throw new UnauthorizedException(
        `Cuenta bloqueada temporalmente por seguridad. Intente de nuevo en ${remainingTime} minutos.`,
      );
    }

    if (user.estado !== UserStatus.Activo) {
      throw new UnauthorizedException('Usuario inactivo. Contacta al administrador.');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      const attempts = (user.failedAttempts || 0) + 1;
      if (attempts >= 5) {
        const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
        await this.usersService.update(user.id, {
          failedAttempts: 0,
          lockoutUntil,
        } as any);
        throw new UnauthorizedException(
          'Demasiados intentos fallidos. Su cuenta ha sido bloqueada por 15 minutos.',
        );
      } else {
        await this.usersService.update(user.id, {
          failedAttempts: attempts,
        } as any);
        throw new UnauthorizedException(
          `Credenciales invalidas. Intento ${attempts} de 5.`,
        );
      }
    }

    if (user.failedAttempts > 0 || user.lockoutUntil) {
      await this.usersService.update(user.id, {
        failedAttempts: 0,
        lockoutUntil: null,
      } as any);
    }

    return this.usersService.sanitize(user);
  }

  async notifyLogin(user: User, req: Request): Promise<void> {
    const token = await this.jwtService.signAsync(
      {
        type: 'security-logout-all',
        userId: user.id,
      } satisfies SecurityLogoutTokenPayload,
      {
        expiresIn: (process.env.SECURITY_LINK_EXPIRES_IN || '20m') as any,
      },
    );

    const logoutEverywhereUrl = `${this.getBackendBaseUrl()}/api/auth/security/logout-all?token=${encodeURIComponent(token)}`;
    const ip = this.getIp(req);
    const userAgent = String(req.headers['user-agent'] || 'Desconocido');

    try {
      await this.mailService.sendLoginAlert(user.email, {
        ip,
        userAgent,
        logoutEverywhereUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(
        `No se pudo enviar alerta de login a ${user.email}: ${message}`,
      );
    }
  }

  async revokeAllSessionsByToken(token: string) {
    const payload = await this.verifyToken<SecurityLogoutTokenPayload>(token);
    if (payload.type !== 'security-logout-all') {
      throw new BadRequestException('Token de seguridad invalido');
    }

    this.securitySessionsService.revokeAll(payload.userId);
    return { ok: true };
  }

  async issueAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
      },
      {
        expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as any,
      },
    );
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId);
    if (user.estado !== UserStatus.Activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    return user;
  }

  private async verifyToken<T extends object>(token: string): Promise<T> {
    try {
      return await this.jwtService.verifyAsync<T>(token);
    } catch {
      throw new BadRequestException('Token invalido o expirado');
    }
  }

  private resolveRole(email: string): UserRole {
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    return adminEmail && adminEmail === email.toLowerCase()
      ? UserRole.Admin
      : UserRole.Cliente;
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
    const safeRounds =
      Number.isFinite(saltRounds) && saltRounds >= 8 ? saltRounds : 10;

    return bcryptClient.hash(password, safeRounds);
  }

  private getBackendBaseUrl(): string {
    const envUrl = process.env.BACKEND_PUBLIC_URL?.trim();
    if (envUrl) {
      return envUrl;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'BACKEND_PUBLIC_URL no esta configurado para enlaces de seguridad',
      );
    }

    const port = process.env.PORT || '3000';
    return `http://localhost:${port}`;
  }

  private getIp(req: Request): string {
    const firstForwarded = req.headers['x-forwarded-for'];
    if (typeof firstForwarded === 'string' && firstForwarded.length > 0) {
      return firstForwarded.split(',')[0].trim();
    }

    return req.ip || 'desconocida';
  }
}
