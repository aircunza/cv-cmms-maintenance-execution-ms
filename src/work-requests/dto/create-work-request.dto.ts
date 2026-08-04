import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateWorkRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  assetCode: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  assetShortDescription?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  issueDescription: string;

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

export class CreateWorkRequestMessageDto extends CreateWorkRequestDto {
  @IsUUID()
  actorId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  actorName: string;
}
