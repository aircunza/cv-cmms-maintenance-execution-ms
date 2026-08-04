import { IsOptional } from 'class-validator';

export class FindAllOperationHrDto {
  @IsOptional()
  operationCode?: number;
}
