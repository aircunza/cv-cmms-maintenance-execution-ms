import { IsInt, IsOptional, Min } from "class-validator";
import { WoOperationFilterDto } from "./find-all-wo-operation.dto";

export class FindHumanResourcesPlainWoOperationDto {
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
}
