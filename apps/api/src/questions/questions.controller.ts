import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { QuestionsService } from './questions.service';
import { GetQuestionsQueryDto } from './dto/get-questions-query.dto';

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get(':roundType')
  getBatch(
    @CurrentUser() user: { id: string },
    @Param('roundType') roundType: string,
    @Query() query: GetQuestionsQueryDto,
  ) {
    return this.questionsService.getBatch(user.id, roundType, query.count ?? 10);
  }
}
