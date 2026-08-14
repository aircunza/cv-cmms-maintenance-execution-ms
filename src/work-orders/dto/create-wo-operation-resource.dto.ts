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

export class CreateWoOperationResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  resourceCode!: string;

  @IsNumber()
  @Min(0)
  resourceSequenceNumber!: number;

  @IsNumber()
  @Min(0.0001)
  actualHours!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1)
  @IsIn(["Y", "N"])
  principalFlag!: string;

  @IsDateString()
  actualStartDate!: string;

  @IsDateString()
  actualCompletionDate!: string;

  @IsOptional()
  @IsNumber()
  hourlyCost?: number;
}
