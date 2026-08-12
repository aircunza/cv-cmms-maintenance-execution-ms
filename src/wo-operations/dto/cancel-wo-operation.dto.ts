import { IsString, IsNotEmpty, MaxLength } from "class-validator";

export class CancelWoOperationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  canceledReason!: string;
}
