import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsArray,
  IsUUID,
} from "class-validator";

export class UpdateWorkRequestMessageDto {
  @IsNotEmpty()
  requestId!: number;

  @IsString()
  @IsOptional()
  @MaxLength(240)
  issueDescription?: string;

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
