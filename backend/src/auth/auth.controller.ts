import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Post,
  Patch,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenDto } from './dto/token.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { AuditLogService } from '../users/audit-log.service';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async requestRegister(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.authService.requestRegistration(dto);
    await this.auditLogService.log(dto.usuario, 'Alta de usuario (auto-registro)', this.getIp(req));
    return result;
  }

  @Get('register/confirm')
  async confirmRegister(
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:4200';

    if (!token) {
      res.redirect(`${frontendBase}/registro?verified=0`);
      return;
    }

    try {
      const { user } = await this.authService.confirmRegistrationToken(token);
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.loginAt = Date.now();
      await this.auditLogService.log(user.usuario, 'Confirmación de registro', this.getIp(req));
      res.redirect(`${frontendBase}/login?verified=1`);
    } catch {
      res.redirect(`${frontendBase}/registro?verified=0`);
    }
  }

  @Post('register/confirm')
  async confirmRegisterByBody(@Body() dto: TokenDto, @Req() req: Request) {
    const { user, accessToken } = await this.authService.confirmRegistrationToken(
      dto.token,
    );

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.loginAt = Date.now();
    await this.auditLogService.log(user.usuario, 'Confirmación de registro', this.getIp(req));

    return {
      ...user,
      accessToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.loginAt = Date.now();

    await this.authService.notifyLogin(user, req);
    await this.auditLogService.log(user.usuario, 'Inicio de sesión', this.getIp(req));

    return {
      ...user,
      accessToken: await this.authService.issueAccessToken(user),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request) {
    const userId = req.session.userId;
    let usuario = 'Desconocido';
    if (userId) {
      try {
        const u = await this.usersService.findById(userId);
        usuario = u.usuario;
      } catch {}
    }

    const ip = this.getIp(req);
    return new Promise<{ ok: boolean }>((resolve, reject) => {
      req.session.destroy(async (err) => {
        if (err) {
          reject(new Error('No se pudo cerrar la sesion'));
          return;
        }

        await this.auditLogService.log(usuario, 'Cierre de sesión', ip);
        resolve({ ok: true });
      });
    });
  }

  @Patch('profile')
  @UseGuards(SessionAuthGuard)
  async updateProfile(@Req() req: Request, @Body() body: any) {
    const userId = req.session.userId!;
    const user = await this.usersService.update(userId, body);
    await this.auditLogService.log(user.usuario, 'Cambio de perfil (propio)', this.getIp(req));
    return user;
  }

  @Post('change-password')
  @UseGuards(SessionAuthGuard)
  async changePassword(
    @Req() req: Request,
    @Body() body: { contrasenaActual: string; contrasenaNueva: string },
  ) {
    const userId = req.session.userId!;
    const user = await this.usersService.findById(userId);

    // Validar contraseña actual
    const valid = await this.usersService.validatePassword(user.email, body.contrasenaActual);
    if (!valid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    // Validar políticas de contraseña segura
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!regex.test(body.contrasenaNueva)) {
      throw new UnauthorizedException(
        'La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.',
      );
    }

    await this.usersService.updatePassword(userId, body.contrasenaNueva);
    await this.auditLogService.log(user.usuario, 'Cambio de contraseña (propio)', this.getIp(req));
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const userId = req.session.userId;
    if (!userId) {
      return null;
    }

    try {
      return await this.authService.getProfile(userId);
    } catch {
      return null;
    }
  }

  @Get('token')
  @UseGuards(SessionAuthGuard)
  async sessionToken(@Req() req: Request) {
    const user = await this.authService.getProfile(req.session.userId!);
    return {
      accessToken: await this.authService.issueAccessToken(user),
    };
  }

  @Get('security/logout-all')
  async logoutAllByLink(@Query('token') token: string, @Res() res: Response) {
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:4200';

    if (!token) {
      res.redirect(`${frontendBase}/login?security=invalid`);
      return;
    }

    try {
      await this.authService.revokeAllSessionsByToken(token);
      res.redirect(`${frontendBase}/login?security=done`);
    } catch {
      res.redirect(`${frontendBase}/login?security=invalid`);
    }
  }

  @Post('security/logout-all')
  async logoutAllByBody(@Body() dto: TokenDto) {
    return this.authService.revokeAllSessionsByToken(dto.token);
  }

  private getIp(req: Request): string {
    const firstForwarded = req.headers['x-forwarded-for'];
    if (typeof firstForwarded === 'string' && firstForwarded.length > 0) {
      return firstForwarded.split(',')[0].trim();
    }
    return req.ip || 'desconocida';
  }
}
