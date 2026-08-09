import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class WorkOrderFilterDto {
  @IsString()
  field: string;

  @IsString()
  operator: string;

  value: unknown;
}

export class FindAllWorkOrderDto {
  @IsOptional()
  filters?: WorkOrderFilterDto[];

  @IsOptional()
  order?: Array<[string, "ASC" | "DESC"]>;

  @IsOptional()
  @IsInt()
  @Min(0)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  userRoles?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(255)
  organizationCode?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  userPermissions?: string[];
}
