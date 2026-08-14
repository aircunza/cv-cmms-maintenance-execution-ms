import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from 'src/prisma.service';
import { CreateOperationHrDto, UpdateOperationHrDto, CancelOperationHrDto, FindAllOperationHrDto } from './dto';

@Injectable()
export class OperationHumanResourcesService {
  private readonly logger = new Logger(OperationHumanResourcesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOperationHrDto & { actorId: string; actorName: string; operationCode: number }) {
    try {
      const operation = await this.prisma.mntWoOperation.findFirst({
        where: { operationCode: BigInt(dto.operationCode) },
      });

      if (!operation) {
        throw new RpcException({ status: 404, message: 'Operation not found' });
      }

      if (operation.operationStatus === 'CANCELED') {
        throw new RpcException({ status: 400, message: 'Cannot add resource to a canceled operation' });
      }

      const existing = await this.prisma.mntOperationHumanResourceUsage.findFirst({
        where: {
          operationCode: BigInt(dto.operationCode),
          resourceCode: dto.resourceCode,
          resourceSequenceNumber: dto.resourceSequenceNumber,
        },
      });

      if (existing) {
        throw new RpcException({
          status: 400,
          message: `Resource sequence number ${dto.resourceSequenceNumber} already exists for this resource in this operation`,
        });
      }

      const actualStartDate = new Date(dto.actualStartDate);
      const actualCompletionDate = new Date(dto.actualCompletionDate);

      if (actualStartDate >= actualCompletionDate) {
        throw new RpcException({
          status: 400,
          message: 'actualStartDate must be before actualCompletionDate',
        });
      }

      const hrUsage = await this.prisma.$transaction(async (tx) => {
        const created = await tx.mntOperationHumanResourceUsage.create({
          data: {
            operationCode: BigInt(dto.operationCode),
            organizationCode: dto.organizationCode,
            resourceCode: dto.resourceCode,
            actualHours: dto.actualHours,
            hourlyCost: dto.hourlyCost,
            principalFlag: dto.principalFlag ?? 'N',
            resourceSequenceNumber: dto.resourceSequenceNumber,
            actualStartDate,
            actualCompletionDate,
            status: 'ACTIVE',
            createdBy: dto.actorId,
            createdByName: dto.actorName,
          },
        });

        await this.recalculateOperation(tx, dto.operationCode, dto.actorId, dto.actorName);

        return created;
      });

      return { hrUsage };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findAll(dto: FindAllOperationHrDto) {
    try {
      const where: any = {};
      if (dto.operationCode) {
        where.operationCode = BigInt(dto.operationCode);
      }
      if (dto.includeCanceled !== 'Y') {
        where.status = { not: 'CANCELED' };
      }

      const hrUsages = await this.prisma.mntOperationHumanResourceUsage.findMany({
        where,
        orderBy: { resourceSequenceNumber: 'asc' },
      });

      return { hrUsages, total: hrUsages.length };
    } catch (error) {
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async update(dto: UpdateOperationHrDto & { id: number; actorId: string; actorName: string }) {
    try {
      const existing = await this.prisma.mntOperationHumanResourceUsage.findFirst({
        where: { id: BigInt(dto.id) },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'HR usage not found' });
      }

      if (existing.status === 'CANCELED') {
        throw new RpcException({ status: 400, message: 'Cannot update a canceled resource' });
      }

      if (dto.actualHours !== undefined && dto.actualHours <= 0) {
        throw new RpcException({ status: 400, message: 'actualHours must be greater than 0' });
      }

      const updateData: Record<string, any> = {
        updatedBy: dto.actorId,
        updatedByName: dto.actorName,
        updatedAt: new Date(),
      };

      if (dto.actualHours !== undefined) {
        updateData.actualHours = dto.actualHours;
      }
      if (dto.hourlyCost !== undefined) {
        updateData.hourlyCost = dto.hourlyCost;
      }
      if (dto.principalFlag !== undefined) {
        updateData.principalFlag = dto.principalFlag;
      }
      if (dto.actualStartDate !== undefined) {
        updateData.actualStartDate = new Date(dto.actualStartDate);
      }
      if (dto.actualCompletionDate !== undefined) {
        updateData.actualCompletionDate = new Date(dto.actualCompletionDate);
      }

      if (updateData.actualStartDate && updateData.actualCompletionDate) {
        if (updateData.actualStartDate >= updateData.actualCompletionDate) {
          throw new RpcException({ status: 400, message: 'actualStartDate must be before actualCompletionDate' });
        }
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.mntOperationHumanResourceUsage.update({
          where: { id: BigInt(dto.id) },
          data: updateData,
        });

        await this.recalculateOperation(tx, Number(existing.operationCode), dto.actorId, dto.actorName);

        return result;
      });

      return { hrUsage: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async cancel(
    id: number,
    operationCode: number,
    actorId: string,
    actorName: string,
    dto: CancelOperationHrDto,
  ) {
    try {
      if (!dto.canceledReason || dto.canceledReason.trim().length === 0) {
        throw new RpcException({ status: 400, message: 'canceledReason is required' });
      }

      if (dto.canceledReason.length > 240) {
        throw new RpcException({ status: 400, message: 'canceledReason must not exceed 240 characters' });
      }

      const existing = await this.prisma.mntOperationHumanResourceUsage.findFirst({
        where: { id: BigInt(id) },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'HR usage not found' });
      }

      if (existing.status === 'CANCELED') {
        throw new RpcException({ status: 400, message: 'Resource is already canceled' });
      }

      const activeCount = await this.prisma.mntOperationHumanResourceUsage.count({
        where: {
          operationCode: BigInt(operationCode),
          status: { not: 'CANCELED' },
        },
      });

      if (activeCount <= 1) {
        throw new RpcException({
          status: 400,
          message: 'Cannot cancel the last active resource',
        });
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.mntOperationHumanResourceUsage.update({
          where: { id: BigInt(id) },
          data: {
            status: 'CANCELED',
            canceledReason: dto.canceledReason,
            updatedBy: actorId,
            updatedByName: actorName,
            updatedAt: new Date(),
          },
        });

        await this.recalculateOperation(tx, operationCode, actorId, actorName);

        return result;
      });

      return { hrUsage: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  private async recalculateOperation(
    tx: any,
    operationCode: number,
    actorId: string,
    actorName: string,
  ) {
    const activeResources = await tx.mntOperationHumanResourceUsage.findMany({
      where: {
        operationCode: BigInt(operationCode),
        status: 'ACTIVE',
      },
    });

    let actualHours = 0;
    let actualStartDate: Date | null = null;
    let actualCompletionDate: Date | null = null;

    for (const hr of activeResources) {
      actualHours += hr.actualHours || 0;

      if (hr.actualStartDate) {
        if (!actualStartDate || hr.actualStartDate < actualStartDate) {
          actualStartDate = hr.actualStartDate;
        }
      }
      if (hr.actualCompletionDate) {
        if (!actualCompletionDate || hr.actualCompletionDate > actualCompletionDate) {
          actualCompletionDate = hr.actualCompletionDate;
        }
      }
    }

    await tx.mntWoOperation.update({
      where: { operationCode: BigInt(operationCode) },
      data: {
        actualHours,
        actualStartDate,
        actualCompletionDate,
        updatedBy: actorId,
        updatedByName: actorName,
        updatedAt: new Date(),
      },
    });

    await this.recalculateWorkOrder(tx, operationCode, actorId, actorName);
  }

  private async recalculateWorkOrder(
    tx: any,
    operationCode: number,
    actorId: string,
    actorName: string,
  ) {
    const operation = await tx.mntWoOperation.findFirst({
      where: { operationCode: BigInt(operationCode) },
    });

    if (!operation) return;

    const activeOperations = await tx.mntWoOperation.findMany({
      where: {
        workOrderCode: operation.workOrderCode,
        operationStatus: { not: 'CANCELED' },
      },
      include: { hrUsages: true },
    });

    let woActualHours = 0;
    let woActualStartDate: Date | null = null;
    let woActualCompletionDate: Date | null = null;
    let totalManHours = 0;
    let totalSupplierHours = 0;

    for (const op of activeOperations) {
      woActualHours += op.actualHours || 0;

      for (const hr of op.hrUsages) {
        if (hr.status === 'CANCELED') continue;
        if (op.operationType === 'Internal') {
          totalManHours += hr.actualHours || 0;
        } else {
          totalSupplierHours += hr.actualHours || 0;
        }
      }

      if (op.actualStartDate) {
        if (!woActualStartDate || op.actualStartDate < woActualStartDate) {
          woActualStartDate = op.actualStartDate;
        }
      }
      if (op.actualCompletionDate) {
        if (!woActualCompletionDate || op.actualCompletionDate > woActualCompletionDate) {
          woActualCompletionDate = op.actualCompletionDate;
        }
      }
    }

    await tx.mntWorkOrder.update({
      where: { workOrderCode: operation.workOrderCode },
      data: {
        actualHours: woActualHours,
        actualStartDate: woActualStartDate,
        actualCompletionDate: woActualCompletionDate,
        totalManHours,
        totalSupplierHours,
        updatedBy: actorId,
        updatedByName: actorName,
        updatedAt: new Date(),
      },
    });
  }
}
