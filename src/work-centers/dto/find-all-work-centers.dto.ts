import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class FindAllWorkCentersDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  workCenterCode?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  workAreaId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  isActive?: string;
}
