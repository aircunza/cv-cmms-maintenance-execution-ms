import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsIn,
  MaxLength,
  IsArray,
} from "class-validator";

export class UpdateWorkDefinitionMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workDefinitionCode!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(["Y", "N"])
  isActive!: string;

  @IsUUID()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  actorName!: string;

  @IsArray()
  @IsString({ each: true })
  userRoles!: string[];
}
