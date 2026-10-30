import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
  IsArray,
  IsIn,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateWoOperationDto } from "./create-wo-operation.dto";

export class CreateWorkOrderMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  workOrderDescription!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  woStatusCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  assetCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  workOrderType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  workOrderSubType!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(["1", "2", "3", "4"])
  workOrderPriority!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(["Y", "N"])
  enableOracleWorkOrder!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWoOperationDto)
  operations?: CreateWoOperationDto[];

  @IsOptional()
  workRequestId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  workDefinitionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  schedulingMethod?: string;

  @IsOptional()
  needByDate?: Date;

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

  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  actorName!: string;

  @IsString()
  @IsNotEmpty()
  organizationCode!: string;

  @IsArray()
  userPermissions!: string[];

  @IsArray()
  userRoles!: string[];
}
