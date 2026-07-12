import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Either phone or email is required.');
    }

    const school = await this.prisma.school.findUnique({
      where: { id: dto.schoolId },
    });
    if (!school) {
      throw new BadRequestException('Unknown schoolId.');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.phone ? [{ phone: dto.phone }] : []),
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });
    if (existing) {
      throw new ConflictException(
        'An account with this phone or email already exists.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        schoolId: dto.schoolId,
        phone: dto.phone,
        email: dto.email,
        passwordHash,
      },
    });

    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: dto.identifier }, { email: dto.identifier }],
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.buildAuthResult(user);
  }

  private buildAuthResult(user: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    schoolId: string;
    xp: number;
    coinBalance: number;
  }) {
    const accessToken = this.jwtService.sign({ sub: user.id });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        schoolId: user.schoolId,
        xp: user.xp,
        coinBalance: user.coinBalance,
      },
    };
  }
}
