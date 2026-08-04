import { Module } from '@nestjs/common';
import { OperationHumanResourcesController } from './operation-human-resources.controller';
import { OperationHumanResourcesService } from './operation-human-resources.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [OperationHumanResourcesController],
  providers: [OperationHumanResourcesService, PrismaService],
  exports: [OperationHumanResourcesService],
})
export class OperationHumanResourcesModule {}
