import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy, RpcException } from "@nestjs/microservices";
import type { Prisma } from "generated/prisma/client";
import { PrismaService } from "src/prisma.service";
import { NATS_SERVICE } from "src/config/services";
import { OracleWorkOrderPolicy } from "src/work-orders/policies";
import { OracleEquivalences } from "src/common/oracle";
import {
  CreateWoOperationDto,
  UpdateWoOperationDto,
  CancelWoOperationDto,
  FindAllWoOperationDto,
  WoOperationFilterDto,
} from "./dto";
import {
  OP_STATUS,
  isOperationStatusCompatible,
  isValidOpTransition,
} from "src/common/enums";

const VALID_OP_STATUSES = Object.values(OP_STATUS);

// Todas las columnas de mnt_wo_operations.
const FIND_ALL_FILTER_FIELDS = new Set([
  "operationCode",
  "operationName",
  "operationDescription",
  "operationSeqNumber",
  "workOrderCode",
  "assetCode",
  "assetShortDescription",
  "assetTreeId",
  "unit",
  "subunit",
  "maintainableItem",
  "specialtyType",
  "operationCategory",
  "operationSubType",
  "operationStatus",
  "operationType",
  "plannedStartDate",
  "plannedCompletionDate",
  "actualStartDate",
  "actualCompletionDate",
  "plannedHours",
  "actualHours",
  "oclWorkOrderId",
  "oclWorkOrderNumber",
  "workCenterCode",
  "workCenterDescription",
  "centerCostCode",
  "workAreaCode",
  "workAreaDescription",
  "sector",
  "subsector",
  "organizationCode",
  "organizationName",
  "createdBy",
  "createdByName",
  "updatedBy",
  "updatedByName",
  "reviewedByCode",
  "reviewedByName",
  "reviewerComment",
  "pendingTask",
  "pendingTaskStatus",
  "assignedToCode",
  "assignedToName",
  "createdAt",
  "updatedAt",
  "reviewedAt",
]);

// Campos String: unicos sobre los que aplica `like` (Prisma `contains`).
const STRING_FIELDS = new Set([
  "operationName",
  "operationDescription",
  "assetCode",
  "assetShortDescription",
  "unit",
  "subunit",
  "maintainableItem",
  "specialtyType",
  "operationCategory",
  "operationSubType",
  "operationStatus",
  "operationType",
  "oclWorkOrderNumber",
  "workCenterCode",
  "workCenterDescription",
  "workAreaCode",
  "workAreaDescription",
  "sector",
  "subsector",
  "organizationCode",
  "organizationName",
  "createdBy",
  "createdByName",
  "updatedBy",
  "updatedByName",
  "reviewedByCode",
  "reviewedByName",
  "reviewerComment",
  "pendingTask",
  "pendingTaskStatus",
  "assignedToCode",
  "assignedToName",
]);

const BIGINT_FIELDS = new Set([
  "operationCode",
  "workOrderCode",
  "assetTreeId",
  "oclWorkOrderId",
]);
const NUMBER_FIELDS = new Set([
  "operationSeqNumber",
  "centerCostCode",
  "plannedHours",
  "actualHours",
]);
const DATE_FIELDS = new Set([
  "plannedStartDate",
  "plannedCompletionDate",
  "actualStartDate",
  "actualCompletionDate",
  "createdAt",
  "updatedAt",
  "reviewedAt",
]);

type WoOperationFilterOperator = "eq" | "like" | "gt" | "lt" | "in";

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

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NATS_SERVICE) private readonly natsClient: ClientProxy,
    private readonly oraclePolicy: OracleWorkOrderPolicy,
  ) {}

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
        if (
          new Date(res.actualStartDate!) >= new Date(res.actualCompletionDate!)
        ) {
          throw new RpcException({
            status: 400,
            message: `Resource "${res.resourceCode}" actualStartDate must be before actualCompletionDate`,
          });
        }
      }

      // Regla Oracle: recursos con la misma resourceSequenceNumber son simultáneos
      // y exactamente uno debe ser principal. Se calcula en backend (el principal
      // del request se ignora): primer recurso de cada secuencia con más de uno;
      // secuencias con un solo recurso quedan en 'N'.
      const principalBySequence = new Map<number, number>();
      dto.resources.forEach((res, index) => {
        if (!principalBySequence.has(res.resourceSequenceNumber!)) {
          principalBySequence.set(res.resourceSequenceNumber!, index);
        }
      });
      const sequenceCount = new Map<number, number>();
      for (const res of dto.resources) {
        const seq = res.resourceSequenceNumber!;
        sequenceCount.set(seq, (sequenceCount.get(seq) ?? 0) + 1);
      }

      const validatedResources: ValidatedResource[] = dto.resources.map(
        (res, index) => {
          const seq = res.resourceSequenceNumber!;
          const isPrincipal =
            (sequenceCount.get(seq) ?? 0) > 1 &&
            principalBySequence.get(seq) === index;
          return {
            resourceCode: res.resourceCode!,
            resourceSequenceNumber: seq,
            actualHours: res.actualHours!,
            actualStartDate: res.actualStartDate!,
            actualCompletionDate: res.actualCompletionDate!,
            principalFlag: isPrincipal ? "Y" : "N",
            hourlyCost: res.hourlyCost,
          };
        },
      );

      const asset = dto.assetCode
        ? await this.prisma.mntAsset.findFirst({
            where: { assetCode: dto.assetCode, isActive: "Y" },
          })
        : null;

      if (dto.assetCode && !asset) {
        throw new RpcException({
          status: 404,
          message: "Asset not found or inactive",
        });
      }
      if (asset && !dto.assetShortDescription) {
        dto.assetShortDescription = asset.assetShortDescription ?? undefined;
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
        if (
          !calculatedCompletionDate ||
          resCompletion > calculatedCompletionDate
        ) {
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
            assetTreeId:
              dto.assetTreeId !== undefined ? BigInt(dto.assetTreeId) : null,
            unit: dto.unit,
            subunit: dto.subunit,
            maintainableItem: dto.maintainableItem,
            specialtyType: dto.specialtyType,
            operationCategory: dto.operationCategory,
            operationSubType: workOrder.workOrderSubType,
            operationStatus: dto.operationStatus ?? OP_STATUS.UNRELEASED,
            operationType: dto.operationType,
            actualStartDate: calculatedStartDate,
            actualCompletionDate: calculatedCompletionDate,
            actualHours: calculatedActualHours,
            // Centro de costo, área, sector y organización se infieren del asset
            // (no se aceptan desde el request). Sin asset quedan en NULL.
            workCenterCode: asset?.workCenterCode ?? null,
            workCenterDescription: asset?.workCenterDescription ?? null,
            centerCostCode: asset?.centerCostCode ?? null,
            workAreaCode: asset?.workAreaCode ?? null,
            workAreaDescription: asset?.workAreaDescription ?? null,
            sector: asset?.sector ?? null,
            subsector: asset?.subsector ?? null,
            organizationCode: dto.organizationCode,
            organizationName: asset?.organizationName ?? null,
            reviewedByCode: dto.reviewedByCode,
            reviewedByName: dto.reviewedByName,
            reviewedAt: dto.reviewedAt,
            reviewerComment: dto.reviewerComment,
            pendingTask: dto.pendingTask,
            pendingTaskStatus: dto.pendingTaskStatus,
            assignedToCode: dto.assignedToCode,
            assignedToName: dto.assignedToName,
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

      if (
        workOrder.enableOracleWorkOrder === "Y" &&
        this.oraclePolicy.isOracleEnabled() &&
        operation
      ) {
        await this.emitOperationCreatedToOracle(
          operation,
          workOrder.workOrderCode,
        );
      }

      return { operation };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  // Emite wo.operation.created a oracle-fusion-integration-ms.
  // El oclWoId no se envía: integración lo resuelve desde oracle_work_orders.
  private async emitOperationCreatedToOracle(
    operation: {
      operationCode: bigint;
      operationName: string | null;
      operationDescription: string | null;
      operationSeqNumber: number | null;
      operationType: string | null;
      actualStartDate: Date | null;
      actualCompletionDate: Date | null;
      workOrderCode: bigint;
      hrUsages?: {
        resourceCode: string;
        resourceSequenceNumber: number | null;
        actualHours: number | null;
        principalFlag: string | null;
        actualStartDate: Date | null;
        actualCompletionDate: Date | null;
        status: string;
      }[];
    },
    workOrderCode: bigint,
  ) {
    const maxSeq = await this.prisma.mntWoOperation.aggregate({
      _max: { operationSeqNumber: true },
      where: {
        workOrderCode,
        operationStatus: { not: OP_STATUS.CANCELED },
      },
    });
    const isLastOperation =
      (operation.operationSeqNumber ?? 0) >=
      (maxSeq._max.operationSeqNumber ?? 0);

    const event = {
      payload: {
        enableOracleWorkOrder: "Y",
        workOrderCode: Number(workOrderCode),
        operationCode: Number(operation.operationCode),
        isLastOperation,
        operation: {
          operationName: operation.operationName ?? undefined,
          operationDescription: operation.operationDescription ?? undefined,
          operationSeqNumber: operation.operationSeqNumber ?? undefined,
          operationType: operation.operationType ?? undefined,
          oracleOperationType:
            OracleEquivalences.WorkOrderOperation.OperationType[
              operation.operationType as keyof typeof OracleEquivalences.WorkOrderOperation.OperationType
            ] ?? "IN_HOUSE",
          workCenterCode:
            OracleEquivalences.WorkCenterCode.MaintenanceDepartment,
          actualStartDate: operation.actualStartDate?.toISOString(),
          actualCompletionDate: operation.actualCompletionDate?.toISOString(),
        },
        resources: (operation.hrUsages ?? [])
          .filter((hr) => hr.status !== "CANCELED")
          .map((hr) => ({
            resourceCode: hr.resourceCode,
            resourceSequenceNumber: hr.resourceSequenceNumber ?? undefined,
            actualHours: hr.actualHours ?? undefined,
            principalFlag: hr.principalFlag ?? "N",
            actualStartDate: hr.actualStartDate?.toISOString(),
            actualCompletionDate: hr.actualCompletionDate?.toISOString(),
          })),
      },
    };

    this.natsClient.emit("wo.operation.created", event).subscribe({
      error: (err: unknown) =>
        this.logger.error("Failed to emit wo.operation.created", err),
    });
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
      const where = this.buildFindAllWhere(dto);
      const orderBy = this.buildFindAllOrder(dto.order);
      const take = this.parsePaginationValue(dto.limit);
      const skip = this.parsePaginationValue(dto.offset);

      const [operations, total] = await this.prisma.$transaction([
        this.prisma.mntWoOperation.findMany({ where, orderBy, take, skip }),
        this.prisma.mntWoOperation.count({ where }),
      ]);

      return { operations, total };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  private buildFindAllWhere(
    dto: FindAllWoOperationDto,
  ): Prisma.MntWoOperationWhereInput {
    const conditions: Prisma.MntWoOperationWhereInput[] = [];

    if (dto.workOrderCode) {
      conditions.push({ workOrderCode: BigInt(dto.workOrderCode) });
    }
    if (dto.assetCode) {
      conditions.push({ assetCode: { contains: dto.assetCode } });
    }
    if (dto.operationStatus) {
      conditions.push({ operationStatus: dto.operationStatus });
    }
    if (dto.assignedToCode) {
      conditions.push({ assignedToCode: { contains: dto.assignedToCode } });
    }
    if (dto.assignedToName) {
      conditions.push({ assignedToName: { contains: dto.assignedToName } });
    }

    if (dto.filters !== undefined) {
      if (!Array.isArray(dto.filters)) {
        throw this.invalidFilterDataException();
      }
      conditions.push(
        ...dto.filters.map((filter) => this.mapFilterToWhereCondition(filter)),
      );
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private buildFindAllOrder(
    order: FindAllWoOperationDto["order"],
  ): Prisma.MntWoOperationOrderByWithRelationInput[] {
    const defaultOrder: Prisma.MntWoOperationOrderByWithRelationInput[] = [
      { operationSeqNumber: "asc" },
      { operationCode: "asc" },
    ];

    if (order === undefined) {
      return defaultOrder;
    }

    if (!Array.isArray(order)) {
      throw this.invalidFilterDataException();
    }

    const mapped = order.map((criterion) => {
      if (!Array.isArray(criterion) || criterion.length !== 2) {
        throw this.invalidFilterDataException();
      }

      const [rawField, rawDirection] = criterion;
      if (
        typeof rawField !== "string" ||
        !FIND_ALL_FILTER_FIELDS.has(rawField) ||
        typeof rawDirection !== "string"
      ) {
        throw this.invalidFilterDataException();
      }

      const direction = rawDirection.toLowerCase();
      if (direction !== "asc" && direction !== "desc") {
        throw this.invalidFilterDataException();
      }

      return {
        [rawField]: direction,
      } as Prisma.MntWoOperationOrderByWithRelationInput;
    });

    return mapped.length > 0 ? mapped : defaultOrder;
  }

  private parsePaginationValue(value?: number): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!Number.isInteger(value) || value < 0) {
      throw this.invalidFilterDataException();
    }

    return value;
  }

  private mapFilterToWhereCondition(
    filter: WoOperationFilterDto,
  ): Prisma.MntWoOperationWhereInput {
    if (!filter || typeof filter !== "object") {
      throw this.invalidFilterDataException();
    }

    const { field, operator, value } = filter;

    if (
      typeof field !== "string" ||
      !FIND_ALL_FILTER_FIELDS.has(field) ||
      typeof operator !== "string"
    ) {
      throw this.invalidFilterDataException();
    }

    const normalizedOperator =
      operator.toLowerCase() as WoOperationFilterOperator;

    switch (normalizedOperator) {
      case "eq": {
        return {
          [field]: this.normalizeFieldValue(field, value),
        } as Prisma.MntWoOperationWhereInput;
      }
      case "like": {
        if (!STRING_FIELDS.has(field) || typeof value !== "string") {
          throw this.invalidFilterDataException();
        }
        return {
          [field]: { contains: value },
        } as Prisma.MntWoOperationWhereInput;
      }
      case "gt": {
        return {
          [field]: { gt: this.normalizeFieldValue(field, value) },
        } as Prisma.MntWoOperationWhereInput;
      }
      case "lt": {
        return {
          [field]: { lt: this.normalizeFieldValue(field, value) },
        } as Prisma.MntWoOperationWhereInput;
      }
      case "in": {
        if (!Array.isArray(value)) {
          throw this.invalidFilterDataException();
        }
        return {
          [field]: {
            in: value.map((item) => this.normalizeFieldValue(field, item)),
          },
        } as Prisma.MntWoOperationWhereInput;
      }
      default:
        throw this.invalidFilterDataException();
    }
  }

  private normalizeFieldValue(
    field: string,
    value: unknown,
  ): bigint | number | Date | string {
    if (BIGINT_FIELDS.has(field)) {
      if (typeof value === "bigint") return value;
      if (
        (typeof value === "number" && Number.isInteger(value)) ||
        (typeof value === "string" && /^-?\d+$/.test(value.trim()))
      ) {
        return BigInt(value as number | string);
      }
      throw this.invalidFilterDataException();
    }

    if (NUMBER_FIELDS.has(field)) {
      const parsed =
        typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : value;
      if (typeof parsed === "number" && Number.isFinite(parsed)) {
        return parsed;
      }
      throw this.invalidFilterDataException();
    }

    if (DATE_FIELDS.has(field)) {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
      }
      if (typeof value === "string" && isValidIsoDate(value)) {
        return new Date(value);
      }
      throw this.invalidFilterDataException();
    }

    if (typeof value !== "string") {
      throw this.invalidFilterDataException();
    }

    return value;
  }

  private invalidFilterDataException(): RpcException {
    return new RpcException({
      status: 400,
      message: "Invalid filter data",
    });
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

        if (
          workOrder &&
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
      }

      const calculatedFields = [
        "actualHours",
        "actualStartDate",
        "actualCompletionDate",
      ];
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
          ...(dto.assetTreeId !== undefined
            ? {
                assetTreeId:
                  dto.assetTreeId !== null ? BigInt(dto.assetTreeId) : null,
              }
            : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
          ...(dto.subunit !== undefined ? { subunit: dto.subunit } : {}),
          ...(dto.maintainableItem !== undefined
            ? { maintainableItem: dto.maintainableItem }
            : {}),
          ...(dto.specialtyType !== undefined
            ? { specialtyType: dto.specialtyType }
            : {}),
          ...(dto.reviewedByCode !== undefined
            ? { reviewedByCode: dto.reviewedByCode }
            : {}),
          ...(dto.reviewedByName !== undefined
            ? { reviewedByName: dto.reviewedByName }
            : {}),
          ...(dto.reviewedAt !== undefined
            ? { reviewedAt: dto.reviewedAt }
            : {}),
          ...(dto.reviewerComment !== undefined
            ? { reviewerComment: dto.reviewerComment }
            : {}),
          ...(dto.pendingTask !== undefined
            ? { pendingTask: dto.pendingTask }
            : {}),
          ...(dto.pendingTaskStatus !== undefined
            ? { pendingTaskStatus: dto.pendingTaskStatus }
            : {}),
          ...(dto.assignedToCode !== undefined
            ? { assignedToCode: dto.assignedToCode }
            : {}),
          ...(dto.assignedToName !== undefined
            ? { assignedToName: dto.assignedToName }
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
            if (
              !woActualCompletionDate ||
              op.actualCompletionDate > woActualCompletionDate
            ) {
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
