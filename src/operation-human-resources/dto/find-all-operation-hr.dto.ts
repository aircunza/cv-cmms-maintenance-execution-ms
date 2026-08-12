import { IsOptional, IsString, IsIn } from 'class-validator';

export class FindAllOperationHrDto {
  @IsOptional()
  operationCode?: number;

  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  includeCanceled?: string;
}
