import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuestionsService } from './questions.service';
import { GetQuestionsQueryDto } from './dto/get-questions-query.dto';

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get(':roundType')
  getBatch(
    @Param('roundType') roundType: string,
    @Query() query: GetQuestionsQueryDto,
  ) {
    return this.questionsService.getBatch(roundType, query.count ?? 10);
  }
}
