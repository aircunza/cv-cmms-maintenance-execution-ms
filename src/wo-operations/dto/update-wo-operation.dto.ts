import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateWoOperationDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  operationName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  operationDescription?: string;

  @IsOptional()
  actualStartDate?: Date;

  @IsOptional()
  actualCompletionDate?: Date;

  @IsOptional()
  actualHours?: number;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  operationStatus?: string;
}
