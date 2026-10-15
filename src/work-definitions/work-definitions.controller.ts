import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { WorkDefinitionsService } from "./work-definitions.service";
import {
  CreateWorkDefinitionMessageDto,
  UpdateWorkDefinitionMessageDto,
  FindAllWorkDefinitionDto,
  WorkDefinitionReadDto,
} from "./dto";

@Controller("work-definitions")
export class WorkDefinitionsController {
  constructor(
    private readonly workDefinitionsService: WorkDefinitionsService,
  ) {}

  @MessagePattern("work.definition.create")
  create(@Payload() dto: CreateWorkDefinitionMessageDto) {
    return this.workDefinitionsService.create(dto);
  }

  @MessagePattern("work.definition.find.one")
  findOne(@Payload() dto: WorkDefinitionReadDto) {
    return this.workDefinitionsService.findOne(dto);
  }

  @MessagePattern("work.definition.find.all")
  findAll(@Payload() dto: FindAllWorkDefinitionDto) {
    return this.workDefinitionsService.findAll(dto);
  }

  @MessagePattern("work.definition.update")
  update(@Payload() dto: UpdateWorkDefinitionMessageDto) {
    return this.workDefinitionsService.update(dto);
  }
}
