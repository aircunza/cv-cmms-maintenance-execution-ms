import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkAreaDto {
  @IsString()
  @MaxLength(255)
  workAreaCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  workAreaDescription?: string;

  @IsString()
  @MaxLength(255)
  organizationCode!: string;
}
