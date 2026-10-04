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

  @IsString()
  @IsOptional()
  @MaxLength(255)
  attendedByTechnician?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  attendedByTechnicianName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  attendedBySupervisor?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  attendedBySupervisorName?: string;

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
