import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsArray,
} from "class-validator";

export const WR_FIND_ALL_OPERATORS = ["eq", "like", "gt", "lt", "in"] as const;
export type WorkRequestFindAllOperator = (typeof WR_FIND_ALL_OPERATORS)[number];

export class WorkRequestFilterDto {
  @IsString()
  field!: string;

  @IsString()
  operator!: WorkRequestFindAllOperator;

  value!: unknown;
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationCode!: string;

  @IsArray()
  @IsString({ each: true })
  userRoles!: string[];
}
