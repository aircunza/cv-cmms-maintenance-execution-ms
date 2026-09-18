import { IsString, IsOptional, MaxLength } from 'class-validator';

export class FindAllAssetsTreeDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  assetCode?: string;
}
