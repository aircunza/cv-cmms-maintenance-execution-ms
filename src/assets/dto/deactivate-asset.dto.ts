import { IsString, MaxLength } from 'class-validator';

export class DeactivateAssetDto {
  @IsString()
  @MaxLength(80)
  assetCode!: string;

  @IsString()
  @MaxLength(12)
  actorCode!: string;
}
