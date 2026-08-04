import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from 'src/prisma.service';
import { CreateWorkOrderDto, UpdateWorkOrderDto, FindAllWorkOrderDto } from './dto';
import { WO_STATUS, isValidWoTransition, OP_STATUS } from 'src/common/enums';

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkOrderDto & { actorId: string; actorName: string }) {
    try {
      if (dto.assetCode) {
        const asset = await this.prisma.mntAsset.findFirst({
          where: { assetCode: dto.assetCode, isActive: 'Y' },
        });

        if (!asset) {
          throw new RpcException({ status: 404, message: 'Asset not found or inactive' });
        }

        if (!dto.assetShortDescription) {
          dto.assetShortDescription = asset.assetShortDescription ?? undefined;
        }
      }

      if (dto.workRequestId) {
        const wr = await this.prisma.mntWorkRequest.findFirst({
          where: { requestId: BigInt(dto.workRequestId) },
        });
        if (!wr) {
          throw new RpcException({ status: 404, message: 'Work request not found' });
        }
      }

      const workOrder = await this.prisma.mntWorkOrder.create({
        data: {
          workOrderDescription: dto.workOrderDescription,
          assetCode: dto.assetCode,
          assetShortDescription: dto.assetShortDescription,
          workOrderType: dto.workOrderType,
          workOrderSubType: dto.workOrderSubType,
          workDefinitionCode: dto.workDefinitionCode,
          workOrderPriority: dto.workOrderPriority,
          woStatusCode: dto.woStatusCode ?? WO_STATUS.UNRELEASED,
          schedulingMethod: dto.schedulingMethod,
          plannedStartDate: dto.plannedStartDate,
          plannedCompletionDate: dto.plannedCompletionDate,
          plannedHours: dto.plannedHours,
          needByDate: dto.needByDate,
          workRequestId: dto.workRequestId ? BigInt(dto.workRequestId) : null,
          workCenterCode: dto.workCenterCode,
          workCenterDescription: dto.workCenterDescription,
          centerCostCode: dto.centerCostCode,
          workAreaCode: dto.workAreaCode,
          workAreaDescription: dto.workAreaDescription,
          sector: dto.sector,
          subsector: dto.subsector,
          organizationCode: dto.organizationCode,
          organizationName: dto.organizationName,
          createdBy: dto.actorId,
          createdByName: dto.actorName,
        },
      });

      return { workOrder };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findOne(workOrderCode: number) {
    try {
      const workOrder = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(workOrderCode) },
      });

      if (!workOrder) {
        throw new RpcException({ status: 404, message: 'Work order not found' });
      }

      return { workOrder };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findAll(dto: FindAllWorkOrderDto) {
    try {
      const workOrders = await this.prisma.mntWorkOrder.findMany({
        where: {
          ...(dto.assetCode ? { assetCode: { contains: dto.assetCode } } : {}),
          ...(dto.organizationCode ? { organizationCode: { contains: dto.organizationCode } } : {}),
          ...(dto.woStatusCode ? { woStatusCode: dto.woStatusCode } : {}),
          ...(dto.workOrderType ? { workOrderType: dto.workOrderType } : {}),
          ...(dto.workOrderSubType ? { workOrderSubType: dto.workOrderSubType } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      return { workOrders, total: workOrders.length };
    } catch (error) {
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async update(dto: UpdateWorkOrderDto & { workOrderCode: number; actorId: string; actorName: string }) {
    try {
      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(dto.workOrderCode) },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'Work order not found' });
      }

      if (dto.woStatusCode && existing.woStatusCode !== dto.woStatusCode) {
        if (!isValidWoTransition(existing.woStatusCode, dto.woStatusCode)) {
          throw new RpcException({
            status: 400,
            message: `Invalid status transition from ${existing.woStatusCode} to ${dto.woStatusCode}`,
          });
        }
      }

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(dto.workOrderCode) },
        data: {
          ...(dto.workOrderDescription !== undefined ? { workOrderDescription: dto.workOrderDescription } : {}),
          ...(dto.workOrderType !== undefined ? { workOrderType: dto.workOrderType } : {}),
          ...(dto.workOrderSubType !== undefined ? { workOrderSubType: dto.workOrderSubType } : {}),
          ...(dto.workOrderPriority !== undefined ? { workOrderPriority: dto.workOrderPriority } : {}),
          ...(dto.woStatusCode !== undefined ? { woStatusCode: dto.woStatusCode } : {}),
          ...(dto.plannedStartDate !== undefined ? { plannedStartDate: dto.plannedStartDate } : {}),
          ...(dto.plannedCompletionDate !== undefined ? { plannedCompletionDate: dto.plannedCompletionDate } : {}),
          ...(dto.plannedHours !== undefined ? { plannedHours: dto.plannedHours } : {}),
          ...(dto.actualStartDate !== undefined ? { actualStartDate: dto.actualStartDate } : {}),
          ...(dto.actualCompletionDate !== undefined ? { actualCompletionDate: dto.actualCompletionDate } : {}),
          ...(dto.actualHours !== undefined ? { actualHours: dto.actualHours } : {}),
          ...(dto.canceledReason !== undefined ? { canceledReason: dto.canceledReason } : {}),
          ...(dto.needByDate !== undefined ? { needByDate: dto.needByDate } : {}),
          updatedBy: dto.actorId,
          updatedByName: dto.actorName,
          updatedAt: new Date(),
        },
      });

      return { workOrder: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async release(workOrderCode: number, actorId: string, actorName: string) {
    try {
      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(workOrderCode) },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'Work order not found' });
      }

      if (!isValidWoTransition(existing.woStatusCode, WO_STATUS.RELEASED)) {
        throw new RpcException({
          status: 400,
          message: `Cannot release work order from status ${existing.woStatusCode}`,
        });
      }

      await this.prisma.mntWoOperation.updateMany({
        where: { workOrderCode: BigInt(workOrderCode) },
        data: { operationStatus: OP_STATUS.RELEASED },
      });

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(workOrderCode) },
        data: {
          woStatusCode: WO_STATUS.RELEASED,
          releasedDate: new Date(),
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
      });

      return { workOrder: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async complete(workOrderCode: number, actorId: string, actorName: string) {
    try {
      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(workOrderCode) },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'Work order not found' });
      }

      if (!isValidWoTransition(existing.woStatusCode, WO_STATUS.COMPLETED)) {
        throw new RpcException({
          status: 400,
          message: `Cannot complete work order from status ${existing.woStatusCode}`,
        });
      }

      await this.prisma.mntWoOperation.updateMany({
        where: { workOrderCode: BigInt(workOrderCode) },
        data: { operationStatus: OP_STATUS.COMPLETED },
      });

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(workOrderCode) },
        data: {
          woStatusCode: WO_STATUS.COMPLETED,
          actualCompletionDate: new Date(),
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
      });

      return { workOrder: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async close(workOrderCode: number, actorId: string, actorName: string) {
    try {
      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(workOrderCode) },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'Work order not found' });
      }

      if (!isValidWoTransition(existing.woStatusCode, WO_STATUS.CLOSED)) {
        throw new RpcException({
          status: 400,
          message: `Cannot close work order from status ${existing.woStatusCode}`,
        });
      }

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(workOrderCode) },
        data: {
          woStatusCode: WO_STATUS.CLOSED,
          closedDate: new Date(),
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
      });

      return { workOrder: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async cancel(workOrderCode: number, actorId: string, actorName: string, canceledReason?: string) {
    try {
      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(workOrderCode) },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'Work order not found' });
      }

      if (!isValidWoTransition(existing.woStatusCode, WO_STATUS.CANCELED)) {
        throw new RpcException({
          status: 400,
          message: `Cannot cancel work order from status ${existing.woStatusCode}`,
        });
      }

      await this.prisma.mntWoOperation.updateMany({
        where: { workOrderCode: BigInt(workOrderCode) },
        data: { operationStatus: OP_STATUS.CANCELED },
      });

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(workOrderCode) },
        data: {
          woStatusCode: WO_STATUS.CANCELED,
          canceledDate: new Date(),
          canceledReason: canceledReason,
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
      });

      return { workOrder: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }
}
