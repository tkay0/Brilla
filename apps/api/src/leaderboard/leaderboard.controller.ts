import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LeaderboardService } from './leaderboard.service';
import { GetLeaderboardQueryDto } from './dto/get-leaderboard-query.dto';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  get(
    @CurrentUser() user: { id: string },
    @Query() query: GetLeaderboardQueryDto,
  ) {
    return this.leaderboardService.getLeaderboard(user.id, query.limit ?? 20);
  }
}
