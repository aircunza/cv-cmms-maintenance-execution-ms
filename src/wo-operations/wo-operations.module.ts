import { Module } from '@nestjs/common';
import { WoOperationsController } from './wo-operations.controller';
import { WoOperationsService } from './wo-operations.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [WoOperationsController],
  providers: [WoOperationsService, PrismaService],
  exports: [WoOperationsService],
})
export class WoOperationsModule {}
