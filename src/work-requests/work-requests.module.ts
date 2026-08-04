import { Module } from '@nestjs/common';
import { WorkRequestsController } from './work-requests.controller';
import { WorkRequestsService } from './work-requests.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [WorkRequestsController],
  providers: [WorkRequestsService, PrismaService],
  exports: [WorkRequestsService],
})
export class WorkRequestsModule {}
