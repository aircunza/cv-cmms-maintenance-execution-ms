import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { WorkRequestsService } from "./work-requests.service";
import {
  CreateWorkRequestMessageDto,
  UpdateWorkRequestDto,
  FindAllWorkRequestDto,
  WorkRequestIdDto,
} from "./dto";

@Controller("work-requests")
export class WorkRequestsController {
  constructor(private readonly workRequestsService: WorkRequestsService) {}

  @MessagePattern("work.request.create")
  create(@Payload() dto: CreateWorkRequestMessageDto) {
    return this.workRequestsService.create(dto);
  }

  @MessagePattern("work.request.find.one")
  findOne(@Payload() dto: WorkRequestIdDto) {
    return this.workRequestsService.findOne(dto.requestId);
  }

  @MessagePattern("work.request.find.all")
  findAll(@Payload() dto: FindAllWorkRequestDto = {}) {
    return this.workRequestsService.findAll(dto);
  }

  @MessagePattern("work.request.update")
  update(
    @Payload()
    dto: UpdateWorkRequestDto & {
      requestId?: number;
      actorId: string;
      actorName: string;
    },
  ) {
    return this.workRequestsService.update(dto);
  }

  @MessagePattern("work.request.cancel")
  cancel(
    @Payload() dto: { requestId: number; actorId: string; actorName: string },
  ) {
    return this.workRequestsService.cancel(
      dto.requestId,
      dto.actorId,
      dto.actorName,
    );
  }
}
