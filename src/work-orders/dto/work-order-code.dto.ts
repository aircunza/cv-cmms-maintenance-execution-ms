import { IsNotEmpty } from 'class-validator';

export class WorkOrderCodeDto {
  @IsNotEmpty()
  workOrderCode: number;
}
