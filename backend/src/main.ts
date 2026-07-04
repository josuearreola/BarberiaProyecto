import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { Express } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (
    process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    'http://localhost:4200'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const sessionSecret = process.env.SESSION_SECRET;
  if (isProduction && !sessionSecret) {
    throw new Error('SESSION_SECRET is required in production');
  }

  const sessionSameSite =
    (process.env.SESSION_SAME_SITE as 'lax' | 'strict' | 'none' | undefined) ||
    'lax';

  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', 1);

  app.use(helmet());

  app.use(
    session({
      name: 'barbershop.sid',
      secret: sessionSecret || 'dev_session_secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: sessionSameSite,
        secure: sessionSameSite === 'none' ? true : isProduction,
        maxAge: 1000 * 60 * 60 * 8,
      },
    }),
  );

  // Habilitar CORS para el frontend
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Habilitar validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Servidor corriendo en http://localhost:${process.env.PORT ?? 3000}/api`,
  );
  console.log(`CORS habilitado para: ${allowedOrigins.join(', ')}`);
}
void bootstrap();
