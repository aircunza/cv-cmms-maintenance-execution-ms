import { IsString, IsOptional, IsNotEmpty, MaxLength, IsNumber, IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateWoOperationResourceDto } from './create-wo-operation-resource.dto';

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
  actualStartDate?: Date;

  @IsOptional()
  actualCompletionDate?: Date;

  @IsOptional()
  actualHours?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateWoOperationResourceDto)
  resources?: CreateWoOperationResourceDto[];

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
