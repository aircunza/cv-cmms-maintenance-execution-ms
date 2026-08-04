import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateWorkOrderDto {
  @IsString()
  @IsOptional()
  @MaxLength(240)
  workOrderDescription?: string;

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
  @MaxLength(30)
  workOrderPriority?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  woStatusCode?: string;

  @IsOptional()
  plannedStartDate?: Date;

  @IsOptional()
  plannedCompletionDate?: Date;

  @IsOptional()
  plannedHours?: number;

  @IsOptional()
  actualStartDate?: Date;

  @IsOptional()
  actualCompletionDate?: Date;

  @IsOptional()
  actualHours?: number;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  canceledReason?: string;

  @IsOptional()
  needByDate?: Date;
}
