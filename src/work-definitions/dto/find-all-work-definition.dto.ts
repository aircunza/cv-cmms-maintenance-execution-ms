import {
  IsString,
  IsOptional,
  MaxLength,
  IsArray,
} from "class-validator";

export const WD_FIND_ALL_OPERATORS = ["eq", "like", "gt", "lt", "in"] as const;
export type WorkDefinitionFindAllOperator =
  (typeof WD_FIND_ALL_OPERATORS)[number];

export class WorkDefinitionFilterDto {
  @IsString()
  field!: string;

  @IsString()
  operator!: WorkDefinitionFindAllOperator;

  value!: unknown;
}

export class FindAllWorkDefinitionDto {
  @IsOptional()
  filters?: WorkDefinitionFilterDto[];

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

  @IsArray()
  @IsString({ each: true })
  userRoles!: string[];
}
