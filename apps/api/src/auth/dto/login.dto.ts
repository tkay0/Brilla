import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** Either the phone number or email the user registered with. */
  @IsString()
  @MinLength(1)
  identifier: string;

  @IsString()
  @MinLength(1)
  password: string;
}
