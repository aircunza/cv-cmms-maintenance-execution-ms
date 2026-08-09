import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsIn,
  MaxLength,
  IsArray,
} from "class-validator";

export class CreateWorkRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  assetCode!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  assetShortDescription?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  issueDescription!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(["Y", "N"])
  enableOracleWorkOrder!: string;
}

export class CreateWorkRequestMessageDto extends CreateWorkRequestDto {
  @IsUUID()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  actorName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationCode!: string;

  @IsArray()
  @IsString({ each: true })
  userPermissions!: string[];

  @IsArray()
  @IsString({ each: true })
  userRoles!: string[];
}
