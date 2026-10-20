import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('AgroHack API')
    .setDescription('API Central para Gestão Inteligente de Insumos Rurais (IFRO 2026/2)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 AgroHack API rodando em http://localhost:${port}`);
  console.log(`📚 Swagger disponível em http://localhost:${port}/api/docs`);
}

bootstrap();
