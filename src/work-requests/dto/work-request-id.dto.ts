import { IsNotEmpty } from 'class-validator';

export class WorkRequestIdDto {
  @IsNotEmpty()
  requestId: number;
}
