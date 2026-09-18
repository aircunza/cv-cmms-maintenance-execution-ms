import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';
import { CreateAssetsTreeDto } from './create-assets-tree.dto';

export class CreateAssetsTreeMessageDto extends CreateAssetsTreeDto {
  @IsUUID()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(70)
  actorName!: string;
}
