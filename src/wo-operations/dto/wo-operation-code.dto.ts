import { IsNotEmpty } from 'class-validator';

export class WoOperationCodeDto {
  @IsNotEmpty()
  operationCode: number;
}
