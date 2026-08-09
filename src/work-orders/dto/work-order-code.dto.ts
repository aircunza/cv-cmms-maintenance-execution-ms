import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class WorkOrderCodeDto {
  @IsNotEmpty()
  workOrderCode: number | string;

  @IsString()
  @IsNotEmpty()
  organizationCode: string;

  @IsArray()
  @IsString({ each: true })
  userRoles: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  userPermissions?: string[];
}
