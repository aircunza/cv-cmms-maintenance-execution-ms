import { Module } from '@nestjs/common';
import { WorkCentersController } from './work-centers.controller';
import { WorkCentersService } from './work-centers.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [WorkCentersController],
  providers: [WorkCentersService, PrismaService],
  exports: [WorkCentersService],
})
export class WorkCentersModule {}
