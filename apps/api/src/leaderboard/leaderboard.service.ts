import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(userId: string, limit: number) {
    const [topUsers, currentUser] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: [{ xp: 'desc' }, { id: 'asc' }],
        take: limit,
        include: { school: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: { school: true },
      }),
    ]);

    const usersAbove = await this.prisma.user.count({
      where: {
        OR: [
          { xp: { gt: currentUser.xp } },
          { xp: currentUser.xp, id: { lt: currentUser.id } },
        ],
      },
    });

    return {
      leaderboard: topUsers.map((user, index) => ({
        rank: index + 1,
        id: user.id,
        name: user.name,
        school: user.school.name,
        xp: user.xp,
        avatarUrl: user.avatarUrl,
      })),
      me: {
        rank: usersAbove + 1,
        id: currentUser.id,
        name: currentUser.name,
        school: currentUser.school.name,
        xp: currentUser.xp,
        avatarUrl: currentUser.avatarUrl,
      },
    };
  }
}
