import { IsEmail, IsString, MinLength, ValidateIf } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  schoolId: string;

  @ValidateIf((dto: RegisterDto) => !dto.email)
  @IsString()
  @MinLength(7)
  phone?: string;

  @ValidateIf((dto: RegisterDto) => !dto.phone)
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  password: string;
}
