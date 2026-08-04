import { IsString, IsOptional, IsNotEmpty, MaxLength, IsNumber } from 'class-validator';

export class CreateWoOperationDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  operationName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  operationDescription?: string;

  @IsOptional()
  operationSeqNumber?: number;

  @IsOptional()
  workOrderCode: number;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  assetCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  assetShortDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  unit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  subunit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  maintainableItem?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  operationCategory?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  operationStatus?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  operationType?: string;

  @IsOptional()
  plannedStartDate?: Date;

  @IsOptional()
  plannedCompletionDate?: Date;

  @IsOptional()
  actualStartDate?: Date;

  @IsOptional()
  actualCompletionDate?: Date;

  @IsOptional()
  plannedHours?: number;

  @IsOptional()
  actualHours?: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  workCenterCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  workCenterDescription?: string;

  @IsOptional()
  centerCostCode?: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  workAreaCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  workAreaDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  sector?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  subsector?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationCode: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  organizationName?: string;
}
