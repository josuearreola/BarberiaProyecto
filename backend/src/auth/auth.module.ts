import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { MailService } from './mail.service';
import { SecuritySessionsService } from './security-sessions.service';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'dev_jwt_secret',
      }),
    }),
  ],
  providers: [
    AuthService,
    MailService,
    SecuritySessionsService,
    SessionAuthGuard,
    RolesGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, SessionAuthGuard, RolesGuard, SecuritySessionsService],
})
export class AuthModule {}
