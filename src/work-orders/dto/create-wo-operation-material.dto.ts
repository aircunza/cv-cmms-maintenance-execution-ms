import { IsString, IsNotEmpty, MaxLength, IsNumber, Min } from 'class-validator';

export class CreateWoOperationMaterialDto {
  @IsNumber()
  @Min(1)
  materialSequenceNumber: number;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1)
  supplyType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  materialCode: string;
}
