import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateAssetDto {
  @IsString()
  @MaxLength(80)
  assetCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  assetDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  assetShortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  assetStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  operationalHoursOrigin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationCode?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  workCenterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountingAccountCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  supervisorCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  assetDependency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  processTypeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subprocessTypeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  hierarchyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  assetClass?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  enabledMaintenanceProgram?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  enabledMaintenanceHoursControl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  enabledFinancialKpi?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  enabledTechnicalKpi?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  woAllowedFlag?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  enabledIiot?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sector?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  subsector?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  isActive?: string;

  @IsString()
  @MaxLength(12)
  actorCode!: string;
}
