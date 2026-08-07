import { IsString, IsOptional, IsNotEmpty, MaxLength, IsNumber, Min, ValidateNested, IsArray, IsDateString, MinLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateWoOperationResourceDto } from './create-wo-operation-resource.dto';
import { CreateWoOperationMaterialDto } from './create-wo-operation-material.dto';

export class CreateWoOperationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  operationName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  operationDescription: string;

  @IsNumber()
  @Min(1)
  operationSeqNumber: number;

  @IsString()
  @IsNotEmpty()
  createdBy: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  operationStatus: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @IsIn(['Internal', 'Supplier'])
  operationType: string;

  @IsDateString()
  actualStartDate: string;

  @IsDateString()
  actualCompletionDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  operationSubType: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWoOperationResourceDto)
  workOrderOperationResource: CreateWoOperationResourceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWoOperationMaterialDto)
  workOrderOperationMaterial?: CreateWoOperationMaterialDto[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  subunit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  maintainableItem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  operationCategory?: string;
}
