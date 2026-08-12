import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { PrismaService } from "src/prisma.service";
import {
  CreateWoOperationDto,
  UpdateWoOperationDto,
  CancelWoOperationDto,
  FindAllWoOperationDto,
} from "./dto";
import { OP_STATUS, isOperationStatusCompatible, isValidOpTransition } from "src/common/enums";

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

      if (existing.operationStatus === OP_STATUS.CANCELED) {
        throw new RpcException({
          status: 400,
          message: "Cannot update a canceled operation",
        });
      }

      const calculatedFields = ["actualHours", "actualStartDate", "actualCompletionDate"];
      for (const field of calculatedFields) {
        if ((dto as any)[field] !== undefined) {
          throw new RpcException({
            status: 400,
            message: `${field} is a calculated field and cannot be manually updated. Update the associated resources instead.`,
          });
        }
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
          ...(dto.operationStatus !== undefined
            ? { operationStatus: dto.operationStatus }
            : {}),
          ...(dto.operationType !== undefined
            ? { operationType: dto.operationType }
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

  async cancel(
    operationCode: number,
    workOrderCode: number | string,
    organizationCode: string,
    actorId: string,
    actorName: string,
    dto: CancelWoOperationDto,
  ) {
    try {
      if (!dto.canceledReason || dto.canceledReason.trim().length === 0) {
        throw new RpcException({
          status: 400,
          message: "canceledReason is required",
        });
      }

      if (dto.canceledReason.length > 240) {
        throw new RpcException({
          status: 400,
          message: "canceledReason must not exceed 240 characters",
        });
      }

      const existing = await this.prisma.mntWoOperation.findFirst({
        where: { operationCode: BigInt(operationCode) },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: "Operation not found" });
      }

      if (!isValidOpTransition(existing.operationStatus, OP_STATUS.CANCELED)) {
        throw new RpcException({
          status: 400,
          message: `Cannot cancel operation from status ${existing.operationStatus}`,
        });
      }

      const activeOpCount = await this.prisma.mntWoOperation.count({
        where: {
          workOrderCode: BigInt(String(workOrderCode)),
          operationStatus: { not: OP_STATUS.CANCELED },
        },
      });

      if (activeOpCount <= 1) {
        throw new RpcException({
          status: 400,
          message: "Cannot cancel the last active operation",
        });
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.mntOperationHumanResourceUsage.updateMany({
          where: { operationCode: BigInt(operationCode) },
          data: {
            status: "CANCELED",
            updatedBy: actorId,
            updatedByName: actorName,
            updatedAt: new Date(),
          },
        });

        await tx.mntWoOperation.update({
          where: { operationCode: BigInt(operationCode) },
          data: {
            operationStatus: OP_STATUS.CANCELED,
            updatedBy: actorId,
            updatedByName: actorName,
            updatedAt: new Date(),
          },
        });

        const activeOperations = await tx.mntWoOperation.findMany({
          where: {
            workOrderCode: BigInt(String(workOrderCode)),
            operationStatus: { not: OP_STATUS.CANCELED },
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
            if (hr.status === "CANCELED") continue;
            if (op.operationType === "Internal") {
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
          where: { workOrderCode: BigInt(String(workOrderCode)) },
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
      });

      const updated = await this.prisma.mntWoOperation.findFirst({
        where: { operationCode: BigInt(operationCode) },
        include: { hrUsages: true, materialUsages: true },
      });

      return { operation: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }
}
