import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAttemptDto {
  @IsString()
  @MinLength(1)
  questionId: string;

  @IsOptional()
  @IsString()
  selectedOption?: string;

  @IsOptional()
  @IsBoolean()
  selfReportedCorrect?: boolean;
}
