import { IsString, IsOptional, MaxLength } from "class-validator";

export const WR_UPDATE_OPERATORS = ["eq", "in"] as const;
export type WorkRequestUpdateOperator = (typeof WR_UPDATE_OPERATORS)[number];

export class UpdateWorkRequestDataDto {
  @IsString()
  @IsOptional()
  @MaxLength(240)
  issueDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  statusCode?: string;
}

export class UpdateWorkRequestConditionDto {
  @IsString()
  field: string;

  @IsString()
  operator: WorkRequestUpdateOperator;

  value: unknown;
}

export class UpdateWorkRequestDto {
  @IsOptional()
  data?: UpdateWorkRequestDataDto;

  @IsOptional()
  condition?: UpdateWorkRequestConditionDto[];

  // Legacy fields are preserved for backwards compatibility with existing callers.
  @IsString()
  @IsOptional()
  @MaxLength(200)
  assetShortDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  issueDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  statusCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  workCenterCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  workCenterDescription?: string;

  @IsOptional()
  centerCostCode?: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  workAreaCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  workAreaDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  sector?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  subsector?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  organizationName?: string;
}
