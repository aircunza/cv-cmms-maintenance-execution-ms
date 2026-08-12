import { IsString, IsNotEmpty, MaxLength } from "class-validator";

export class CancelOperationHrDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  canceledReason!: string;
}
