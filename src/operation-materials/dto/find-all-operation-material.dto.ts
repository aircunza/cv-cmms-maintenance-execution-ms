import { IsOptional } from 'class-validator';

export class FindAllOperationMaterialDto {
  @IsOptional()
  operationCode?: number;
}
