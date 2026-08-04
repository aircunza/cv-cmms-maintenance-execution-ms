import { Module } from '@nestjs/common';
import { OperationMaterialsController } from './operation-materials.controller';
import { OperationMaterialsService } from './operation-materials.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [OperationMaterialsController],
  providers: [OperationMaterialsService, PrismaService],
  exports: [OperationMaterialsService],
})
export class OperationMaterialsModule {}
