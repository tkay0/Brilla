import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DailyLimitsService } from '../daily-limits/daily-limits.service';
import { R2Service } from './r2.service';

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

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

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const extension = EXTENSION_BY_MIME_TYPE[file.mimetype] ?? 'jpg';
    const key = `avatars/${userId}/${randomUUID()}.${extension}`;
    const avatarUrl = await this.r2.uploadObject(key, file.buffer, file.mimetype);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

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
}
