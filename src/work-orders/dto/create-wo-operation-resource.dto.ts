import { IsString, IsOptional, IsNotEmpty, MaxLength, IsNumber, Min, IsIn } from 'class-validator';

export class CreateWoOperationResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  resourceCode: string;

  @IsNumber()
  @Min(0)
  resourceSequenceNumber: number;

  @IsNumber()
  @Min(0.0001)
  plannedHours: number;

  @IsNumber()
  @Min(0.0001)
  actualHours: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1)
  @IsIn(['Y', 'N'])
  principalFlag: string;

  @IsOptional()
  @IsNumber()
  hourlyCost?: number;

  @IsOptional()
  plannedStartDate?: Date;

  @IsOptional()
  plannedCompletionDate?: Date;
}
