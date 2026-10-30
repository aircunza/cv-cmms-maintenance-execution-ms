import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

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

  @IsString()
  @IsOptional()
  @MaxLength(254)
  reviewedByCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(254)
  reviewedByName?: string;

  @IsOptional()
  reviewedAt?: Date;

  @IsString()
  @IsOptional()
  @MaxLength(254)
  reviewerComment?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1370)
  pendingTask?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  @IsIn(['RELEASED', 'COMPLETED', 'IN_PROCESS', 'UNRELEASED', 'ON_HOLD', 'CANCELED', 'NOT_DONE'])
  pendingTaskStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  assignedToCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  assignedToName?: string;
}
