import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Apply Helmet security headers (with CSP disabled to permit Swagger UI resources)
  app.use(helmet({ contentSecurityPolicy: false }));

  // Enable CORS from configuration environment
  const corsOrigin = configService.get<string>('cors.origin') || '*';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Global filters, interceptors and validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Setup Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('System Design Simulator API')
    .setDescription(
      'The API documentation for the System Design Simulator backend application.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  const swaggerPath = configService.get<string>('swagger.path') || 'api';
  SwaggerModule.setup(swaggerPath, app, document);

  const port = configService.get<number>('port') || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation is available at: http://localhost:${port}/${swaggerPath}`,
  );
}
bootstrap();
