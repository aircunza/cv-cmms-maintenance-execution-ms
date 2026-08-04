import { IsString, IsOptional, MaxLength } from 'class-validator';

export class FindAllWorkOrderDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  assetCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  organizationCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  woStatusCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  workOrderType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  workOrderSubType?: string;
}
