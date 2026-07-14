import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DailyLimitsService } from '../daily-limits/daily-limits.service';
import { R2Service } from './r2.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

// The only subjects questions are classified into (see prisma/schema.prisma Question.subject).
const SUBJECTS = ['Physics', 'Biology', 'Chemistry', 'Maths'] as const;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

type UserRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  schoolId: string;
  xp: number;
  coinBalance: number;
  avatarUrl: string | null;
};

function toUserDto(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    schoolId: user.schoolId,
    xp: user.xp,
    coinBalance: user.coinBalance,
    avatarUrl: user.avatarUrl,
  };
}

// A day "counts" toward the streak if the user made at least one attempt on it. The
// streak is current (not best-ever): it must include today or yesterday to be nonzero,
// and breaks on the first missed day walking backward from there.
function computeCurrentStreak(attemptDates: Date[]): number {
  const days = new Set(attemptDates.map((date) => date.toISOString().slice(0, 10)));

  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) {
      return 0;
    }
  }

  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly dailyLimits: DailyLimitsService,
  ) {}

  async getLimits(userId: string) {
    return this.dailyLimits.getRemaining(userId);
  }

  async getStats(userId: string) {
    const [quizzesCompleted, attempts] = await Promise.all([
      this.prisma.attempt.count({ where: { userId } }),
      this.prisma.attempt.findMany({
        where: { userId },
        select: { attemptedAt: true },
      }),
    ]);

    return {
      quizzesCompleted,
      currentStreak: computeCurrentStreak(attempts.map((attempt) => attempt.attemptedAt)),
    };
  }

  async getSubjectStats(userId: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: { userId, question: { subject: { not: null } } },
      select: {
        selectedOption: true,
        selfReportedCorrect: true,
        question: { select: { subject: true, correctAnswer: true } },
      },
    });

    // Always report all four subjects, even with zero attempts, so a new user sees a
    // full 0% breakdown rather than an empty list.
    const totals = new Map<string, { correct: number; total: number }>(
      SUBJECTS.map((subject) => [subject, { correct: 0, total: 0 }]),
    );
    for (const attempt of attempts) {
      const subject = attempt.question.subject as string;
      const correct =
        attempt.selectedOption !== null
          ? attempt.selectedOption === attempt.question.correctAnswer
          : (attempt.selfReportedCorrect ?? false);

      const entry = totals.get(subject) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (correct) entry.correct += 1;
      totals.set(subject, entry);
    }

    return Array.from(totals.entries())
      .map(([subject, { correct, total }]) => ({
        subject,
        accuracy: total === 0 ? 0 : Math.round((correct / total) * 100),
        attempts: total,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.schoolId) {
      const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
      if (!school) {
        throw new BadRequestException('Unknown schoolId.');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.schoolId !== undefined ? { schoolId: dto.schoolId } : {}),
      },
    });

    return toUserDto(user);
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const extension = EXTENSION_BY_MIME_TYPE[file.mimetype] ?? 'jpg';
    const key = `avatars/${userId}/${randomUUID()}.${extension}`;
    const avatarUrl = await this.r2.uploadObject(key, file.buffer, file.mimetype);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return toUserDto(user);
  }
}
