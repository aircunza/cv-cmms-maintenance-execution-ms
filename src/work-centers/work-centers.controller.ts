import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateWorkCenterDto,
  FindAllWorkCentersDto,
  UpdateWorkCenterDto,
  WorkCenterIdDto,
} from './dto';
import { WorkCentersService } from './work-centers.service';

@Controller('work-centers')
export class WorkCentersController {
  constructor(private readonly workCentersService: WorkCentersService) {}

  @MessagePattern('work.center.create')
  create(@Payload() dto: CreateWorkCenterDto) {
    return this.workCentersService.create(dto);
  }

  @MessagePattern('work.center.find.one')
  findOne(@Payload() dto: WorkCenterIdDto) {
    return this.workCentersService.findOne(dto.id);
  }

  @MessagePattern('work.center.find.all')
  findAll(@Payload() dto: FindAllWorkCentersDto = {}) {
    return this.workCentersService.findAll(dto);
  }

  @MessagePattern('work.center.update')
  update(@Payload() dto: UpdateWorkCenterDto) {
    return this.workCentersService.update(dto);
  }

  @MessagePattern('work.center.deactivate')
  deactivate(@Payload() dto: WorkCenterIdDto) {
    return this.workCentersService.deactivate(dto.id);
  }
}
