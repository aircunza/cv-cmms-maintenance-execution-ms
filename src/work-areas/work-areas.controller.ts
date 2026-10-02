import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateWorkAreaDto,
  FindAllWorkAreasDto,
  UpdateWorkAreaDto,
  WorkAreaIdDto,
} from './dto';
import { WorkAreasService } from './work-areas.service';

@Controller('work-areas')
export class WorkAreasController {
  constructor(private readonly workAreasService: WorkAreasService) {}

  @MessagePattern('work.area.create')
  create(@Payload() dto: CreateWorkAreaDto) {
    return this.workAreasService.create(dto);
  }

  @MessagePattern('work.area.find.one')
  findOne(@Payload() dto: WorkAreaIdDto) {
    return this.workAreasService.findOne(dto.id);
  }

  @MessagePattern('work.area.find.all')
  findAll(@Payload() dto: FindAllWorkAreasDto = {}) {
    return this.workAreasService.findAll(dto);
  }

  @MessagePattern('work.area.update')
  update(@Payload() dto: UpdateWorkAreaDto) {
    return this.workAreasService.update(dto);
  }

  @MessagePattern('work.area.deactivate')
  deactivate(@Payload() dto: WorkAreaIdDto) {
    return this.workAreasService.deactivate(dto.id);
  }
}
