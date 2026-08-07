import { IsString, IsOptional, IsNotEmpty, MaxLength, IsNumber, Min } from 'class-validator';

export class CreateOperationMaterialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  materialCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  materialName?: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @IsOptional()
  @IsNumber()
  totalCost?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1)
  supplyType?: string;

  @IsNumber()
  @Min(1)
  materialSequenceNumber: number;
}
