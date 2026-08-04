import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { HumanResourcesService } from './human-resources.service';
import {
  CreateHumanResourceDto,
  UpdateHumanResourceDto,
  FindAllHumanResourceDto,
  HumanResourceIdDto,
} from './dto';

@Controller('human-resources')
export class HumanResourcesController {
  constructor(private readonly humanResourcesService: HumanResourcesService) {}

  @MessagePattern('human.resource.create')
  create(@Payload() dto: CreateHumanResourceDto & { actorId: string; actorName: string }) {
    return this.humanResourcesService.create(dto);
  }

  @MessagePattern('human.resource.find.one')
  findOne(@Payload() dto: HumanResourceIdDto) {
    return this.humanResourcesService.findOne(dto.resourceCode, dto.organizationCode);
  }

  @MessagePattern('human.resource.find.all')
  findAll(@Payload() dto: FindAllHumanResourceDto = {}) {
    return this.humanResourcesService.findAll(dto);
  }

  @MessagePattern('human.resource.update')
  update(@Payload() dto: UpdateHumanResourceDto & { resourceCode: string; organizationCode: string; actorId: string; actorName: string }) {
    return this.humanResourcesService.update(dto);
  }

  @MessagePattern('human.resource.deactivate')
  deactivate(@Payload() dto: { resourceCode: string; organizationCode: string; actorId: string; actorName: string }) {
    return this.humanResourcesService.deactivate(dto.resourceCode, dto.organizationCode, dto.actorId, dto.actorName);
  }
}
