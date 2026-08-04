import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateHumanResourceDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  resourceName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  resourceType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  organizationName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  availabilityStatus?: string;

  @IsOptional()
  supervisorId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(70)
  supervisorName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1)
  isActive?: string;
}
