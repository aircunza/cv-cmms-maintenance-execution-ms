import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { WoOperationsService } from "./wo-operations.service";
import {
  CreateWoOperationDto,
  UpdateWoOperationDto,
  CancelWoOperationDto,
  FindAllWoOperationDto,
  WoOperationCodeDto,
} from "./dto";

@Controller("wo-operations")
export class WoOperationsController {
  constructor(private readonly woOperationsService: WoOperationsService) {}

  @MessagePattern("wo.operation.create")
  create(
    @Payload()
    dto: CreateWoOperationDto & { actorId: string; actorName: string },
  ) {
    return this.woOperationsService.create(dto);
  }

  @MessagePattern("wo.operation.find.one")
  findOne(@Payload() dto: WoOperationCodeDto) {
    return this.woOperationsService.findOne(dto.operationCode);
  }

  @MessagePattern("wo.operation.find.all")
  findAll(@Payload() dto: FindAllWoOperationDto = {}) {
    return this.woOperationsService.findAll(dto);
  }

  @MessagePattern("wo.operation.update")
  update(
    @Payload()
    dto: UpdateWoOperationDto & {
      operationCode: number;
      actorId: string;
      actorName: string;
    },
  ) {
    return this.woOperationsService.update(dto);
  }

  @MessagePattern("wo.operation.review")
  review(
    @Payload()
    dto: {
      operationCode: number;
      actorId: string;
      actorName: string;
    },
  ) {
    return this.woOperationsService.review(
      dto.operationCode,
      dto.actorId,
      dto.actorName,
    );
  }

  @MessagePattern("wo.operation.cancel")
  cancel(
    @Payload()
    dto: CancelWoOperationDto & {
      operationCode: number;
      workOrderCode: number | string;
      organizationCode: string;
      actorId: string;
      actorName: string;
    },
  ) {
    const { operationCode, workOrderCode, organizationCode, actorId, actorName, ...cancelDto } = dto;
    return this.woOperationsService.cancel(
      operationCode,
      workOrderCode,
      organizationCode,
      actorId,
      actorName,
      cancelDto,
    );
  }
}
