import { IsNotEmpty } from 'class-validator';

export class AssetsTreeIdDto {
  @IsNotEmpty()
  id!: number;
}
