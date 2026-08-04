import { IsString, IsOptional, MaxLength } from 'class-validator';

export class FindAllHumanResourceDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  organizationCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  resourceType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  availabilityStatus?: string;
}
