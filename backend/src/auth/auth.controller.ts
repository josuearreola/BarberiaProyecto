import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenDto } from './dto/token.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async requestRegister(@Body() dto: RegisterDto) {
    return this.authService.requestRegistration(dto);
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

    return {
      ...user,
      accessToken: await this.authService.issueAccessToken(user),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request) {
    return new Promise<{ ok: boolean }>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(new Error('No se pudo cerrar la sesion'));
          return;
        }

        resolve({ ok: true });
      });
    });
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
}
