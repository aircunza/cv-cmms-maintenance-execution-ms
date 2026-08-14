import { IsString, IsOptional, MaxLength, IsNumber, Min, IsInt, MinLength } from 'class-validator';

export class CreateWoOperationResourceDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  resourceCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  resourceSequenceNumber?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  actualHours?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1)
  principalFlag?: string;

  @IsString()
  @IsOptional()
  actualStartDate?: string;

  @IsString()
  @IsOptional()
  actualCompletionDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyCost?: number;
}