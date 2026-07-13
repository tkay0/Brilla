import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoundType } from '../../generated/prisma/enums.js';

export const DAILY_LIMIT = 20;

export const LIMITED_ROUND_TYPES: readonly RoundType[] = [
  RoundType.SpeedRace,
  RoundType.TrueFalse,
  RoundType.Riddle,
];

function isLimitedRoundType(roundType: RoundType): boolean {
  return (LIMITED_ROUND_TYPES as RoundType[]).includes(roundType);
}

function todayRangeUtc(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

@Injectable()
export class DailyLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  private async countToday(userId: string, roundType: RoundType): Promise<number> {
    const { start, end } = todayRangeUtc();
    return this.prisma.attempt.count({
      where: {
        userId,
        attemptedAt: { gte: start, lt: end },
        question: { roundType },
      },
    });
  }

  async getRemaining(userId: string): Promise<Record<string, number>> {
    const counts = await Promise.all(
      LIMITED_ROUND_TYPES.map((roundType) => this.countToday(userId, roundType)),
    );

    const remaining: Record<string, number> = {};
    LIMITED_ROUND_TYPES.forEach((roundType, index) => {
      remaining[roundType] = Math.max(0, DAILY_LIMIT - counts[index]);
    });
    return remaining;
  }

  async assertUnderLimit(userId: string, roundType: RoundType): Promise<void> {
    if (!isLimitedRoundType(roundType)) {
      return;
    }
    const count = await this.countToday(userId, roundType);
    if (count >= DAILY_LIMIT) {
      throw new ForbiddenException(
        `Daily limit of ${DAILY_LIMIT} ${roundType} questions reached. Try again tomorrow.`,
      );
    }
  }
}
