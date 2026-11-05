import { Module } from '@nestjs/common';
import { OperationMaterialsController } from './operation-materials.controller';
import { OperationMaterialsService } from './operation-materials.service';
import { PrismaService } from 'src/prisma.service';
import { NatsModule } from 'src/transports/nats.module';
import { OracleWorkOrderPolicy } from 'src/work-orders/policies';

@Module({
  imports: [NatsModule],
  controllers: [OperationMaterialsController],
  providers: [OperationMaterialsService, PrismaService, OracleWorkOrderPolicy],
  exports: [OperationMaterialsService],
})
export class OperationMaterialsModule {}
