import { IsString, IsUUID } from 'class-validator';

export class WorkAreaIdDto {
  @IsString()
  @IsUUID()
  id!: string;
}
