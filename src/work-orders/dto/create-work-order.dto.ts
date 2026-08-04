import { IsString, IsOptional, IsNotEmpty, MaxLength, IsNumber } from 'class-validator';

export class CreateWorkOrderDto {
  @IsString()
  @IsOptional()
  @MaxLength(240)
  workOrderDescription?: string;

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
  @MaxLength(30)
  workOrderType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  workOrderSubType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(140)
  workDefinitionCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  workOrderPriority?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  woStatusCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  schedulingMethod?: string;

  @IsOptional()
  plannedStartDate?: Date;

  @IsOptional()
  plannedCompletionDate?: Date;

  @IsOptional()
  plannedHours?: number;

  @IsOptional()
  needByDate?: Date;

  @IsOptional()
  workRequestId?: number;

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
