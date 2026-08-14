import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
  IsArray,
  IsIn,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateWoOperationDto } from "./create-wo-operation.dto";

const VALID_TYPE_SUBTYPE_COMBOS = [
  { workOrderType: "Planned", workOrderSubType: "Preventive" },
  { workOrderType: "Planned", workOrderSubType: "Corrective" },
  { workOrderType: "Planned", workOrderSubType: "Inspection" },
  { workOrderType: "Planned", workOrderSubType: "TPM" },
  { workOrderType: "Not Planned", workOrderSubType: "Emergency" },
];

export function isValidTypeSubtypeCombination(
  type: string,
  subType: string,
): boolean {
  return VALID_TYPE_SUBTYPE_COMBOS.some(
    (combo) =>
      combo.workOrderType === type && combo.workOrderSubType === subType,
  );
}

export class CreateWorkOrderDto {
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
}
