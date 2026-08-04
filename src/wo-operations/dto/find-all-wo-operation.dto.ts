import { IsString, IsOptional, MaxLength } from 'class-validator';

export class FindAllWoOperationDto {
  @IsOptional()
  workOrderCode?: number;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  assetCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  operationStatus?: string;
}
