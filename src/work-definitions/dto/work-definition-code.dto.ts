import {
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class WorkDefinitionCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workDefinitionCode!: string;
}

export class WorkDefinitionReadDto extends WorkDefinitionCodeDto {
  @IsOptional()
  @IsString()
  organizationCode?: string;

  @IsArray()
  @IsString({ each: true })
  userRoles!: string[];
}

export class WorkDefinitionMessageDto extends WorkDefinitionReadDto {
  @IsUUID()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  actorName!: string;
}
