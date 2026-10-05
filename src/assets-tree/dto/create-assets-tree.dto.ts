import { IsString, IsNotEmpty, MaxLength, IsInt, IsOptional } from 'class-validator';

export class CreateAssetsTreeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  assetCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(370)
  unit!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(370)
  subunit!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(370)
  maintainableItem!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sparePartCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sparePartName!: string;

  @IsInt()
  @IsOptional()
  itemPosition?: number;
}
