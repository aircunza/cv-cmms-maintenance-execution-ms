import { Module } from '@nestjs/common';
import { WorkAreasController } from './work-areas.controller';
import { WorkAreasService } from './work-areas.service';
import { PrismaService } from 'src/prisma.service';
import { NatsModule } from 'src/transports/nats.module';

@Module({
  imports: [NatsModule],
  controllers: [WorkAreasController],
  providers: [WorkAreasService, PrismaService],
  exports: [WorkAreasService],
})
export class WorkAreasModule {}
