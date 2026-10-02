import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class FindAllWorkAreasDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  workAreaCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationCode?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  isActive?: string;
}
