import { Module } from "@nestjs/common";
import { WorkDefinitionsController } from "./work-definitions.controller";
import { WorkDefinitionsService } from "./work-definitions.service";
import { WorkDefinitionPolicy } from "./policies/work-definition.policy";
import { PrismaService } from "src/prisma.service";

@Module({
  controllers: [WorkDefinitionsController],
  providers: [WorkDefinitionsService, PrismaService, WorkDefinitionPolicy],
  exports: [WorkDefinitionsService],
})
export class WorkDefinitionsModule {}
