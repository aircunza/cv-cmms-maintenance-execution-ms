import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateWorkCenterDto {
  @IsString()
  @MaxLength(255)
  workCenterCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  workCenterDescription?: string;

  @IsString()
  @IsUUID()
  workAreaId!: string;

  @IsInt()
  centerCostCode!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  centerCostDescription?: string;
}
