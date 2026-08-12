import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  Min,
  IsIn,
  IsDateString,
} from "class-validator";

export class CreateOperationHrDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  resourceCode!: string;

  @IsNumber()
  @Min(0.0001)
  actualHours!: number;

  @IsOptional()
  @IsNumber()
  hourlyCost?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1)
  @IsIn(["Y", "N"])
  principalFlag?: string;

  @IsNumber()
  @Min(0)
  resourceSequenceNumber!: number;

  @IsDateString()
  actualStartDate!: string;

  @IsDateString()
  actualCompletionDate!: string;

  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @IsOptional()
  @IsDateString()
  plannedCompletionDate?: string;
}
