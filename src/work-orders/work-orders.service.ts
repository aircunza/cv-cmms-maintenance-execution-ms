import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import type { Prisma } from "generated/prisma/client";
import { PrismaService } from "src/prisma.service";
import {
  CreateWorkOrderMessageDto,
  UpdateWorkOrderDto,
  FindAllWorkOrderDto,
  WorkOrderCodeDto,
  WorkOrderFilterDto,
  isValidTypeSubtypeCombination,
} from "./dto";
import {
  WO_STATUS,
  isValidWoTransition,
  OP_STATUS,
  isOperationStatusCompatible,
} from "src/common/enums";
import { WorkOrderSubTypePolicy, OracleWorkOrderPolicy } from "./policies";

const INVALID_FILTER_DATA_MESSAGE = "Invalid filter data";
const FIND_ALL_FILTER_FIELDS = new Set([
  "workOrderCode",
  "assetCode",
  "workOrderDescription",
  "woStatusCode",
  "workOrderType",
  "workOrderSubType",
  "organizationCode",
  "workCenterCode",
  "workAreaCode",
  "createdAt",
  "actualStartDate",
  "actualCompletionDate",
  "releasedDate",
  "closedDate",
  "canceledDate",
]);

const STRING_FIELDS = new Set([
  "assetCode",
  "workOrderDescription",
  "woStatusCode",
  "workOrderType",
  "workOrderSubType",
  "organizationCode",
  "workCenterCode",
  "workAreaCode",
]);

const DATE_FIELDS = new Set([
  "createdAt",
  "actualStartDate",
  "actualCompletionDate",
  "releasedDate",
  "closedDate",
  "canceledDate",
]);

type WorkOrderFilterOperator = "eq" | "like" | "gt" | "lt" | "in";

const VALID_OP_STATUSES = Object.values(OP_STATUS);

function toTitleCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isValidIsoDate(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subtypePolicy: WorkOrderSubTypePolicy,
    private readonly oraclePolicy: OracleWorkOrderPolicy,
  ) {}

  async create(dto: CreateWorkOrderMessageDto) {
    try {
      if (
        !isValidTypeSubtypeCombination(dto.workOrderType, dto.workOrderSubType)
      ) {
        throw new RpcException({
          status: 400,
          message: `Invalid combination of workOrderType "${dto.workOrderType}" and workOrderSubType "${dto.workOrderSubType}"`,
        });
      }

      if (!/^[A-Z][A-Z0-9_]*$/.test(dto.woStatusCode)) {
        throw new RpcException({
          status: 400,
          message: `woStatusCode "${dto.woStatusCode}" must be a valid UPPER_SNAKE_CASE status`,
        });
      }

      if (!dto.userPermissions.includes("mnt.work.orders.create")) {
        throw new RpcException({
          status: 403,
          message: "MISSING_PERMISSION",
        });
      }

      if (dto.enableOracleWorkOrder === "Y") {
        const oracleCheck = this.oraclePolicy.validateCreate(
          dto.userPermissions,
          dto.userRoles,
        );
        if (!oracleCheck.valid) {
          throw new RpcException({
            status: 403,
            message: oracleCheck.error,
          });
        }
      }

      if (
        !this.subtypePolicy.canCreateSubType(
          dto.userRoles,
          dto.workOrderSubType,
        )
      ) {
        throw new RpcException({
          status: 403,
          message: "SUBTYPE_NOT_ALLOWED_FOR_ROLE",
        });
      }

      const asset = await this.prisma.mntAsset.findFirst({
        where: { assetCode: dto.assetCode, isActive: "Y" },
      });

      if (!asset) {
        throw new RpcException({
          status: 404,
          message: "Asset not found or inactive",
        });
      }

      if (asset.organizationCode !== dto.organizationCode) {
        throw new RpcException({
          status: 403,
          message: "ORGANIZATION_MISMATCH",
        });
      }

      if (dto.workRequestId) {
        const wr = await this.prisma.mntWorkRequest.findFirst({
          where: { requestId: BigInt(dto.workRequestId) },
        });
        if (!wr) {
          throw new RpcException({
            status: 404,
            message: "Work request not found",
          });
        }
      }

      let operations = dto.operations;

      if (!operations || operations.length === 0) {
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 3600000);
        operations = [
          {
            operationName: "DEFAULT_OPERATION",
            operationDescription: "Auto-generated default operation",
            operationSeqNumber: 1,
            createdBy: dto.actorId,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: dto.workOrderSubType,
            actualStartDate: now.toISOString(),
            actualCompletionDate: oneHourLater.toISOString(),
            workOrderOperationResource: [
              {
                resourceCode: "DEFAULT_RESOURCE",
                resourceSequenceNumber: 0,
                plannedHours: 1,
                actualHours: 1,
                principalFlag: "N",
              },
            ],
          },
        ];
      }

      for (const op of operations) {
        if (op.operationSubType !== dto.workOrderSubType) {
          throw new RpcException({
            status: 400,
            message: `Operation "${op.operationName}" has operationSubType "${op.operationSubType}" that does not match workOrderSubType "${dto.workOrderSubType}"`,
          });
        }

        if (
          !isValidIsoDate(op.actualStartDate) ||
          !isValidIsoDate(op.actualCompletionDate)
        ) {
          throw new RpcException({
            status: 400,
            message: `Operation "${op.operationName}" has invalid ISO 8601 date fields`,
          });
        }

        const startDate = new Date(op.actualStartDate);
        const completionDate = new Date(op.actualCompletionDate);
        if (startDate >= completionDate) {
          throw new RpcException({
            status: 400,
            message: `Operation "${op.operationName}" actualStartDate must be before actualCompletionDate`,
          });
        }

        if (op.operationName.length < 2 || op.operationName.length > 120) {
          throw new RpcException({
            status: 400,
            message: `Operation "${op.operationName}" name must be between 2 and 120 characters`,
          });
        }

        if (op.operationDescription.length > 240) {
          throw new RpcException({
            status: 400,
            message: `Operation "${op.operationName}" description exceeds 240 characters`,
          });
        }

        if (!isValidUuid(op.createdBy)) {
          throw new RpcException({
            status: 400,
            message: `Operation "${op.operationName}" has invalid createdBy UUID`,
          });
        }

        if (
          op.operationType !== "Internal" &&
          op.operationType !== "Supplier"
        ) {
          throw new RpcException({
            status: 400,
            message: `Operation "${op.operationName}" operationType must be "Internal" or "Supplier"`,
          });
        }

        if (!VALID_OP_STATUSES.includes(op.operationStatus as any)) {
          throw new RpcException({
            status: 400,
            message: `Operation "${op.operationName}" has invalid operationStatus "${op.operationStatus}"`,
          });
        }

        if (
          !op.workOrderOperationResource ||
          op.workOrderOperationResource.length === 0
        ) {
          throw new RpcException({
            status: 400,
            message: `Operation "${op.operationName}" must have at least one resource`,
          });
        }

        for (const res of op.workOrderOperationResource) {
          if (res.plannedHours <= 0) {
            throw new RpcException({
              status: 400,
              message: `Operation "${op.operationName}" resource "${res.resourceCode}" plannedHours must be greater than 0`,
            });
          }
          if (res.actualHours <= 0) {
            throw new RpcException({
              status: 400,
              message: `Operation "${op.operationName}" resource "${res.resourceCode}" actualHours must be greater than 0`,
            });
          }
          if (
            res.resourceSequenceNumber < 0 ||
            !Number.isInteger(res.resourceSequenceNumber)
          ) {
            throw new RpcException({
              status: 400,
              message: `Operation "${op.operationName}" resource "${res.resourceCode}" resourceSequenceNumber must be a non-negative integer`,
            });
          }
        }
      }

      const seqNumbers = operations.map((op) => op.operationSeqNumber);
      const uniqueSeqs = new Set(seqNumbers);
      if (uniqueSeqs.size !== seqNumbers.length) {
        throw new RpcException({
          status: 400,
          message:
            "Duplicate operationSeqNumber found. Each operation must have a unique sequence number",
        });
      }

      const sortedOps = [...operations].sort(
        (a, b) => a.operationSeqNumber - b.operationSeqNumber,
      );
      for (let i = 1; i < sortedOps.length; i++) {
        const prevStart = new Date(sortedOps[i - 1].actualStartDate);
        const currStart = new Date(sortedOps[i].actualStartDate);
        if (currStart < prevStart) {
          throw new RpcException({
            status: 400,
            message: `Operation with seqNumber ${sortedOps[i].operationSeqNumber} starts before operation with seqNumber ${sortedOps[i - 1].operationSeqNumber}`,
          });
        }
      }

      for (const op of operations) {
        if (
          !isOperationStatusCompatible(dto.woStatusCode, op.operationStatus)
        ) {
          throw new RpcException({
            status: 400,
            message: `Operation "${op.operationName}" status "${op.operationStatus}" is not compatible with work order status "${dto.woStatusCode}"`,
          });
        }
      }

      const processedOperations = operations.map((op) => {
        const groupedBySeq: Record<number, number[]> = {};
        for (const res of op.workOrderOperationResource) {
          if (!groupedBySeq[res.resourceSequenceNumber]) {
            groupedBySeq[res.resourceSequenceNumber] = [];
          }
          groupedBySeq[res.resourceSequenceNumber].push(res.actualHours);
        }

        let calculatedActualHours = 0;
        for (const seq of Object.keys(groupedBySeq)) {
          const hours = groupedBySeq[Number(seq)];
          calculatedActualHours += Math.max(...hours);
        }

        const startDate = new Date(op.actualStartDate);
        const calculatedCompletionDate = new Date(
          startDate.getTime() + calculatedActualHours * 3600000,
        );

        return {
          ...op,
          calculatedActualHours,
          calculatedCompletionDate,
        };
      });

      let woActualHours = 0;
      let totalManHours = 0;
      let totalSupplierHours = 0;
      let woActualStartDate: Date | null = null;
      let woActualCompletionDate: Date | null = null;

      for (const op of processedOperations) {
        woActualHours += op.calculatedActualHours;

        for (const res of op.workOrderOperationResource) {
          if (op.operationType === "Internal") {
            totalManHours += res.actualHours;
          } else {
            totalSupplierHours += res.actualHours;
          }
        }

        const opStart = new Date(op.actualStartDate);
        const opCompletion = op.calculatedCompletionDate;

        if (!woActualStartDate || opStart < woActualStartDate) {
          woActualStartDate = opStart;
        }
        if (!woActualCompletionDate || opCompletion > woActualCompletionDate) {
          woActualCompletionDate = opCompletion;
        }
      }

      const woStatusLabel = toTitleCase(dto.woStatusCode);

      const workOrder = await this.prisma.$transaction(async (tx) => {
        const wo = await tx.mntWorkOrder.create({
          data: {
            workOrderDescription: dto.workOrderDescription,
            assetCode: dto.assetCode,
            assetShortDescription: asset.assetShortDescription ?? undefined,
            workOrderType: dto.workOrderType,
            workOrderSubType: dto.workOrderSubType,
            workDefinitionCode: dto.workDefinitionCode,
            workOrderPriority: dto.workOrderPriority,
            woStatusCode: dto.woStatusCode,
            schedulingMethod: dto.schedulingMethod,
            plannedStartDate: dto.plannedStartDate,
            plannedCompletionDate: dto.plannedCompletionDate,
            needByDate: dto.needByDate,
            workRequestId: dto.workRequestId ? BigInt(dto.workRequestId) : null,
            workCenterCode: asset.workCenterCode ?? undefined,
            workCenterDescription: asset.workCenterDescription ?? undefined,
            centerCostCode: asset.centerCostCode ?? undefined,
            workAreaCode: asset.workAreaCode ?? undefined,
            workAreaDescription: asset.workAreaDescription ?? undefined,
            sector: asset.sector ?? undefined,
            subsector: asset.subsector ?? undefined,
            organizationCode: asset.organizationCode,
            organizationName: asset.organizationName ?? undefined,
            createdBy: dto.actorId,
            createdByName: dto.actorName,
            enableOracleWorkOrder: dto.enableOracleWorkOrder,
            actualHours: woActualHours,
            totalManHours,
            totalSupplierHours,
            actualStartDate: woActualStartDate,
            actualCompletionDate: woActualCompletionDate,
          },
        });

        for (const op of processedOperations) {
          const createdOp = await tx.mntWoOperation.create({
            data: {
              operationName: op.operationName,
              operationDescription: op.operationDescription,
              operationSeqNumber: op.operationSeqNumber,
              workOrderCode: wo.workOrderCode,
              assetCode: dto.assetCode,
              assetShortDescription: asset.assetShortDescription ?? undefined,
              unit: op.unit,
              subunit: op.subunit,
              maintainableItem: op.maintainableItem,
              operationCategory: op.operationCategory,
              operationSubType: op.operationSubType,
              operationStatus: op.operationStatus,
              operationType: op.operationType,
              actualStartDate: new Date(op.actualStartDate),
              actualCompletionDate: op.calculatedCompletionDate,
              actualHours: op.calculatedActualHours,
              workCenterCode: asset.workCenterCode ?? undefined,
              workCenterDescription: asset.workCenterDescription ?? undefined,
              centerCostCode: asset.centerCostCode ?? undefined,
              workAreaCode: asset.workAreaCode ?? undefined,
              workAreaDescription: asset.workAreaDescription ?? undefined,
              sector: asset.sector ?? undefined,
              subsector: asset.subsector ?? undefined,
              organizationCode: asset.organizationCode,
              organizationName: asset.organizationName ?? undefined,
              createdBy: op.createdBy,
              createdByName: dto.actorName,
            },
          });

          for (const res of op.workOrderOperationResource) {
            await tx.mntOperationHumanResourceUsage.create({
              data: {
                operationCode: createdOp.operationCode,
                organizationCode: asset.organizationCode,
                resourceCode: res.resourceCode,
                plannedHours: res.plannedHours,
                actualHours: res.actualHours,
                hourlyCost: res.hourlyCost,
                principalFlag: res.principalFlag ?? "N",
                resourceSequenceNumber: res.resourceSequenceNumber,
                plannedStartDate: res.plannedStartDate,
                plannedCompletionDate: res.plannedCompletionDate,
                createdBy: dto.actorId,
                createdByName: dto.actorName,
              },
            });
          }

          if (
            op.workOrderOperationMaterial &&
            op.workOrderOperationMaterial.length > 0
          ) {
            for (const mat of op.workOrderOperationMaterial) {
              await tx.mntOperationMaterialUsage.create({
                data: {
                  operationCode: createdOp.operationCode,
                  organizationCode: asset.organizationCode,
                  materialCode: mat.materialCode,
                  quantity: mat.quantity,
                  supplyType: mat.supplyType ?? "1",
                  materialSequenceNumber: mat.materialSequenceNumber,
                  createdBy: dto.actorId,
                  createdByName: dto.actorName,
                },
              });
            }
          }
        }

        return wo;
      });

      const fullWorkOrder = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: workOrder.workOrderCode },
        include: {
          woOperations: {
            include: {
              hrUsages: true,
              materialUsages: true,
            },
          },
        },
      });

      const response = this.mapToResponse(fullWorkOrder!);

      return { workOrder: response };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  private mapToResponse(wo: any) {
    return {
      workOrderCode: wo.workOrderCode.toString(),
      workOrderDescription: wo.workOrderDescription,
      assetCode: wo.assetCode,
      assetShortDescription: wo.assetShortDescription,
      woStatusCode: wo.woStatusCode,
      woStatusLabel: toTitleCase(wo.woStatusCode),
      workOrderType: wo.workOrderType,
      workOrderSubType: wo.workOrderSubType,
      workOrderPriority: wo.workOrderPriority,
      workCenterCode: wo.workCenterCode,
      workCenterDescription: wo.workCenterDescription,
      centerCostCode: wo.centerCostCode,
      workAreaCode: wo.workAreaCode,
      workAreaDescription: wo.workAreaDescription,
      sector: wo.sector,
      subsector: wo.subsector,
      organizationCode: wo.organizationCode,
      organizationName: wo.organizationName,
      createdBy: wo.createdBy,
      createdByName: wo.createdByName,
      updatedBy: wo.updatedBy,
      updatedByName: wo.updatedByName,
      createdAt: wo.createdAt,
      updatedAt: wo.updatedAt,
      actualStartDate: wo.actualStartDate,
      actualCompletionDate: wo.actualCompletionDate,
      actualHours: wo.actualHours,
      totalManHours: wo.totalManHours,
      totalSupplierHours: wo.totalSupplierHours,
      plannedHours: wo.plannedHours,
      workRequestId: wo.workRequestId?.toString() ?? null,
      enableOracleWorkOrder: wo.enableOracleWorkOrder,
      oclWorkOrderId: wo.oclWorkOrderId?.toString() ?? null,
      oclWorkOrderNumber: wo.oclWorkOrderNumber,
      releasedDate: wo.releasedDate,
      closedDate: wo.closedDate,
      canceledDate: wo.canceledDate,
      canceledReason: wo.canceledReason,
      operations: wo.woOperations?.map((op: any) => ({
        operationCode: op.operationCode.toString(),
        operationName: op.operationName,
        operationDescription: op.operationDescription,
        operationSeqNumber: op.operationSeqNumber,
        assetCode: op.assetCode,
        assetShortDescription: op.assetShortDescription,
        operationStatus: op.operationStatus,
        operationStatusLabel: toTitleCase(op.operationStatus),
        operationType: op.operationType,
        operationSubType: op.operationSubType,
        actualStartDate: op.actualStartDate,
        actualCompletionDate: op.actualCompletionDate,
        actualHours: op.actualHours,
        workCenterCode: op.workCenterCode,
        workCenterDescription: op.workCenterDescription,
        workAreaCode: op.workAreaCode,
        workAreaDescription: op.workAreaDescription,
        organizationCode: op.organizationCode,
        organizationName: op.organizationName,
        createdBy: op.createdBy,
        createdByName: op.createdByName,
        createdAt: op.createdAt,
        updatedAt: op.updatedAt,
        workOrderOperationResource: op.hrUsages?.map((hr: any) => ({
          id: hr.id.toString(),
          resourceCode: hr.resourceCode,
          resourceSequenceNumber: hr.resourceSequenceNumber,
          plannedHours: hr.plannedHours,
          actualHours: hr.actualHours,
          principalFlag: hr.principalFlag,
          organizationCode: hr.organizationCode,
          createdBy: hr.createdBy,
          createdByName: hr.createdByName,
          createdAt: hr.createdAt,
          updatedAt: hr.updatedAt,
          transactedInOracle: hr.transactedInOracle,
          oclWoOperationResourceId:
            hr.oclWoOperationResourceId?.toString() ?? null,
          syncedToOracleAt: hr.syncedToOracleAt,
        })),
        workOrderOperationMaterial: op.materialUsages?.map((mat: any) => ({
          id: mat.id.toString(),
          materialCode: mat.materialCode,
          materialName: mat.materialName,
          materialSequenceNumber: mat.materialSequenceNumber,
          quantity: mat.quantity,
          supplyType: mat.supplyType,
          unitCost: mat.unitCost?.toString() ?? null,
          totalCost: mat.totalCost?.toString() ?? null,
          organizationCode: mat.organizationCode,
          createdBy: mat.createdBy,
          createdByName: mat.createdByName,
          createdAt: mat.createdAt,
          updatedAt: mat.updatedAt,
          transactedInOracle: mat.transactedInOracle,
          oclWoOperationMaterialId:
            mat.oclWoOperationMaterialId?.toString() ?? null,
          syncedToOracleAt: mat.syncedToOracleAt,
        })),
      })),
    };
  }

  async findOne(dto: WorkOrderCodeDto) {
    try {
      this.validateReadContext(dto);

      const workOrder = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(String(dto.workOrderCode)) },
        include: {
          woOperations: {
            include: {
              hrUsages: true,
              materialUsages: true,
            },
          },
        },
      });

      if (!workOrder) {
        throw new RpcException({
          status: 404,
          message: "Work order not found",
        });
      }

      if (workOrder.organizationCode !== dto.organizationCode) {
        throw new RpcException({
          status: 403,
          message: "ORGANIZATION_MISMATCH",
        });
      }

      if (
        !this.canAccessSubType(dto.userRoles, workOrder.workOrderSubType ?? "")
      ) {
        throw new RpcException({
          status: 403,
          message: "SUBTYPE_NOT_ALLOWED_FOR_ROLE",
        });
      }

      return { workOrder: this.mapToResponse(workOrder) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findAll(dto: FindAllWorkOrderDto) {
    try {
      this.validateReadContext(dto);

      const where = this.buildFindAllWhere(dto);
      const orderBy = this.buildFindAllOrder(dto.order);
      const take = this.parsePaginationValue(dto.limit);
      const skip = this.parsePaginationValue(dto.offset);

      const [workOrders, total] = await this.prisma.$transaction([
        this.prisma.mntWorkOrder.findMany({
          where,
          orderBy,
          take,
          skip,
          include: {
            woOperations: {
              include: {
                hrUsages: true,
                materialUsages: true,
              },
            },
          },
        }),
        this.prisma.mntWorkOrder.count({ where }),
      ]);

      return {
        workOrders: workOrders.map((wo) => this.mapToResponse(wo)),
        total,
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  private validateReadContext(dto: {
    organizationCode?: string;
    userRoles?: string[];
  }) {
    if (
      typeof dto.organizationCode !== "string" ||
      dto.organizationCode.trim().length === 0
    ) {
      throw new RpcException({
        status: 400,
        message: "organizationCode is required",
      });
    }

    if (
      !Array.isArray(dto.userRoles) ||
      dto.userRoles.some(
        (role) => typeof role !== "string" || role.trim().length === 0,
      )
    ) {
      throw new RpcException({
        status: 400,
        message: "userRoles must be a non-empty array",
      });
    }
  }

  private canAccessSubType(
    userRoles: string[] | undefined,
    workOrderSubType: string,
  ): boolean {
    if (!userRoles || userRoles.length === 0) {
      return false;
    }

    return userRoles.some((role) =>
      this.subtypePolicy.canCreateSubType([role], workOrderSubType),
    );
  }

  private buildFindAllWhere(
    dto: FindAllWorkOrderDto,
  ): Prisma.MntWorkOrderWhereInput {
    const conditions: Prisma.MntWorkOrderWhereInput[] = [];

    if (dto.organizationCode) {
      conditions.push({ organizationCode: dto.organizationCode });
    }

    if (dto.assetCode) {
      conditions.push({ assetCode: { contains: dto.assetCode } });
    }

    if (dto.woStatusCode) {
      conditions.push({ woStatusCode: dto.woStatusCode });
    }

    if (dto.workOrderType) {
      conditions.push({ workOrderType: dto.workOrderType });
    }

    if (dto.workOrderSubType) {
      if (!this.canAccessSubType(dto.userRoles, dto.workOrderSubType)) {
        throw new RpcException({
          status: 403,
          message: "SUBTYPE_NOT_ALLOWED_FOR_ROLE",
        });
      }
      conditions.push({ workOrderSubType: dto.workOrderSubType });
    } else {
      const allowedSubTypes = this.getAllowedSubTypes(dto.userRoles ?? []);
      if (allowedSubTypes.length > 0) {
        conditions.push({ workOrderSubType: { in: allowedSubTypes } });
      }
    }

    if (dto.filters) {
      if (!Array.isArray(dto.filters)) {
        throw this.invalidFilterDataException();
      }

      const filters = dto.filters.map((filter) =>
        this.mapFilterToWhereCondition(filter, dto.userRoles),
      );
      conditions.push(...filters);
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private buildFindAllOrder(
    order: FindAllWorkOrderDto["order"],
  ): Prisma.MntWorkOrderOrderByWithRelationInput[] {
    if (order === undefined) {
      return [{ createdAt: "desc" }, { workOrderCode: "desc" }];
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
      } as Prisma.MntWorkOrderOrderByWithRelationInput;
    });

    return mapped.length > 0
      ? mapped
      : [{ createdAt: "desc" }, { workOrderCode: "desc" }];
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
    filter: WorkOrderFilterDto,
    userRoles?: string[],
  ): Prisma.MntWorkOrderWhereInput {
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

    if (
      field === "workOrderSubType" &&
      typeof value === "string" &&
      !this.canAccessSubType(userRoles, value)
    ) {
      throw new RpcException({
        status: 403,
        message: "SUBTYPE_NOT_ALLOWED_FOR_ROLE",
      });
    }

    const normalizedOperator =
      operator.toLowerCase() as WorkOrderFilterOperator;

    switch (normalizedOperator) {
      case "eq": {
        const normalizedValue = this.normalizeFieldValue(field, value);
        return { [field]: normalizedValue } as Prisma.MntWorkOrderWhereInput;
      }
      case "like": {
        if (!STRING_FIELDS.has(field) || typeof value !== "string") {
          throw this.invalidFilterDataException();
        }
        return {
          [field]: { contains: value },
        } as Prisma.MntWorkOrderWhereInput;
      }
      case "gt": {
        const normalizedValue = this.normalizeFieldValue(field, value);
        return {
          [field]: { gt: normalizedValue },
        } as Prisma.MntWorkOrderWhereInput;
      }
      case "lt": {
        const normalizedValue = this.normalizeFieldValue(field, value);
        return {
          [field]: { lt: normalizedValue },
        } as Prisma.MntWorkOrderWhereInput;
      }
      case "in": {
        if (!Array.isArray(value)) {
          throw this.invalidFilterDataException();
        }
        const normalizedValues = value.map((item) =>
          this.normalizeFieldValue(field, item),
        );
        return {
          [field]: { in: normalizedValues },
        } as Prisma.MntWorkOrderWhereInput;
      }
      default:
        throw this.invalidFilterDataException();
    }
  }

  private normalizeFieldValue(field: string, value: unknown) {
    if (field === "workOrderCode") {
      return BigInt(String(value));
    }

    if (DATE_FIELDS.has(field)) {
      if (value instanceof Date) {
        return value;
      }
      return new Date(String(value));
    }

    return value;
  }

  private getAllowedSubTypes(userRoles: string[]): string[] {
    const allowed = new Set<string>();
    for (const role of userRoles) {
      const roleAllowed = this.subtypePolicy.canCreateSubType(
        [role],
        "Preventive",
      );
      if (roleAllowed) {
        allowed.add("Preventive");
      }
      if (this.subtypePolicy.canCreateSubType([role], "Corrective")) {
        allowed.add("Corrective");
      }
      if (this.subtypePolicy.canCreateSubType([role], "Emergency")) {
        allowed.add("Emergency");
      }
      if (this.subtypePolicy.canCreateSubType([role], "Inspection")) {
        allowed.add("Inspection");
      }
      if (this.subtypePolicy.canCreateSubType([role], "TPM")) {
        allowed.add("TPM");
      }
    }
    return Array.from(allowed);
  }

  private invalidFilterDataException() {
    return new RpcException({
      status: 400,
      message: INVALID_FILTER_DATA_MESSAGE,
    });
  }

  async update(
    dto: UpdateWorkOrderDto & {
      workOrderCode: number | string;
      organizationCode: string;
      userPermissions: string[];
      userRoles: string[];
      actorId: string;
      actorName: string;
    },
  ) {
    try {
      this.validateReadContext(dto);

      if (
        typeof dto.enableOracleWorkOrder !== "string" ||
        !["Y", "N"].includes(dto.enableOracleWorkOrder)
      ) {
        throw new RpcException({
          status: 400,
          message: 'enableOracleWorkOrder is required and must be "Y" or "N"',
        });
      }

      if (!dto.userPermissions.includes("mnt.work.orders.update")) {
        throw new RpcException({
          status: 403,
          message: "MISSING_PERMISSION",
        });
      }

      if (dto.enableOracleWorkOrder === "Y") {
        const oracleResult = this.oraclePolicy.validateUpdate(
          dto.userPermissions,
          dto.userRoles,
        );
        if (!oracleResult.valid) {
          throw new RpcException({
            status: 403,
            message: oracleResult.error,
          });
        }
      }

      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(String(dto.workOrderCode)) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work order not found",
        });
      }

      if (existing.organizationCode !== dto.organizationCode) {
        throw new RpcException({
          status: 403,
          message: "ORGANIZATION_MISMATCH",
        });
      }

      if (
        dto.workOrderType !== undefined ||
        dto.workOrderSubType !== undefined
      ) {
        const type = dto.workOrderType ?? existing.workOrderType ?? "";
        const subType = dto.workOrderSubType ?? existing.workOrderSubType ?? "";

        if (!isValidTypeSubtypeCombination(type, subType)) {
          throw new RpcException({
            status: 400,
            message: `Invalid combination of workOrderType "${type}" and workOrderSubType "${subType}"`,
          });
        }
      }

      if (dto.workOrderSubType !== undefined) {
        if (!this.canAccessSubType(dto.userRoles, dto.workOrderSubType)) {
          throw new RpcException({
            status: 403,
            message: "SUBTYPE_NOT_ALLOWED_FOR_ROLE",
          });
        }
      }

      if (
        dto.workOrderPriority !== undefined &&
        !["1", "2", "3", "4"].includes(dto.workOrderPriority)
      ) {
        throw new RpcException({
          status: 400,
          message: `Invalid workOrderPriority "${dto.workOrderPriority}". Must be "1", "2", "3", or "4"`,
        });
      }

      const updateData: Record<string, unknown> = {
        updatedBy: dto.actorId,
        updatedByName: dto.actorName,
        updatedAt: new Date(),
      };

      if (dto.workOrderDescription !== undefined) {
        updateData.workOrderDescription = dto.workOrderDescription;
      }
      if (dto.workOrderType !== undefined) {
        updateData.workOrderType = dto.workOrderType;
      }
      if (dto.workOrderSubType !== undefined) {
        updateData.workOrderSubType = dto.workOrderSubType;
      }
      if (dto.workOrderPriority !== undefined) {
        updateData.workOrderPriority = dto.workOrderPriority;
      }

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(String(dto.workOrderCode)) },
        data: updateData,
        include: {
          woOperations: {
            include: {
              hrUsages: true,
              materialUsages: true,
            },
          },
        },
      });

      return { workOrder: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async release(
    workOrderCode: number | string,
    organizationCode: string,
    userRoles: string[],
    actorId: string,
    actorName: string,
  ) {
    try {
      this.validateReadContext({ organizationCode, userRoles });

      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work order not found",
        });
      }

      if (existing.organizationCode !== organizationCode) {
        throw new RpcException({
          status: 403,
          message: "ORGANIZATION_MISMATCH",
        });
      }

      if (!isValidWoTransition(existing.woStatusCode, WO_STATUS.RELEASED)) {
        throw new RpcException({
          status: 400,
          message: `Cannot release work order from status ${existing.woStatusCode}`,
        });
      }

      await this.prisma.mntWoOperation.updateMany({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
        data: { operationStatus: OP_STATUS.RELEASED },
      });

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
        data: {
          woStatusCode: WO_STATUS.RELEASED,
          releasedDate: new Date(),
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
        include: {
          woOperations: {
            include: {
              hrUsages: true,
              materialUsages: true,
            },
          },
        },
      });

      return { workOrder: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async complete(
    workOrderCode: number | string,
    organizationCode: string,
    userRoles: string[],
    actorId: string,
    actorName: string,
  ) {
    try {
      this.validateReadContext({ organizationCode, userRoles });

      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work order not found",
        });
      }

      if (existing.organizationCode !== organizationCode) {
        throw new RpcException({
          status: 403,
          message: "ORGANIZATION_MISMATCH",
        });
      }

      if (!isValidWoTransition(existing.woStatusCode, WO_STATUS.COMPLETED)) {
        throw new RpcException({
          status: 400,
          message: `Cannot complete work order from status ${existing.woStatusCode}`,
        });
      }

      await this.prisma.mntWoOperation.updateMany({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
        data: { operationStatus: OP_STATUS.COMPLETED },
      });

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
        data: {
          woStatusCode: WO_STATUS.COMPLETED,
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
        include: {
          woOperations: {
            include: {
              hrUsages: true,
              materialUsages: true,
            },
          },
        },
      });

      return { workOrder: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async close(
    workOrderCode: number | string,
    organizationCode: string,
    userRoles: string[],
    actorId: string,
    actorName: string,
  ) {
    try {
      this.validateReadContext({ organizationCode, userRoles });

      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work order not found",
        });
      }

      if (existing.organizationCode !== organizationCode) {
        throw new RpcException({
          status: 403,
          message: "ORGANIZATION_MISMATCH",
        });
      }

      if (!isValidWoTransition(existing.woStatusCode, WO_STATUS.CLOSED)) {
        throw new RpcException({
          status: 400,
          message: `Cannot close work order from status ${existing.woStatusCode}`,
        });
      }

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
        data: {
          woStatusCode: WO_STATUS.CLOSED,
          closedDate: new Date(),
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
        include: {
          woOperations: {
            include: {
              hrUsages: true,
              materialUsages: true,
            },
          },
        },
      });

      return { workOrder: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async cancel(
    workOrderCode: number | string,
    organizationCode: string,
    userPermissions: string[],
    userRoles: string[],
    actorId: string,
    actorName: string,
    canceledReason: string,
  ) {
    try {
      this.validateReadContext({ organizationCode, userRoles });

      if (
        typeof canceledReason !== "string" ||
        canceledReason.trim().length === 0
      ) {
        throw new RpcException({
          status: 400,
          message: "canceledReason is required",
        });
      }

      if (canceledReason.length > 240) {
        throw new RpcException({
          status: 400,
          message: "canceledReason must not exceed 240 characters",
        });
      }

      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work order not found",
        });
      }

      if (existing.organizationCode !== organizationCode) {
        throw new RpcException({
          status: 403,
          message: "ORGANIZATION_MISMATCH",
        });
      }

      if (!userPermissions.includes("mnt.work.orders.cancel")) {
        throw new RpcException({
          status: 403,
          message: "MISSING_PERMISSION",
        });
      }

      if (
        existing.enableOracleWorkOrder === "Y" &&
        this.oraclePolicy.isOracleEnabled()
      ) {
        if (!userPermissions.includes("oracle.mnt.work.orders.cancel")) {
          throw new RpcException({
            status: 403,
            message: "MISSING_ORACLE_PERMISSION",
          });
        }
        if (!this.oraclePolicy.hasAllowedRole(userRoles)) {
          throw new RpcException({
            status: 403,
            message: "MISSING_ORACLE_PERMISSION",
          });
        }
      }

      if (!isValidWoTransition(existing.woStatusCode, WO_STATUS.CANCELED)) {
        throw new RpcException({
          status: 400,
          message: `Cannot cancel work order from status ${existing.woStatusCode}`,
        });
      }

      await this.prisma.mntWoOperation.updateMany({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
        data: { operationStatus: OP_STATUS.CANCELED },
      });

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
        data: {
          woStatusCode: WO_STATUS.CANCELED,
          canceledDate: new Date(),
          canceledReason,
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
        include: {
          woOperations: {
            include: {
              hrUsages: true,
              materialUsages: true,
            },
          },
        },
      });

      return { workOrder: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async holdOn(
    workOrderCode: number | string,
    organizationCode: string,
    userRoles: string[],
    actorId: string,
    actorName: string,
  ) {
    try {
      this.validateReadContext({ organizationCode, userRoles });

      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work order not found",
        });
      }

      if (existing.organizationCode !== organizationCode) {
        throw new RpcException({
          status: 403,
          message: "ORGANIZATION_MISMATCH",
        });
      }

      if (!isValidWoTransition(existing.woStatusCode, WO_STATUS.ON_HOLD)) {
        throw new RpcException({
          status: 400,
          message: `Cannot put work order on hold from status ${existing.woStatusCode}`,
        });
      }

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
        data: {
          woStatusCode: WO_STATUS.ON_HOLD,
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
        include: {
          woOperations: {
            include: {
              hrUsages: true,
              materialUsages: true,
            },
          },
        },
      });

      return { workOrder: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async pendingApproval(
    workOrderCode: number | string,
    organizationCode: string,
    userRoles: string[],
    actorId: string,
    actorName: string,
  ) {
    try {
      this.validateReadContext({ organizationCode, userRoles });

      const existing = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work order not found",
        });
      }

      if (existing.organizationCode !== organizationCode) {
        throw new RpcException({
          status: 403,
          message: "ORGANIZATION_MISMATCH",
        });
      }

      if (existing.woStatusCode !== WO_STATUS.PENDING_APPROVAL) {
        throw new RpcException({
          status: 400,
          message: `Work order must be in PENDING_APPROVAL status to transition to UNRELEASED`,
        });
      }

      const updated = await this.prisma.mntWorkOrder.update({
        where: { workOrderCode: BigInt(String(workOrderCode)) },
        data: {
          woStatusCode: WO_STATUS.UNRELEASED,
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
        include: {
          woOperations: {
            include: {
              hrUsages: true,
              materialUsages: true,
            },
          },
        },
      });

      return { workOrder: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }
}
