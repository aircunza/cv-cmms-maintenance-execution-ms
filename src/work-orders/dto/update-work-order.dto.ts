import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

export class UpdateWorkOrderDto {
  @IsString()
  @IsIn(['Y', 'N'])
  enableOracleWorkOrder: string;

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
  @IsIn(['1', '2', '3', '4'])
  workOrderPriority?: string;
}
