import {
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class WorkRequestIdDto {
  @IsNotEmpty()
  requestId!: number;
}

export class WorkRequestReadDto extends WorkRequestIdDto {
  @IsOptional()
  @IsString()
  organizationCode?: string;

  @IsArray()
  @IsString({ each: true })
  userRoles!: string[];
}

export class WorkRequestIdMessageDto extends WorkRequestReadDto {
  declare organizationCode: string;

  @IsArray()
  @IsString({ each: true })
  userPermissions!: string[];

  @IsUUID()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  actorName!: string;
}
