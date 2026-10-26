import {
  IsString,
  IsOptional,
  MaxLength,
  IsArray,
} from "class-validator";

export const ASSET_FIND_ALL_OPERATORS = ["eq", "like", "gt", "lt", "in"] as const;
export type AssetFindAllOperator = (typeof ASSET_FIND_ALL_OPERATORS)[number];

export class AssetFilterDto {
  @IsString()
  field!: string;

  @IsString()
  operator!: AssetFindAllOperator;

  value!: unknown;
}

export class FindAllAssetsDto {
  @IsOptional()
  filters?: AssetFilterDto[];

  @IsOptional()
  order?: Array<[string, "ASC" | "DESC"]>;

  @IsOptional()
  limit?: number;

  @IsOptional()
  offset?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationCode?: string;
}
