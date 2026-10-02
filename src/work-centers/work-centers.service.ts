import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma.service';
import {
  CreateWorkCenterDto,
  FindAllWorkCentersDto,
  UpdateWorkCenterDto,
} from './dto';

@Injectable()
export class WorkCentersService {
  constructor(private readonly prisma: PrismaService) {}

  private async syncAssetsFromWorkCenter(workCenterId: string) {
    const workCenter = await this.prisma.workCenter.findFirst({
      where: { id: workCenterId },
      include: { workArea: true },
    });

    if (!workCenter) {
      return;
    }

    await this.prisma.mntAsset.updateMany({
      where: { workCenterId },
      data: {
        workCenterCode: workCenter.workCenterCode,
        workCenterDescription: workCenter.workCenterDescription,
        centerCostCode: workCenter.centerCostCode,
        workAreaCode: workCenter.workArea.workAreaCode,
        workAreaDescription: workCenter.workArea.workAreaDescription,
      },
    });
  }

  private async ensureWorkAreaExists(id: string) {
    const workArea = await this.prisma.workArea.findFirst({
      where: {
        id,
        isActive: 'Y',
      },
    });

    if (!workArea) {
      throw new RpcException({ status: 404, message: 'Work area not found' });
    }
  }

  async create(dto: CreateWorkCenterDto) {
    const {
      workCenterCode,
      workCenterDescription,
      workAreaId,
      centerCostCode,
      centerCostDescription,
    } = dto;

    try {
      await this.ensureWorkAreaExists(workAreaId);

      const duplicatedCostCenter = await this.prisma.workCenter.findFirst({
        where: {
          centerCostCode,
          workAreaId,
        },
      });

      if (duplicatedCostCenter) {
        throw new RpcException({
          status: 400,
          message: 'Center cost code already exists for this work area',
        });
      }

      const workCenter = await this.prisma.workCenter.create({
        data: {
          id: randomUUID(),
          workCenterCode,
          workCenterDescription,
          workAreaId,
          centerCostCode,
          centerCostDescription,
          isActive: 'Y',
        },
      });

      await this.syncAssetsFromWorkCenter(workCenter.id);

      return { workCenter };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findOne(id: string) {
    try {
      const workCenter = await this.prisma.workCenter.findFirst({
        where: { id, isActive: 'Y' },
      });

      if (!workCenter) {
        throw new RpcException({
          status: 404,
          message: 'Work center not found',
        });
      }

      return { workCenter };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findAll(dto: FindAllWorkCentersDto) {
    const { workCenterCode, workAreaId, isActive } = dto;

    try {
      const workCenters = await this.prisma.workCenter.findMany({
        where: {
          ...(workCenterCode
            ? { workCenterCode: { contains: workCenterCode } }
            : {}),
          ...(workAreaId ? { workAreaId } : {}),
          ...(isActive ? { isActive } : { isActive: 'Y' }),
        },
        orderBy: { createdAt: 'desc' },
      });

      return { workCenters, total: workCenters.length };
    } catch {
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async update(dto: UpdateWorkCenterDto) {
    const {
      id,
      workCenterDescription,
      workAreaId,
      centerCostCode,
      centerCostDescription,
      isActive,
    } = dto;

    try {
      const existing = await this.prisma.workCenter.findFirst({
        where: { id, isActive: 'Y' },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: 'Work center not found',
        });
      }

      if (workAreaId !== undefined) {
        await this.ensureWorkAreaExists(workAreaId);
      }

      const hasUpdatableFields =
        workCenterDescription !== undefined ||
        workAreaId !== undefined ||
        centerCostCode !== undefined ||
        centerCostDescription !== undefined ||
        isActive !== undefined;

      if (!hasUpdatableFields) {
        throw new RpcException({ status: 400, message: 'No fields to update' });
      }

      const targetWorkAreaId = workAreaId ?? existing.workAreaId;
      const targetCenterCostCode = centerCostCode ?? existing.centerCostCode;

      const duplicatedCostCenter = await this.prisma.workCenter.findFirst({
        where: {
          id: { not: id },
          workAreaId: targetWorkAreaId,
          centerCostCode: targetCenterCostCode,
        },
      });

      if (duplicatedCostCenter) {
        throw new RpcException({
          status: 400,
          message: 'Center cost code already exists for this work area',
        });
      }

      const updated = await this.prisma.workCenter.update({
        where: { id },
        data: {
          ...(workCenterDescription !== undefined
            ? { workCenterDescription }
            : {}),
          ...(workAreaId !== undefined ? { workAreaId } : {}),
          ...(centerCostCode !== undefined ? { centerCostCode } : {}),
          ...(centerCostDescription !== undefined
            ? { centerCostDescription }
            : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          updatedAt: new Date(),
        },
      });

      await this.syncAssetsFromWorkCenter(updated.id);

      return { workCenter: updated };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async deactivate(id: string) {
    try {
      const workCenter = await this.prisma.workCenter.findFirst({
        where: { id, isActive: 'Y' },
      });

      if (!workCenter) {
        throw new RpcException({
          status: 404,
          message: 'Work center not found',
        });
      }

      const updated = await this.prisma.workCenter.update({
        where: { id },
        data: {
          isActive: 'N',
          updatedAt: new Date(),
        },
      });

      await this.syncAssetsFromWorkCenter(updated.id);

      return {
        workCenter: updated,
        message: 'Work center deactivated successfully',
      };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }
}
