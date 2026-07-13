import { Module } from '@nestjs/common';
import { DailyLimitsService } from './daily-limits.service';

@Module({
  providers: [DailyLimitsService],
  exports: [DailyLimitsService],
})
export class DailyLimitsModule {}
