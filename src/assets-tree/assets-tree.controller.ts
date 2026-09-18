import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AssetsTreeService } from './assets-tree.service';
import {
  CreateAssetsTreeMessageDto,
  UpdateAssetsTreeMessageDto,
  FindAllAssetsTreeDto,
  AssetsTreeIdDto,
} from './dto';

@Controller('assets-tree')
export class AssetsTreeController {
  constructor(private readonly assetsTreeService: AssetsTreeService) {}

  @MessagePattern('assets.tree.create')
  create(@Payload() dto: CreateAssetsTreeMessageDto) {
    return this.assetsTreeService.create(dto);
  }

  @MessagePattern('assets.tree.find.one')
  findOne(@Payload() dto: AssetsTreeIdDto) {
    return this.assetsTreeService.findOne(dto.id);
  }

  @MessagePattern('assets.tree.find.all')
  findAll(@Payload() dto: FindAllAssetsTreeDto = {}) {
    return this.assetsTreeService.findAll(dto);
  }

  @MessagePattern('assets.tree.update')
  update(@Payload() dto: UpdateAssetsTreeMessageDto) {
    return this.assetsTreeService.update(dto);
  }

  @MessagePattern('assets.tree.deactivate')
  deactivate(@Payload() dto: { id: number; actorId: string; actorName: string }) {
    return this.assetsTreeService.deactivate(dto.id, dto.actorId, dto.actorName);
  }
}
