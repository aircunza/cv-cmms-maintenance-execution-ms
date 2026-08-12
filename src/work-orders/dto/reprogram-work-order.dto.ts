import { IsString, IsNotEmpty, IsDateString } from "class-validator";

export class ReprogramWorkOrderDto {
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  newActualStartDate!: string;
}
