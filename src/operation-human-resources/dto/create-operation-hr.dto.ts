import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateOperationHrDto {
  @IsNotEmpty()
  operationCode: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  resourceCode: string;

  @IsOptional()
  plannedHours?: number;

  @IsOptional()
  actualHours?: number;

  @IsOptional()
  hourlyCost?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1)
  principalFlag?: string;

  @IsOptional()
  resourceSequenceNumber?: number;

  @IsOptional()
  plannedStartDate?: Date;

  @IsOptional()
  plannedCompletionDate?: Date;

  @IsOptional()
  usageRate?: number;
}
