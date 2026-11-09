import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class WoOperationFilterDto {
  @IsString()
  field: string;

  @IsString()
  operator: string;

  value: unknown;
}

export class FindAllWoOperationDto {
  @IsOptional()
  filters?: WoOperationFilterDto[];

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

  @IsOptional()
  workOrderCode?: number;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  assetCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  operationStatus?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  assignedToCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  assignedToName?: string;
}
