import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class HumanResourceIdDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  resourceCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationCode: string;
}
