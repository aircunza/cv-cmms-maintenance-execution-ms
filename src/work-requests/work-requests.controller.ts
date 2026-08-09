import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { WorkRequestsService } from "./work-requests.service";
import {
  CreateWorkRequestMessageDto,
  UpdateWorkRequestMessageDto,
  FindAllWorkRequestDto,
  WorkRequestReadDto,
  WorkRequestIdMessageDto,
} from "./dto";

@Controller("work-requests")
export class WorkRequestsController {
  constructor(private readonly workRequestsService: WorkRequestsService) {}

  @MessagePattern("work.request.create")
  create(@Payload() dto: CreateWorkRequestMessageDto) {
    return this.workRequestsService.create(dto);
  }

  @MessagePattern("work.request.find.one")
  findOne(@Payload() dto: WorkRequestReadDto) {
    return this.workRequestsService.findOne(dto);
  }

  @MessagePattern("work.request.find.all")
  findAll(@Payload() dto: FindAllWorkRequestDto) {
    return this.workRequestsService.findAll(dto);
  }

  @MessagePattern("work.request.update")
  update(@Payload() dto: UpdateWorkRequestMessageDto) {
    return this.workRequestsService.update(dto);
  }

  @MessagePattern("work.request.complete")
  complete(@Payload() dto: WorkRequestIdMessageDto) {
    return this.workRequestsService.complete(dto);
  }

  @MessagePattern("work.request.cancel")
  cancel(@Payload() dto: WorkRequestIdMessageDto) {
    return this.workRequestsService.cancel(dto);
  }
}
