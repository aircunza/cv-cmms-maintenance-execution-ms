import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { WorkOrdersService } from "./work-orders.service";
import {
  CreateWorkOrderMessageDto,
  UpdateWorkOrderDto,
  FindAllWorkOrderDto,
  WorkOrderCodeDto,
} from "./dto";

@Controller("work-orders")
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @MessagePattern("work.order.create")
  create(@Payload() dto: CreateWorkOrderMessageDto) {
    return this.workOrdersService.create(dto);
  }

  @MessagePattern("work.order.find.one")
  findOne(@Payload() dto: WorkOrderCodeDto) {
    return this.workOrdersService.findOne(dto);
  }

  @MessagePattern("work.order.find.all")
  findAll(@Payload() dto: FindAllWorkOrderDto = {}) {
    return this.workOrdersService.findAll(dto);
  }

  @MessagePattern("work.order.update")
  update(
    @Payload()
    dto: UpdateWorkOrderDto & {
      workOrderCode: number;
      actorId: string;
      actorName: string;
    },
  ) {
    return this.workOrdersService.update(dto);
  }

  @MessagePattern("work.order.release")
  release(
    @Payload()
    dto: {
      workOrderCode: number;
      actorId: string;
      actorName: string;
    },
  ) {
    return this.workOrdersService.release(
      dto.workOrderCode,
      dto.actorId,
      dto.actorName,
    );
  }

  @MessagePattern("work.order.complete")
  complete(
    @Payload()
    dto: {
      workOrderCode: number;
      actorId: string;
      actorName: string;
    },
  ) {
    return this.workOrdersService.complete(
      dto.workOrderCode,
      dto.actorId,
      dto.actorName,
    );
  }

  @MessagePattern("work.order.close")
  close(
    @Payload()
    dto: {
      workOrderCode: number;
      actorId: string;
      actorName: string;
    },
  ) {
    return this.workOrdersService.close(
      dto.workOrderCode,
      dto.actorId,
      dto.actorName,
    );
  }

  @MessagePattern("work.order.cancel")
  cancel(
    @Payload()
    dto: {
      workOrderCode: number;
      actorId: string;
      actorName: string;
      canceledReason?: string;
    },
  ) {
    return this.workOrdersService.cancel(
      dto.workOrderCode,
      dto.actorId,
      dto.actorName,
      dto.canceledReason,
    );
  }
}
