import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DailyLimitsModule } from '../daily-limits/daily-limits.module';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';

@Module({
  imports: [AuthModule, DailyLimitsModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
})
export class AttemptsModule {}
