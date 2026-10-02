import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateWorkAreaDto {
  @IsString()
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  workAreaDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1)
  isActive?: string;
}
