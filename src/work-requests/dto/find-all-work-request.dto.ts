import { IsString, IsOptional, MaxLength } from "class-validator";

export const WR_FIND_ALL_OPERATORS = ["eq", "like", "gt", "lt", "in"] as const;
export type WorkRequestFindAllOperator = (typeof WR_FIND_ALL_OPERATORS)[number];

export class WorkRequestFilterDto {
  @IsString()
  field: string;

  @IsString()
  operator: WorkRequestFindAllOperator;

  value: unknown;
}

export class FindAllWorkRequestDto {
  @IsOptional()
  filters?: WorkRequestFilterDto[];

  @IsOptional()
  order?: Array<[string, "ASC" | "DESC"]>;

  @IsOptional()
  limit?: number;

  @IsOptional()
  offset?: number;

  // Legacy fields are preserved for backwards compatibility with existing callers.
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
  statusCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  workAreaCode?: string;
}
