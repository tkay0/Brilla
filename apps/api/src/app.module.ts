import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { QuestionsModule } from './questions/questions.module';
import { AttemptsModule } from './attempts/attempts.module';

@Module({
  imports: [PrismaModule, AuthModule, QuestionsModule, AttemptsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
