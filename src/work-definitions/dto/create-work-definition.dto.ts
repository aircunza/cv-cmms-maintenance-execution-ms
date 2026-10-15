import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsIn,
  MaxLength,
  IsArray,
} from "class-validator";

export class CreateWorkDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workDefinitionCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  workDefinitionDescription!: string;
}

export class CreateWorkDefinitionMessageDto extends CreateWorkDefinitionDto {
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
  userRoles!: string[];
}
