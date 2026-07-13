import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DailyLimitsService } from '../daily-limits/daily-limits.service';
import { CreateAttemptDto } from './dto/create-attempt.dto';

const CORRECT_XP = 3;
const INCORRECT_XP = -1;

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyLimits: DailyLimitsService,
  ) {}

  async submit(userId: string, dto: CreateAttemptDto) {
    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
    });
    if (!question) {
      throw new NotFoundException('Question not found.');
    }

    await this.dailyLimits.assertUnderLimit(userId, question.roundType);

    let selectedOption: string | null = null;
    let selfReportedCorrect: boolean | null = null;
    let xpEarned: number;
    let correct: boolean | null;

    if (question.scored) {
      if (!dto.selectedOption) {
        throw new BadRequestException(
          'selectedOption is required for this question.',
        );
      }
      selectedOption = dto.selectedOption;
      correct = dto.selectedOption === question.correctAnswer;
      xpEarned = correct ? CORRECT_XP : INCORRECT_XP;
    } else {
      if (dto.selfReportedCorrect === undefined) {
        throw new BadRequestException(
          'selfReportedCorrect is required for this question.',
        );
      }
      selfReportedCorrect = dto.selfReportedCorrect;
      correct = dto.selfReportedCorrect;
      xpEarned = 0;
    }

    const { attempt, xp } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const newXp = Math.max(0, user.xp + xpEarned);

      const attempt = await tx.attempt.create({
        data: {
          userId,
          questionId: dto.questionId,
          selectedOption,
          selfReportedCorrect,
          xpEarned,
        },
      });

      await tx.user.update({ where: { id: userId }, data: { xp: newXp } });

      return { attempt, xp: newXp };
    });

    return {
      id: attempt.id,
      questionId: attempt.questionId,
      selectedOption: attempt.selectedOption,
      selfReportedCorrect: attempt.selfReportedCorrect,
      xpEarned: attempt.xpEarned,
      attemptedAt: attempt.attemptedAt,
      correct,
      xp,
    };
  }
}
