import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateAssetsTreeDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  assetCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(370)
  unit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(370)
  subunit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(370)
  maintainableItem?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  sparePartCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  sparePartName?: string;
}
