import { IsString, IsOptional, MaxLength, IsIn, IsInt } from 'class-validator';

export class UpdateWorkOrderDto {
  @IsString()
  @IsIn(['Y', 'N'])
  enableOracleWorkOrder: string;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  workOrderDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  workOrderType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  workOrderSubType?: string;

  @IsString()
  @IsOptional()
  @IsIn(['1', '2', '3', '4'])
  workOrderPriority?: string;

  @IsOptional()
  @IsInt()
  oldId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  addAttribute1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  addAttribute2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  addAttribute3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  addAttribute4?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  addAttribute5?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  addAttribute6?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  addAttribute7?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  addAttribute8?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  addAttribute9?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  addAttribute10?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  assignedToCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  assignedToName?: string;
}
