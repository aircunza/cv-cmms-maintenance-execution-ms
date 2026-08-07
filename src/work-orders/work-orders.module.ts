import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { PrismaService } from 'src/prisma.service';
import { WorkOrderSubTypePolicy, OracleWorkOrderPolicy } from './policies';

@Module({
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService, PrismaService, WorkOrderSubTypePolicy, OracleWorkOrderPolicy],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
