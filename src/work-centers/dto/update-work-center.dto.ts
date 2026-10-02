import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateWorkCenterDto {
  @IsString()
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  workCenterDescription?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  workAreaId?: string;

  @IsOptional()
  @IsInt()
  centerCostCode?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  centerCostDescription?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  isActive?: string;
}
