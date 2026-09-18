import { IsInt, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { UpdateAssetsTreeDto } from './update-assets-tree.dto';

export class UpdateAssetsTreeMessageDto extends UpdateAssetsTreeDto {
  @IsInt()
  @IsNotEmpty()
  id!: number;

  @IsUUID()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  actorName!: string;
}
