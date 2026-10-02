import { IsString, IsUUID } from 'class-validator';

export class WorkCenterIdDto {
  @IsString()
  @IsUUID()
  id!: string;
}
