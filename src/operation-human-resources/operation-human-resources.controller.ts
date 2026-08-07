import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OperationHumanResourcesService } from './operation-human-resources.service';
import {
  CreateOperationHrDto,
  UpdateOperationHrDto,
  FindAllOperationHrDto,
} from './dto';

@Controller('operation-human-resources')
export class OperationHumanResourcesController {
  constructor(private readonly operationHumanResourcesService: OperationHumanResourcesService) {}

  @MessagePattern('operation.hr.create')
  create(@Payload() dto: CreateOperationHrDto & { actorId: string; actorName: string; operationCode: number }) {
    return this.operationHumanResourcesService.create(dto);
  }

  @MessagePattern('operation.hr.find.all')
  findAll(@Payload() dto: FindAllOperationHrDto = {}) {
    return this.operationHumanResourcesService.findAll(dto);
  }

  @MessagePattern('operation.hr.update')
  update(@Payload() dto: UpdateOperationHrDto & { id: number; actorId: string; actorName: string }) {
    return this.operationHumanResourcesService.update(dto);
  }
}
