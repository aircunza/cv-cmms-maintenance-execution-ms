import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateWoOperationDto {
  @IsString()
  @IsOptional()
  @MaxLength(600)
  operationName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  operationDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  operationStatus?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  operationType?: string;

  @IsOptional()
  assetTreeId?: number;

  @IsString()
  @IsOptional()
  @MaxLength(370)
  unit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(370)
  subunit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(370)
  maintainableItem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  specialtyType?: string;
}
