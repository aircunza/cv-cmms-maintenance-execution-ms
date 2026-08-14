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

const VALID_OP_STATUSES = Object.values(OP_STATUS);

type ValidatedResource = {
  resourceCode: string;
  resourceSequenceNumber: number;
  actualHours: number;
  actualStartDate: string;
  actualCompletionDate: string;
  principalFlag?: string;
  hourlyCost?: number;
};

function isValidIsoDate(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

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

      if (
        dto.operationStatus &&
        !VALID_OP_STATUSES.includes(dto.operationStatus as any)
      ) {
        throw new RpcException({
          status: 400,
          message: `Invalid operationStatus "${dto.operationStatus}"`,
        });
      }

      if (!dto.operationName || dto.operationName.length < 2) {
        throw new RpcException({
          status: 400,
          message: "Operation name must be at least 2 characters",
        });
      }

      if (
        dto.actualStartDate &&
        (!isValidIsoDate(dto.actualStartDate as any) ||
          !isValidIsoDate(dto.actualCompletionDate as any))
      ) {
        throw new RpcException({
          status: 400,
          message: "Operation has invalid ISO 8601 date fields",
        });
      }

      if (
        dto.actualStartDate &&
        dto.actualCompletionDate &&
        new Date(dto.actualStartDate) >= new Date(dto.actualCompletionDate)
      ) {
        throw new RpcException({
          status: 400,
          message:
            "Operation actualStartDate must be before actualCompletionDate",
        });
      }

      if (!dto.resources || dto.resources.length === 0) {
        throw new RpcException({
          status: 400,
          message: "Operation must have at least one resource",
        });
      }

      for (const res of dto.resources) {
        if (!res.resourceCode || res.resourceCode.trim().length === 0) {
          throw new RpcException({
            status: 400,
            message: "Resource resourceCode is required",
          });
        }
        if (
          res.resourceSequenceNumber === undefined ||
          res.resourceSequenceNumber < 0 ||
          !Number.isInteger(res.resourceSequenceNumber)
        ) {
          throw new RpcException({
            status: 400,
            message: `Resource "${res.resourceCode}" resourceSequenceNumber must be a non-negative integer`,
          });
        }
        if (res.actualHours === undefined || res.actualHours <= 0) {
          throw new RpcException({
            status: 400,
            message: `Resource "${res.resourceCode}" actualHours must be greater than 0`,
          });
        }
        if (!res.actualStartDate || !res.actualCompletionDate) {
          throw new RpcException({
            status: 400,
            message: `Resource "${res.resourceCode}" must have actualStartDate and actualCompletionDate`,
          });
        }
        if (
          !isValidIsoDate(res.actualStartDate) ||
          !isValidIsoDate(res.actualCompletionDate)
        ) {
          throw new RpcException({
            status: 400,
            message: `Resource "${res.resourceCode}" has invalid ISO 8601 date fields`,
          });
        }
        if (new Date(res.actualStartDate!) >= new Date(res.actualCompletionDate!)) {
          throw new RpcException({
            status: 400,
            message: `Resource "${res.resourceCode}" actualStartDate must be before actualCompletionDate`,
          });
        }
      }

      const validatedResources: ValidatedResource[] = dto.resources.map(
        (res) => ({
          resourceCode: res.resourceCode!,
          resourceSequenceNumber: res.resourceSequenceNumber!,
          actualHours: res.actualHours!,
          actualStartDate: res.actualStartDate!,
          actualCompletionDate: res.actualCompletionDate!,
          principalFlag: res.principalFlag,
          hourlyCost: res.hourlyCost,
        }),
      );

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

      const calculatedActualHours = validatedResources.reduce(
        (sum, res) => sum + res.actualHours,
        0,
      );
      let calculatedStartDate: Date | null = null;
      let calculatedCompletionDate: Date | null = null;

      for (const res of validatedResources) {
        const resStart = new Date(res.actualStartDate);
        const resCompletion = new Date(res.actualCompletionDate);

        if (!calculatedStartDate || resStart < calculatedStartDate) {
          calculatedStartDate = resStart;
        }
        if (!calculatedCompletionDate || resCompletion > calculatedCompletionDate) {
          calculatedCompletionDate = resCompletion;
        }
      }

      const operation = await this.prisma.$transaction(async (tx) => {
        const createdOp = await tx.mntWoOperation.create({
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
            operationSubType: workOrder.workOrderSubType,
            operationStatus: dto.operationStatus ?? OP_STATUS.UNRELEASED,
            operationType: dto.operationType,
            actualStartDate: calculatedStartDate,
            actualCompletionDate: calculatedCompletionDate,
            actualHours: calculatedActualHours,
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

        for (const res of validatedResources) {
          await tx.mntOperationHumanResourceUsage.create({
            data: {
              operationCode: createdOp.operationCode,
              organizationCode: dto.organizationCode,
              resourceCode: res.resourceCode,
              actualHours: res.actualHours,
              hourlyCost: res.hourlyCost,
              principalFlag: res.principalFlag ?? "N",
              resourceSequenceNumber: res.resourceSequenceNumber,
              actualStartDate: new Date(res.actualStartDate),
              actualCompletionDate: new Date(res.actualCompletionDate),
              status: "ACTIVE",
              createdBy: dto.actorId,
              createdByName: dto.actorName,
            },
          });
        }

        const activeOperations = await tx.mntWoOperation.findMany({
          where: {
            workOrderCode: BigInt(dto.workOrderCode),
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
            if (
              !woActualCompletionDate ||
              op.actualCompletionDate > woActualCompletionDate
            ) {
              woActualCompletionDate = op.actualCompletionDate;
            }
          }
        }

        await tx.mntWorkOrder.update({
          where: { workOrderCode: BigInt(dto.workOrderCode) },
          data: {
            actualHours: woActualHours,
            actualStartDate: woActualStartDate,
            actualCompletionDate: woActualCompletionDate,
            totalManHours,
            totalSupplierHours,
            updatedBy: dto.actorId,
            updatedByName: dto.actorName,
            updatedAt: new Date(),
          },
        });

        return tx.mntWoOperation.findFirst({
          where: { operationCode: createdOp.operationCode },
          include: { hrUsages: true, materialUsages: true },
        });
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

      if (dto.operationStatus) {
        const workOrder = await this.prisma.mntWorkOrder.findFirst({
          where: { workOrderCode: existing.workOrderCode },
        });

        if (workOrder && !isOperationStatusCompatible(workOrder.woStatusCode, dto.operationStatus)) {
          throw new RpcException({
            status: 400,
            message: `Operation status ${dto.operationStatus} is not compatible with work order status ${workOrder.woStatusCode}`,
          });
        }
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
