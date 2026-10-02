import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class FindAllAssetsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  assetCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  supervisorCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  assetStatus?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  isActive?: string;
}
