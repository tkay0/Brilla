import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DailyLimitsModule } from '../daily-limits/daily-limits.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { R2Service } from './r2.service';

@Module({
  imports: [AuthModule, DailyLimitsModule],
  controllers: [ProfileController],
  providers: [ProfileService, R2Service],
})
export class ProfileModule {}
