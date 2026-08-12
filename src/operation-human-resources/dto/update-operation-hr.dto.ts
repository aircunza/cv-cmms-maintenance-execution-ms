import { IsString, IsOptional, MaxLength, IsDateString, IsNumber, Min } from 'class-validator';

export class UpdateOperationHrDto {
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  actualHours?: number;

  @IsOptional()
  @IsNumber()
  hourlyCost?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1)
  principalFlag?: string;

  @IsOptional()
  @IsDateString()
  actualStartDate?: string;

  @IsOptional()
  @IsDateString()
  actualCompletionDate?: string;

  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @IsOptional()
  @IsDateString()
  plannedCompletionDate?: string;
}
