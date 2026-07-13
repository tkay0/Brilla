import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { QuestionsModule } from './questions/questions.module';
import { AttemptsModule } from './attempts/attempts.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { ProfileModule } from './profile/profile.module';
import { SchoolsModule } from './schools/schools.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    QuestionsModule,
    AttemptsModule,
    LeaderboardModule,
    ProfileModule,
    SchoolsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
