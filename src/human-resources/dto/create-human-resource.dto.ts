import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateHumanResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  resourceCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  resourceName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  resourceType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationCode: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  organizationName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  availabilityStatus: string;

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
