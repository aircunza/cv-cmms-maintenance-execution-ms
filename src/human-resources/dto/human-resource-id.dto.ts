import { IsString, IsOptional, MaxLength } from 'class-validator';

export class HumanResourceIdDto {
  @IsString()
  @MaxLength(255)
  resourceCode: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  organizationCode?: string;
}
