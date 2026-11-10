import { Module } from '@nestjs/common';
import { WoOperationsController } from './wo-operations.controller';
import { WoOperationsService } from './wo-operations.service';
import { WoOperationsHumanResourcesPlainService } from './wo-operations-human-resources-plain.service';
import { PrismaService } from 'src/prisma.service';
import { NatsModule } from 'src/transports/nats.module';
import { OracleWorkOrderPolicy } from "src/work-orders/policies";

@Module({
  imports: [NatsModule],
  controllers: [WoOperationsController],
  providers: [
    WoOperationsService,
    WoOperationsHumanResourcesPlainService,
    PrismaService,
    OracleWorkOrderPolicy,
  ],
  exports: [WoOperationsService],
})
export class WoOperationsModule {}
