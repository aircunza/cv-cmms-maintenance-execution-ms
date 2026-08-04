import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateOperationHrDto {
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
  plannedStartDate?: Date;

  @IsOptional()
  plannedCompletionDate?: Date;

  @IsOptional()
  usageRate?: number;
}
