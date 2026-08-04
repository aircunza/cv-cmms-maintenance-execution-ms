import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateOperationMaterialDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  materialName?: string;

  @IsOptional()
  quantity?: number;

  @IsOptional()
  unitCost?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1)
  supplyType?: string;
}
