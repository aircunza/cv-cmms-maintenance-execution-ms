import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import type { Prisma } from "generated/prisma/client";
import { PrismaService } from "src/prisma.service";
import {
  CreateWorkRequestMessageDto,
  UpdateWorkRequestMessageDto,
  FindAllWorkRequestDto,
  WorkRequestFilterDto,
  WorkRequestReadDto,
  WorkRequestIdMessageDto,
} from "./dto";
import {
  WR_STATUS,
  isValidWrTransition,
  WO_STATUS,
  OP_STATUS,
} from "src/common/enums";
import { WorkRequestPolicy } from "./policies/work-request.policy";
import { WorkOrdersService } from "src/work-orders/work-orders.service";

const INVALID_FILTER_DATA_MESSAGE = "Invalid filter data";

const FIND_ALL_FILTER_FIELDS = new Set([
  "requestId",
  "assetCode",
  "issueDescription",
  "statusCode",
  "organizationCode",
  "workAreaCode",
  "createdAt",
  "requestedAt",
  "releasedAt",
  "completedAt",
  "canceledAt",
]);

const STRING_FIELDS = new Set([
  "assetCode",
  "issueDescription",
  "statusCode",
  "organizationCode",
  "workAreaCode",
]);

const BIGINT_FIELDS = new Set(["requestId"]);
const DATE_FIELDS = new Set([
  "createdAt",
  "requestedAt",
  "releasedAt",
  "completedAt",
  "canceledAt",
]);

type WorkRequestFilterOperator = "eq" | "like" | "gt" | "lt" | "in";

const CANCELED_VIA_WORK_REQUEST_REASON = "Canceled via work request";

function toTitleCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

@Injectable()
export class WorkRequestsService {
  private readonly logger = new Logger(WorkRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: WorkRequestPolicy,
    private readonly workOrdersService: WorkOrdersService,
  ) {}

  async create(dto: CreateWorkRequestMessageDto) {
    try {
      if (!dto.userPermissions.includes("mnt.work.request.create")) {
        throw this.missingPermissionException();
      }

      if (!dto.userPermissions.includes("mnt.work.orders.create")) {
        throw this.missingPermissionException();
      }

      if (!this.policy.canCreate(dto.userRoles)) {
        throw this.roleNotAuthorizedException();
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

      const workRequest = await this.prisma.mntWorkRequest.create({
        data: {
          assetCode: dto.assetCode,
          assetShortDescription:
            dto.assetShortDescription ?? asset.assetShortDescription,
          issueDescription: dto.issueDescription,
          statusCode: WR_STATUS.RELEASED,
          releasedAt: new Date(),
          workCenterCode: asset.workCenterCode,
          workCenterDescription: asset.workCenterDescription,
          centerCostCode: asset.centerCostCode,
          workAreaCode: asset.workAreaCode,
          workAreaDescription: asset.workAreaDescription,
          sector: asset.sector,
          subsector: asset.subsector,
          organizationCode: asset.organizationCode,
          organizationName: asset.organizationName,
          createdBy: dto.actorId,
          createdByName: dto.actorName,
        },
      });

      const workOrder = await this.workOrdersService.create({
        workOrderDescription: dto.issueDescription,
        assetCode: dto.assetCode,
        workOrderType: "Not Planned",
        workOrderSubType: "Emergency",
        workOrderPriority: "1",
        woStatusCode: WO_STATUS.RELEASED,
        enableOracleWorkOrder: dto.enableOracleWorkOrder,
        workRequestId: Number(workRequest.requestId),
        actorId: dto.actorId,
        actorName: dto.actorName,
        organizationCode: dto.organizationCode,
        userPermissions: dto.userPermissions,
        userRoles: dto.userRoles,
        operations: [this.defaultOperation(dto.actorId)],
      });

      return {
        workRequest: this.mapToResponse(workRequest),
        workOrder: workOrder.workOrder,
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findOne(dto: WorkRequestReadDto) {
    try {
      this.validateReadContext(dto);

      const workRequest = await this.prisma.mntWorkRequest.findFirst({
        where: {
          requestId: BigInt(dto.requestId),
          organizationCode: dto.organizationCode,
        },
        include: { workOrders: true },
      });

      if (!workRequest) {
        throw new RpcException({
          status: 404,
          message: "Work request not found",
        });
      }

      return { workRequest: this.mapToResponse(workRequest) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findAll(dto: FindAllWorkRequestDto) {
    try {
      this.validateReadContext(dto);

      const where = this.buildFindAllWhere(dto);
      const orderBy = this.buildFindAllOrder(dto.order);
      const take = this.parsePaginationValue(dto.limit);
      const skip = this.parsePaginationValue(dto.offset);

      const [workRequests, total] = await this.prisma.$transaction([
        this.prisma.mntWorkRequest.findMany({
          where,
          orderBy,
          take,
          skip,
          include: { workOrders: true },
        }),
        this.prisma.mntWorkRequest.count({ where }),
      ]);

      return {
        workRequests: workRequests.map((wr) => this.mapToResponse(wr)),
        total,
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async update(dto: UpdateWorkRequestMessageDto) {
    try {
      if (!dto.userPermissions.includes("mnt.work.request.update")) {
        throw this.missingPermissionException();
      }

      const existing = await this.prisma.mntWorkRequest.findFirst({
        where: { requestId: BigInt(dto.requestId) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work request not found",
        });
      }

      const now = new Date();
      const updated = await this.prisma.mntWorkRequest.update({
        where: { requestId: BigInt(dto.requestId) },
        data: {
          ...(dto.issueDescription !== undefined
            ? { issueDescription: dto.issueDescription }
            : {}),
          updatedBy: dto.actorId,
          updatedByName: dto.actorName,
          updatedAt: now,
        },
        include: { workOrders: true },
      });

      return { workRequest: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async complete(dto: WorkRequestIdMessageDto) {
    try {
      if (!dto.userPermissions.includes("mnt.work.request.complete")) {
        throw this.missingPermissionException();
      }

      if (!this.policy.canComplete(dto.userRoles)) {
        throw this.roleNotAuthorizedException();
      }

      const existing = await this.prisma.mntWorkRequest.findFirst({
        where: {
          requestId: BigInt(dto.requestId),
          organizationCode: dto.organizationCode,
        },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work request not found",
        });
      }

      if (existing.statusCode !== WR_STATUS.RELEASED) {
        throw new RpcException({
          status: 400,
          message: `Cannot complete work request from status ${existing.statusCode}`,
        });
      }

      const updated = await this.prisma.mntWorkRequest.update({
        where: { requestId: BigInt(dto.requestId) },
        data: {
          statusCode: WR_STATUS.COMPLETED,
          completedAt: new Date(),
          updatedBy: dto.actorId,
          updatedByName: dto.actorName,
          updatedAt: new Date(),
        },
        include: { workOrders: true },
      });

      return { workRequest: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async cancel(dto: WorkRequestIdMessageDto) {
    try {
      if (!dto.userPermissions.includes("mnt.work.request.cancel")) {
        throw this.missingPermissionException();
      }

      if (!dto.userPermissions.includes("mnt.work.orders.cancel")) {
        throw this.missingPermissionException();
      }

      if (!this.policy.canCancel(dto.userRoles)) {
        throw this.roleNotAuthorizedException();
      }

      const existing = await this.prisma.mntWorkRequest.findFirst({
        where: {
          requestId: BigInt(dto.requestId),
          organizationCode: dto.organizationCode,
        },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work request not found",
        });
      }

      if (existing.statusCode === WR_STATUS.CANCELED) {
        throw new RpcException({
          status: 400,
          message: "Work request is already canceled",
        });
      }

      if (!isValidWrTransition(existing.statusCode, WR_STATUS.CANCELED)) {
        throw new RpcException({
          status: 400,
          message: `Cannot cancel work request from status ${existing.statusCode}`,
        });
      }

      const updated = await this.prisma.mntWorkRequest.update({
        where: { requestId: BigInt(dto.requestId) },
        data: {
          statusCode: WR_STATUS.CANCELED,
          canceledAt: new Date(),
          updatedBy: dto.actorId,
          updatedByName: dto.actorName,
          updatedAt: new Date(),
        },
      });

      const associatedWorkOrder = await this.prisma.mntWorkOrder.findFirst({
        where: { workRequestId: BigInt(dto.requestId) },
      });

      if (associatedWorkOrder) {
        await this.workOrdersService.cancel(
          associatedWorkOrder.workOrderCode.toString(),
          dto.organizationCode,
          dto.userPermissions,
          dto.userRoles,
          dto.actorId,
          dto.actorName,
          CANCELED_VIA_WORK_REQUEST_REASON,
        );
      }

      const refreshed = await this.prisma.mntWorkRequest.findFirst({
        where: { requestId: BigInt(dto.requestId) },
        include: { workOrders: true },
      });

      return { workRequest: this.mapToResponse(refreshed ?? updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  private defaultOperation(actorId: string) {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 3600000);

    return {
      operationName: "DEFAULT_OPERATION",
      operationDescription: "Auto-generated default operation",
      operationSeqNumber: 1,
      createdBy: actorId,
      operationStatus: OP_STATUS.RELEASED,
      operationType: "Internal",
      operationSubType: "Emergency",
      actualStartDate: now.toISOString(),
      actualCompletionDate: oneHourLater.toISOString(),
      workOrderOperationResource: [
        {
          resourceCode: "DEFAULT_RESOURCE",
          resourceSequenceNumber: 0,
          actualHours: 1,
          principalFlag: "N",
          actualStartDate: now.toISOString(),
          actualCompletionDate: oneHourLater.toISOString(),
        },
      ],
    };
  }

  private mapToResponse(wr: any) {
    return {
      requestId: wr.requestId?.toString(),
      assetCode: wr.assetCode,
      assetShortDescription: wr.assetShortDescription,
      issueDescription: wr.issueDescription,
      statusCode: wr.statusCode,
      statusLabel: toTitleCase(wr.statusCode),
      requestedAt: wr.requestedAt,
      completedAt: wr.completedAt,
      releasedAt: wr.releasedAt,
      canceledAt: wr.canceledAt,
      workCenterCode: wr.workCenterCode,
      workCenterDescription: wr.workCenterDescription,
      centerCostCode: wr.centerCostCode,
      workAreaCode: wr.workAreaCode,
      workAreaDescription: wr.workAreaDescription,
      sector: wr.sector,
      subsector: wr.subsector,
      organizationCode: wr.organizationCode,
      organizationName: wr.organizationName,
      createdBy: wr.createdBy,
      createdByName: wr.createdByName,
      updatedBy: wr.updatedBy,
      updatedByName: wr.updatedByName,
      createdAt: wr.createdAt,
      updatedAt: wr.updatedAt,
      workOrders: wr.workOrders?.map((wo: any) => ({
        workOrderCode: wo.workOrderCode?.toString(),
        workOrderDescription: wo.workOrderDescription,
        workOrderType: wo.workOrderType,
        workOrderSubType: wo.workOrderSubType,
        workOrderPriority: wo.workOrderPriority,
        woStatusCode: wo.woStatusCode,
      })),
    };
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

  private buildFindAllWhere(
    dto: FindAllWorkRequestDto,
  ): Prisma.MntWorkRequestWhereInput {
    const conditions: Prisma.MntWorkRequestWhereInput[] = [
      { organizationCode: dto.organizationCode },
    ];

    if (dto.filters) {
      if (!Array.isArray(dto.filters)) {
        throw this.invalidFilterDataException();
      }

      const filters = dto.filters.map((filter) =>
        this.mapFilterToWhereCondition(filter),
      );
      conditions.push(...filters);
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private buildFindAllOrder(
    order: FindAllWorkRequestDto["order"],
  ): Prisma.MntWorkRequestOrderByWithRelationInput[] {
    if (order === undefined) {
      return [{ createdAt: "desc" }, { requestId: "desc" }];
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
      } as Prisma.MntWorkRequestOrderByWithRelationInput;
    });

    return mapped.length > 0
      ? mapped
      : [{ createdAt: "desc" }, { requestId: "desc" }];
  }

  private mapFilterToWhereCondition(
    filter: WorkRequestFilterDto,
  ): Prisma.MntWorkRequestWhereInput {
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
      operator.toLowerCase() as WorkRequestFilterOperator;

    switch (normalizedOperator) {
      case "eq": {
        const normalizedValue = this.normalizeFieldValue(field, value);
        return { [field]: normalizedValue } as Prisma.MntWorkRequestWhereInput;
      }
      case "like": {
        if (!STRING_FIELDS.has(field) || typeof value !== "string") {
          throw this.invalidFilterDataException();
        }
        return {
          [field]: { contains: value },
        } as Prisma.MntWorkRequestWhereInput;
      }
      case "gt": {
        const normalizedValue = this.normalizeComparableFieldValue(
          field,
          value,
        );
        return {
          [field]: { gt: normalizedValue },
        } as Prisma.MntWorkRequestWhereInput;
      }
      case "lt": {
        const normalizedValue = this.normalizeComparableFieldValue(
          field,
          value,
        );
        return {
          [field]: { lt: normalizedValue },
        } as Prisma.MntWorkRequestWhereInput;
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
        } as Prisma.MntWorkRequestWhereInput;
      }
      default:
        throw this.invalidFilterDataException();
    }
  }

  private normalizeFieldValue(
    field: string,
    value: unknown,
  ): string | bigint | Date {
    if (BIGINT_FIELDS.has(field)) {
      if (typeof value === "bigint") {
        return value;
      }

      if (typeof value === "number" && Number.isInteger(value)) {
        return BigInt(value);
      }

      if (typeof value === "string" && value.trim() !== "") {
        try {
          return BigInt(value);
        } catch {
          throw this.invalidFilterDataException();
        }
      }

      throw this.invalidFilterDataException();
    }

    if (DATE_FIELDS.has(field)) {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
      }

      if (typeof value === "string") {
        const parsedDate = new Date(value);
        if (!Number.isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }

      throw this.invalidFilterDataException();
    }

    if (typeof value !== "string") {
      throw this.invalidFilterDataException();
    }

    return value;
  }

  private normalizeComparableFieldValue(
    field: string,
    value: unknown,
  ): bigint | Date {
    if (!BIGINT_FIELDS.has(field) && !DATE_FIELDS.has(field)) {
      throw this.invalidFilterDataException();
    }

    const normalized = this.normalizeFieldValue(field, value);
    if (typeof normalized === "string") {
      throw this.invalidFilterDataException();
    }

    return normalized;
  }

  private parsePaginationValue(value: unknown): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== "number" && typeof value !== "string") {
      throw this.invalidFilterDataException();
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw this.invalidFilterDataException();
    }

    return parsed;
  }

  private invalidFilterDataException(): RpcException {
    return new RpcException({
      status: 400,
      message: INVALID_FILTER_DATA_MESSAGE,
    });
  }

  private missingPermissionException(): RpcException {
    return new RpcException({
      status: 403,
      message: "MISSING_PERMISSION",
    });
  }

  private roleNotAuthorizedException(): RpcException {
    return new RpcException({
      status: 403,
      message: "ROLE_NOT_AUTHORIZED",
    });
  }
}
