import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoundType } from '../generated/prisma/enums.js';

describe('Daily round-type limits (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let token: string;
  let userId: string;
  let schoolId: string;
  const speedRaceQuestionIds: string[] = [];
  const trueFalseQuestionId = `dl-test-tf-${randomUUID()}`;
  const riddleQuestionId = `dl-test-riddle-${randomUUID()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);

    const school = await prisma.school.create({
      data: { name: `Daily Limit Test School ${randomUUID()}`, region: 'Test' },
    });
    schoolId = school.id;

    const user = await prisma.user.create({
      data: {
        name: 'Daily Limit Test User',
        email: `daily-limit-${randomUUID()}@example.com`,
        schoolId,
      },
    });
    userId = user.id;
    token = jwtService.sign({ sub: user.id });

    for (let i = 0; i < 21; i++) {
      const question = await prisma.question.create({
        data: {
          id: `dl-test-sr-${i}-${randomUUID()}`,
          roundType: RoundType.SpeedRace,
          sourceFile: 'test',
          questionText: `SpeedRace question ${i}`,
          correctAnswer: 'A',
          options: ['A', 'B'],
          scored: true,
        },
      });
      speedRaceQuestionIds.push(question.id);
    }

    await prisma.question.create({
      data: {
        id: trueFalseQuestionId,
        roundType: RoundType.TrueFalse,
        sourceFile: 'test',
        questionText: 'TrueFalse question',
        correctAnswer: 'true',
        options: ['true', 'false'],
        scored: true,
      },
    });

    await prisma.question.create({
      data: {
        id: riddleQuestionId,
        roundType: RoundType.Riddle,
        sourceFile: 'test',
        questionText: 'Riddle question',
        correctAnswer: 'answer',
        scored: false,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.attempt.deleteMany({ where: { userId } });
    await prisma.question.deleteMany({
      where: {
        id: { in: [...speedRaceQuestionIds, trueFalseQuestionId, riddleQuestionId] },
      },
    });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await app.close();
  }, 30000);

  it('allows 20 SpeedRace attempts then rejects the 21st with 403', async () => {
    for (let i = 0; i < 20; i++) {
      await request(app.getHttpServer())
        .post('/attempts')
        .set('Authorization', `Bearer ${token}`)
        .send({ questionId: speedRaceQuestionIds[i], selectedOption: 'A' })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/attempts')
      .set('Authorization', `Bearer ${token}`)
      .send({ questionId: speedRaceQuestionIds[20], selectedOption: 'A' })
      .expect(403);
  }, 120000);

  it('rejects GET /questions/SpeedRace once the daily limit is hit', async () => {
    await request(app.getHttpServer())
      .get('/questions/SpeedRace')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  }, 30000);

  it('leaves TrueFalse and Riddle unaffected', async () => {
    await request(app.getHttpServer())
      .post('/attempts')
      .set('Authorization', `Bearer ${token}`)
      .send({ questionId: trueFalseQuestionId, selectedOption: 'true' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/attempts')
      .set('Authorization', `Bearer ${token}`)
      .send({ questionId: riddleQuestionId, selfReportedCorrect: true })
      .expect(201);

    await request(app.getHttpServer())
      .get('/questions/TrueFalse')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/questions/Riddle')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  }, 30000);

  it('GET /profile/limits reflects remaining counts for each round type', async () => {
    const res = await request(app.getHttpServer())
      .get('/profile/limits')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      SpeedRace: 0,
      TrueFalse: 19,
      Riddle: 19,
    });
  }, 30000);
});
