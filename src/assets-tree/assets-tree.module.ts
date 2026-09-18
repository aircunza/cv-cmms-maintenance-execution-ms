import { Module } from '@nestjs/common';
import { AssetsTreeController } from './assets-tree.controller';
import { AssetsTreeService } from './assets-tree.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [AssetsTreeController],
  providers: [AssetsTreeService, PrismaService],
  exports: [AssetsTreeService],
})
export class AssetsTreeModule {}
