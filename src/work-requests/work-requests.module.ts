import { Module } from "@nestjs/common";
import { WorkRequestsController } from "./work-requests.controller";
import { WorkRequestsService } from "./work-requests.service";
import { WorkRequestPolicy } from "./policies/work-request.policy";
import { PrismaService } from "src/prisma.service";
import { WorkOrdersModule } from "src/work-orders/work-orders.module";

@Module({
  imports: [WorkOrdersModule],
  controllers: [WorkRequestsController],
  providers: [WorkRequestsService, PrismaService, WorkRequestPolicy],
  exports: [WorkRequestsService],
})
export class WorkRequestsModule {}
