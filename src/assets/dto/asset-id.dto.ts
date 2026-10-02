import { IsString, MaxLength } from 'class-validator';

export class AssetIdDto {
  @IsString()
  @MaxLength(80)
  assetCode!: string;
}
