import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from 'src/prisma.service';
import { CreateOperationHrDto, UpdateOperationHrDto, FindAllOperationHrDto } from './dto';

@Injectable()
export class OperationHumanResourcesService {
  private readonly logger = new Logger(OperationHumanResourcesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOperationHrDto & { actorId: string; actorName: string }) {
    try {
      const operation = await this.prisma.mntWoOperation.findFirst({
        where: { operationCode: BigInt(dto.operationCode) },
      });

      if (!operation) {
        throw new RpcException({ status: 404, message: 'Operation not found' });
      }

      if (dto.resourceSequenceNumber) {
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
      }

      const hrUsage = await this.prisma.mntOperationHumanResourceUsage.create({
        data: {
          operationCode: BigInt(dto.operationCode),
          organizationCode: dto.organizationCode,
          resourceCode: dto.resourceCode,
          plannedHours: dto.plannedHours,
          actualHours: dto.actualHours,
          hourlyCost: dto.hourlyCost,
          principalFlag: dto.principalFlag ?? 'N',
          resourceSequenceNumber: dto.resourceSequenceNumber,
          plannedStartDate: dto.plannedStartDate,
          plannedCompletionDate: dto.plannedCompletionDate,
          usageRate: dto.usageRate,
          createdBy: dto.actorId,
          createdByName: dto.actorName,
        },
      });

      return { hrUsage };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findAll(dto: FindAllOperationHrDto) {
    try {
      const hrUsages = await this.prisma.mntOperationHumanResourceUsage.findMany({
        where: {
          ...(dto.operationCode ? { operationCode: BigInt(dto.operationCode) } : {}),
        },
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

      const updated = await this.prisma.mntOperationHumanResourceUsage.update({
        where: { id: BigInt(dto.id) },
        data: {
          ...(dto.plannedHours !== undefined ? { plannedHours: dto.plannedHours } : {}),
          ...(dto.actualHours !== undefined ? { actualHours: dto.actualHours } : {}),
          ...(dto.hourlyCost !== undefined ? { hourlyCost: dto.hourlyCost } : {}),
          ...(dto.principalFlag !== undefined ? { principalFlag: dto.principalFlag } : {}),
          ...(dto.plannedStartDate !== undefined ? { plannedStartDate: dto.plannedStartDate } : {}),
          ...(dto.plannedCompletionDate !== undefined ? { plannedCompletionDate: dto.plannedCompletionDate } : {}),
          ...(dto.usageRate !== undefined ? { usageRate: dto.usageRate } : {}),
          updatedBy: dto.actorId,
          updatedByName: dto.actorName,
          updatedAt: new Date(),
        },
      });

      return { hrUsage: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }
}
