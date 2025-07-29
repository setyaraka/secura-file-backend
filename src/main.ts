import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { config } from 'dotenv'
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const rawOrigins = process.env.CORS_ORIGIN || '';
  const corsOrigins = rawOrigins.split(',').map(origin => origin.trim());
  
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  })

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
        },
        reportOnly: process.env.NODE_ENV !== 'production',
      }
    })
  )

  app.use(
    rateLimit({
      windowMs: 10 * 60 * 1000, // 10 menit
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests detected from your IP address. Access has been temporarily limited. Please try again later.',
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
