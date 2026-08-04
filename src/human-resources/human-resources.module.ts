import { Module } from '@nestjs/common';
import { HumanResourcesController } from './human-resources.controller';
import { HumanResourcesService } from './human-resources.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [HumanResourcesController],
  providers: [HumanResourcesService, PrismaService],
  exports: [HumanResourcesService],
})
export class HumanResourcesModule {}
