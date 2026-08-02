import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppointmentsModule } from './appointments/appointments.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CsrfMiddleware } from './auth/csrf.middleware';
import { GatewayModule } from './gateway.module';
import { ServiciosModule } from './servicios/servicios.module';
import { PromocionesModule } from './promociones/promociones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL') || '';
        if (!databaseUrl) {
          throw new Error('DATABASE_URL no configurada');
        }

        const url = new URL(databaseUrl);
        const user = decodeURIComponent(url.username);
        const password = decodeURIComponent(url.password);
        const host = url.hostname;
        const port = url.port ? Number(url.port) : undefined;
        const database = url.pathname.replace(/^\//, '');

        const query = url.searchParams;
        const sslMode = query.get('sslmode');

        return {
          type: 'postgres' as const,
          host,
          port,
          username: user,
          password,
          database,
          autoLoadEntities: true,
          synchronize: false,
          ssl: sslMode === 'require' ? { rejectUnauthorized: false } : false,
          logging: false,
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),
    GatewayModule,
    AppointmentsModule,
    UsersModule,
    AuthModule,
    ServiciosModule,
    PromocionesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
