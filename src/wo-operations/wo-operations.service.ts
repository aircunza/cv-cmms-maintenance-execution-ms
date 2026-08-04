import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { PrismaService } from "src/prisma.service";
import {
  CreateWoOperationDto,
  UpdateWoOperationDto,
  FindAllWoOperationDto,
} from "./dto";
import { OP_STATUS, isOperationStatusCompatible } from "src/common/enums";

@Injectable()
export class WoOperationsService {
  private readonly logger = new Logger(WoOperationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateWoOperationDto & { actorId: string; actorName: string },
  ) {
    try {
      const workOrder = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(dto.workOrderCode) },
      });

      if (!workOrder) {
        throw new RpcException({
          status: 404,
          message: "Work order not found",
        });
      }

      if (dto.operationSeqNumber) {
        const existingSeq = await this.prisma.mntWoOperation.findFirst({
          where: {
            workOrderCode: BigInt(dto.workOrderCode),
            operationSeqNumber: dto.operationSeqNumber,
          },
        });

        if (existingSeq) {
          throw new RpcException({
            status: 400,
            message: `Operation sequence number ${dto.operationSeqNumber} already exists for this work order`,
          });
        }
      }

      if (
        dto.operationStatus &&
        !isOperationStatusCompatible(
          workOrder.woStatusCode,
          dto.operationStatus,
        )
      ) {
        throw new RpcException({
          status: 400,
          message: `Operation status ${dto.operationStatus} is not compatible with work order status ${workOrder.woStatusCode}`,
        });
      }

      if (dto.assetCode) {
        const asset = await this.prisma.mntAsset.findFirst({
          where: { assetCode: dto.assetCode, isActive: "Y" },
        });
        if (!asset) {
          throw new RpcException({
            status: 404,
            message: "Asset not found or inactive",
          });
        }
        if (!dto.assetShortDescription) {
          dto.assetShortDescription = asset.assetShortDescription ?? undefined;
        }
      }

      const operation = await this.prisma.mntWoOperation.create({
        data: {
          operationName: dto.operationName,
          operationDescription: dto.operationDescription,
          operationSeqNumber: dto.operationSeqNumber,
          workOrderCode: BigInt(dto.workOrderCode),
          assetCode: dto.assetCode,
          assetShortDescription: dto.assetShortDescription,
          unit: dto.unit,
          subunit: dto.subunit,
          maintainableItem: dto.maintainableItem,
          operationCategory: dto.operationCategory,
          operationStatus: dto.operationStatus ?? OP_STATUS.UNRELEASED,
          operationType: dto.operationType,
          plannedStartDate: dto.plannedStartDate,
          plannedCompletionDate: dto.plannedCompletionDate,
          actualStartDate: dto.actualStartDate,
          actualCompletionDate: dto.actualCompletionDate,
          plannedHours: dto.plannedHours,
          actualHours: dto.actualHours,
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

      return { operation };
    } catch (error) {
      console.error(error);
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findOne(operationCode: number) {
    try {
      const operation = await this.prisma.mntWoOperation.findFirst({
        where: { operationCode: BigInt(operationCode) },
      });

      if (!operation) {
        throw new RpcException({ status: 404, message: "Operation not found" });
      }

      return { operation };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findAll(dto: FindAllWoOperationDto) {
    try {
      const operations = await this.prisma.mntWoOperation.findMany({
        where: {
          ...(dto.workOrderCode
            ? { workOrderCode: BigInt(dto.workOrderCode) }
            : {}),
          ...(dto.assetCode ? { assetCode: { contains: dto.assetCode } } : {}),
          ...(dto.operationStatus
            ? { operationStatus: dto.operationStatus }
            : {}),
        },
        orderBy: { operationSeqNumber: "asc" },
      });

      return { operations, total: operations.length };
    } catch (error) {
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async update(
    dto: UpdateWoOperationDto & {
      operationCode: number;
      actorId: string;
      actorName: string;
    },
  ) {
    try {
      const existing = await this.prisma.mntWoOperation.findFirst({
        where: { operationCode: BigInt(dto.operationCode) },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: "Operation not found" });
      }

      const updated = await this.prisma.mntWoOperation.update({
        where: { operationCode: BigInt(dto.operationCode) },
        data: {
          ...(dto.operationName !== undefined
            ? { operationName: dto.operationName }
            : {}),
          ...(dto.operationDescription !== undefined
            ? { operationDescription: dto.operationDescription }
            : {}),
          ...(dto.actualStartDate !== undefined
            ? { actualStartDate: dto.actualStartDate }
            : {}),
          ...(dto.actualCompletionDate !== undefined
            ? { actualCompletionDate: dto.actualCompletionDate }
            : {}),
          ...(dto.actualHours !== undefined
            ? { actualHours: dto.actualHours }
            : {}),
          ...(dto.operationStatus !== undefined
            ? { operationStatus: dto.operationStatus }
            : {}),
          updatedBy: dto.actorId,
          updatedByName: dto.actorName,
          updatedAt: new Date(),
        },
      });

      return { operation: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async review(operationCode: number, actorId: string, actorName: string) {
    try {
      const existing = await this.prisma.mntWoOperation.findFirst({
        where: { operationCode: BigInt(operationCode) },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: "Operation not found" });
      }

      const updated = await this.prisma.mntWoOperation.update({
        where: { operationCode: BigInt(operationCode) },
        data: {
          reviewedBy: actorId,
          reviewedByName: actorName,
          reviewedAt: new Date(),
        },
      });

      return { operation: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }
}
