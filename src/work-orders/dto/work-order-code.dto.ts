import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class WorkOrderCodeDto {
  @IsNotEmpty()
  workOrderCode: number | string;

  @IsString()
  @IsNotEmpty()
  organizationCode: string;

  @IsArray()
  @IsString({ each: true })
  userRoles: string[];
}
