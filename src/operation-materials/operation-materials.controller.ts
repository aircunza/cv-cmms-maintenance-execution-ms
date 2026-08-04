import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OperationMaterialsService } from './operation-materials.service';
import {
  CreateOperationMaterialDto,
  UpdateOperationMaterialDto,
  FindAllOperationMaterialDto,
} from './dto';

@Controller('operation-materials')
export class OperationMaterialsController {
  constructor(private readonly operationMaterialsService: OperationMaterialsService) {}

  @MessagePattern('operation.material.create')
  create(@Payload() dto: CreateOperationMaterialDto & { actorId: string; actorName: string }) {
    return this.operationMaterialsService.create(dto);
  }

  @MessagePattern('operation.material.find.all')
  findAll(@Payload() dto: FindAllOperationMaterialDto = {}) {
    return this.operationMaterialsService.findAll(dto);
  }

  @MessagePattern('operation.material.update')
  update(@Payload() dto: UpdateOperationMaterialDto & { id: number; actorId: string; actorName: string }) {
    return this.operationMaterialsService.update(dto);
  }
}
