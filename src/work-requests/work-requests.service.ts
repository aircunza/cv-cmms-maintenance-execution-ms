import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import type { Prisma } from "generated/prisma/client";
import { PrismaService } from "src/prisma.service";
import {
  CreateWorkRequestMessageDto,
  UpdateWorkRequestDto,
  FindAllWorkRequestDto,
  WorkRequestFilterDto,
  UpdateWorkRequestConditionDto,
  UpdateWorkRequestDataDto,
} from "./dto";
import { WR_STATUS, isValidWrTransition } from "src/common/enums";

const INVALID_FILTER_DATA_MESSAGE = "Invalid filter data";
const INVALID_UPDATE_DATA_MESSAGE = "Invalid update data";
const INVALID_UPDATE_CONDITION_MESSAGE = "Invalid update condition";

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

const UPDATE_CONDITION_FIELDS = new Set([
  "requestId",
  "assetCode",
  "issueDescription",
  "statusCode",
  "organizationCode",
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
type WorkRequestConditionOperator = "eq" | "in";

@Injectable()
export class WorkRequestsService {
  private readonly logger = new Logger(WorkRequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkRequestMessageDto) {
    try {
      const asset = await this.prisma.mntAsset.findFirst({
        where: { assetCode: dto.assetCode, isActive: "Y" },
      });

      if (!asset) {
        throw new RpcException({
          status: 404,
          message: "Asset not found or inactive",
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
          workCenterCode: dto.workCenterCode ?? asset.workCenterCode,
          workCenterDescription:
            dto.workCenterDescription ?? asset.workCenterDescription,
          centerCostCode: dto.centerCostCode ?? asset.centerCostCode,
          workAreaCode: dto.workAreaCode ?? asset.workAreaCode,
          workAreaDescription:
            dto.workAreaDescription ?? asset.workAreaDescription,
          sector: dto.sector ?? asset.sector,
          subsector: dto.subsector ?? asset.subsector,
          organizationCode: asset.organizationCode,
          organizationName: asset.organizationName,
          createdBy: dto.actorId,
          createdByName: dto.actorName,
        },
      });

      return { workRequest };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findOne(requestId: number) {
    try {
      const workRequest = await this.prisma.mntWorkRequest.findFirst({
        where: { requestId: BigInt(requestId) },
      });

      if (!workRequest) {
        throw new RpcException({
          status: 404,
          message: "Work request not found",
        });
      }

      return { workRequest };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findAll(dto: FindAllWorkRequestDto) {
    try {
      const where = this.buildFindAllWhere(dto);
      const orderBy = this.buildFindAllOrder(dto.order);
      const take = this.parsePaginationValue(dto.limit);
      const skip = this.parsePaginationValue(dto.offset);

      const [workRequests, total] = await this.prisma.$transaction([
        this.prisma.mntWorkRequest.findMany({ where, orderBy, take, skip }),
        this.prisma.mntWorkRequest.count({ where }),
      ]);

      return { workRequests, total };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async update(
    dto: UpdateWorkRequestDto & {
      requestId?: number;
      actorId: string;
      actorName: string;
    },
  ) {
    try {
      const { data, condition } = this.normalizeBulkUpdatePayload(dto);
      const where = this.buildUpdateWhere(condition);

      const existingRows = await this.prisma.mntWorkRequest.findMany({ where });

      if (existingRows.length === 0) {
        return { affectedRows: 0, updatedInstances: [] };
      }

      if (data.statusCode !== undefined) {
        for (const row of existingRows) {
          if (
            row.statusCode !== data.statusCode &&
            !isValidWrTransition(row.statusCode, data.statusCode)
          ) {
            throw new RpcException({
              status: 400,
              message: `Invalid status transition from ${row.statusCode} to ${data.statusCode}`,
            });
          }
        }
      }

      const now = new Date();
      const updateData: Prisma.MntWorkRequestUpdateManyMutationInput = {
        ...(data.issueDescription !== undefined
          ? { issueDescription: data.issueDescription }
          : {}),
        ...(data.statusCode !== undefined
          ? { statusCode: data.statusCode }
          : {}),
        ...(data.statusCode === WR_STATUS.COMPLETED
          ? { completedAt: now }
          : {}),
        ...(data.statusCode === WR_STATUS.CANCELED ? { canceledAt: now } : {}),
        updatedBy: dto.actorId,
        updatedByName: dto.actorName,
        updatedAt: now,
      };

      const requestIds = existingRows.map((row) => row.requestId);

      const result = await this.prisma.mntWorkRequest.updateMany({
        where: { requestId: { in: requestIds } },
        data: updateData,
      });

      const updatedInstances = await this.prisma.mntWorkRequest.findMany({
        where: { requestId: { in: requestIds } },
        orderBy: [{ createdAt: "desc" }, { requestId: "desc" }],
      });

      return { affectedRows: result.count, updatedInstances };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  private buildFindAllWhere(
    dto: FindAllWorkRequestDto,
  ): Prisma.MntWorkRequestWhereInput {
    if (!dto.filters) {
      return {
        ...(dto.assetCode ? { assetCode: { contains: dto.assetCode } } : {}),
        ...(dto.organizationCode
          ? { organizationCode: { contains: dto.organizationCode } }
          : {}),
        ...(dto.statusCode ? { statusCode: dto.statusCode } : {}),
        ...(dto.workAreaCode
          ? { workAreaCode: { contains: dto.workAreaCode } }
          : {}),
      };
    }

    if (!Array.isArray(dto.filters)) {
      throw this.invalidFilterDataException();
    }

    if (dto.filters.length === 0) {
      return {};
    }

    const andConditions: Prisma.MntWorkRequestWhereInput[] = dto.filters.map(
      (filter) =>
        this.mapFilterToWhereCondition(filter, FIND_ALL_FILTER_FIELDS),
    );

    return { AND: andConditions };
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
    allowedFields: Set<string>,
  ): Prisma.MntWorkRequestWhereInput {
    if (!filter || typeof filter !== "object") {
      throw this.invalidFilterDataException();
    }

    const { field, operator, value } = filter;

    if (
      typeof field !== "string" ||
      !allowedFields.has(field) ||
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

  private normalizeBulkUpdatePayload(
    dto: UpdateWorkRequestDto & { requestId?: number },
  ): {
    data: UpdateWorkRequestDataDto;
    condition: UpdateWorkRequestConditionDto[];
  } {
    if (dto.data !== undefined || dto.condition !== undefined) {
      if (!dto.data || typeof dto.data !== "object") {
        throw this.invalidUpdateDataException();
      }

      const allowedUpdateFields = ["issueDescription", "statusCode"] as const;
      const dataKeys = Object.keys(dto.data);

      if (dataKeys.length === 0) {
        throw this.invalidUpdateDataException();
      }

      const hasUnknownDataField = dataKeys.some(
        (key) =>
          !allowedUpdateFields.includes(
            key as (typeof allowedUpdateFields)[number],
          ),
      );

      if (hasUnknownDataField) {
        throw this.invalidUpdateDataException();
      }

      if (!Array.isArray(dto.condition) || dto.condition.length === 0) {
        throw this.invalidUpdateConditionException();
      }

      return {
        data: dto.data,
        condition: dto.condition,
      };
    }

    if (dto.requestId === undefined || dto.requestId === null) {
      throw this.invalidUpdateConditionException();
    }

    if (
      dto.assetShortDescription !== undefined ||
      dto.workCenterCode !== undefined ||
      dto.workCenterDescription !== undefined ||
      dto.centerCostCode !== undefined ||
      dto.workAreaCode !== undefined ||
      dto.workAreaDescription !== undefined ||
      dto.sector !== undefined ||
      dto.subsector !== undefined ||
      dto.organizationName !== undefined
    ) {
      throw this.invalidUpdateDataException();
    }

    const legacyData: UpdateWorkRequestDataDto = {
      ...(dto.issueDescription !== undefined
        ? { issueDescription: dto.issueDescription }
        : {}),
      ...(dto.statusCode !== undefined ? { statusCode: dto.statusCode } : {}),
    };

    if (Object.keys(legacyData).length === 0) {
      throw this.invalidUpdateDataException();
    }

    return {
      data: legacyData,
      condition: [{ field: "requestId", operator: "eq", value: dto.requestId }],
    };
  }

  private buildUpdateWhere(
    condition: UpdateWorkRequestConditionDto[],
  ): Prisma.MntWorkRequestWhereInput {
    if (!Array.isArray(condition) || condition.length === 0) {
      throw this.invalidUpdateConditionException();
    }

    const andConditions: Prisma.MntWorkRequestWhereInput[] = condition.map(
      (item) => {
        if (!item || typeof item !== "object") {
          throw this.invalidUpdateConditionException();
        }

        const { field, operator, value } = item;

        if (
          typeof field !== "string" ||
          !UPDATE_CONDITION_FIELDS.has(field) ||
          typeof operator !== "string"
        ) {
          throw this.invalidUpdateConditionException();
        }

        const normalizedOperator =
          operator.toLowerCase() as WorkRequestConditionOperator;

        if (normalizedOperator === "eq") {
          const normalizedValue = this.normalizeFieldValue(field, value);
          return {
            [field]: normalizedValue,
          } as Prisma.MntWorkRequestWhereInput;
        }

        if (normalizedOperator === "in") {
          if (!Array.isArray(value)) {
            throw this.invalidUpdateConditionException();
          }

          const normalizedValues = value.map((itemValue) =>
            this.normalizeFieldValue(field, itemValue),
          );

          return {
            [field]: { in: normalizedValues },
          } as Prisma.MntWorkRequestWhereInput;
        }

        throw this.invalidUpdateConditionException();
      },
    );

    return { AND: andConditions };
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

  private invalidUpdateDataException(): RpcException {
    return new RpcException({
      status: 400,
      message: INVALID_UPDATE_DATA_MESSAGE,
    });
  }

  private invalidUpdateConditionException(): RpcException {
    return new RpcException({
      status: 400,
      message: INVALID_UPDATE_CONDITION_MESSAGE,
    });
  }

  async cancel(requestId: number, actorId: string, actorName: string) {
    try {
      const existing = await this.prisma.mntWorkRequest.findFirst({
        where: { requestId: BigInt(requestId) },
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
        where: { requestId: BigInt(requestId) },
        data: {
          statusCode: WR_STATUS.CANCELED,
          canceledAt: new Date(),
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
      });

      return { workRequest: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }
}
