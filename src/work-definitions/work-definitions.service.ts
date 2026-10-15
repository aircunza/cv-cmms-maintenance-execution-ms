import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import type { Prisma } from "generated/prisma/client";
import { PrismaService } from "src/prisma.service";
import {
  CreateWorkDefinitionMessageDto,
  UpdateWorkDefinitionMessageDto,
  FindAllWorkDefinitionDto,
  WorkDefinitionFilterDto,
  WorkDefinitionReadDto,
} from "./dto";
import { WorkDefinitionPolicy } from "./policies/work-definition.policy";

const INVALID_FILTER_DATA_MESSAGE = "Invalid filter data";

const FIND_ALL_FILTER_FIELDS = new Set([
  "workDefinitionId",
  "workDefinitionCode",
  "workDefinitionDescription",
  "isActive",
  "createdAt",
  "updatedAt",
]);

const STRING_FIELDS = new Set([
  "workDefinitionCode",
  "workDefinitionDescription",
  "isActive",
]);

const BIGINT_FIELDS = new Set(["workDefinitionId"]);
const DATE_FIELDS = new Set(["createdAt", "updatedAt"]);

type WorkDefinitionFilterOperator = "eq" | "like" | "gt" | "lt" | "in";

@Injectable()
export class WorkDefinitionsService {
  private readonly logger = new Logger(WorkDefinitionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: WorkDefinitionPolicy,
  ) {}

  async create(dto: CreateWorkDefinitionMessageDto) {
    try {
      if (!this.policy.canCreate(dto.userRoles)) {
        throw this.roleNotAuthorizedException();
      }

      const existing = await this.prisma.mntWorkDefinition.findUnique({
        where: { workDefinitionCode: dto.workDefinitionCode },
      });

      if (existing) {
        throw new RpcException({
          status: 409,
          message: "Work definition code already exists",
        });
      }

      const workDefinition = await this.prisma.mntWorkDefinition.create({
        data: {
          workDefinitionCode: dto.workDefinitionCode,
          workDefinitionDescription: dto.workDefinitionDescription,
        },
      });

      return { workDefinition: this.mapToResponse(workDefinition) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.logger.error("Error creating work definition", error);
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findOne(dto: WorkDefinitionReadDto) {
    try {
      this.validateReadContext(dto);

      const workDefinition = await this.prisma.mntWorkDefinition.findUnique({
        where: { workDefinitionCode: dto.workDefinitionCode },
      });

      if (!workDefinition) {
        throw new RpcException({
          status: 404,
          message: "Work definition not found",
        });
      }

      return { workDefinition: this.mapToResponse(workDefinition) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findAll(dto: FindAllWorkDefinitionDto) {
    try {
      this.validateReadContext(dto);

      const where = this.buildFindAllWhere(dto);
      const orderBy = this.buildFindAllOrder(dto.order);
      const take = this.parsePaginationValue(dto.limit);
      const skip = this.parsePaginationValue(dto.offset);

      const [workDefinitions, total] = await this.prisma.$transaction([
        this.prisma.mntWorkDefinition.findMany({
          where,
          orderBy,
          take,
          skip,
        }),
        this.prisma.mntWorkDefinition.count({ where }),
      ]);

      return {
        workDefinitions: workDefinitions.map((wd) => this.mapToResponse(wd)),
        total,
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async update(dto: UpdateWorkDefinitionMessageDto) {
    try {
      if (!this.policy.canUpdate(dto.userRoles)) {
        throw this.roleNotAuthorizedException();
      }

      const existing = await this.prisma.mntWorkDefinition.findUnique({
        where: { workDefinitionCode: dto.workDefinitionCode },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Work definition not found",
        });
      }

      const updated = await this.prisma.mntWorkDefinition.update({
        where: { workDefinitionCode: dto.workDefinitionCode },
        data: {
          isActive: dto.isActive,
          updatedAt: new Date(),
        },
      });

      return { workDefinition: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  private mapToResponse(wd: any) {
    return {
      workDefinitionId: wd.workDefinitionId?.toString(),
      workDefinitionCode: wd.workDefinitionCode,
      workDefinitionDescription: wd.workDefinitionDescription,
      isActive: wd.isActive,
      createdAt: wd.createdAt,
      updatedAt: wd.updatedAt,
    };
  }

  private validateReadContext(dto: {
    organizationCode?: string;
    userRoles?: string[];
  }) {
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
    dto: FindAllWorkDefinitionDto,
  ): Prisma.MntWorkDefinitionWhereInput {
    const conditions: Prisma.MntWorkDefinitionWhereInput[] = [];

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
    order: FindAllWorkDefinitionDto["order"],
  ): Prisma.MntWorkDefinitionOrderByWithRelationInput[] {
    if (order === undefined) {
      return [{ createdAt: "desc" }, { workDefinitionId: "desc" }];
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
      } as Prisma.MntWorkDefinitionOrderByWithRelationInput;
    });

    return mapped.length > 0
      ? mapped
      : [{ createdAt: "desc" }, { workDefinitionId: "desc" }];
  }

  private mapFilterToWhereCondition(
    filter: WorkDefinitionFilterDto,
  ): Prisma.MntWorkDefinitionWhereInput {
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
      operator.toLowerCase() as WorkDefinitionFilterOperator;

    switch (normalizedOperator) {
      case "eq": {
        const normalizedValue = this.normalizeFieldValue(field, value);
        return {
          [field]: normalizedValue,
        } as Prisma.MntWorkDefinitionWhereInput;
      }
      case "like": {
        if (!STRING_FIELDS.has(field) || typeof value !== "string") {
          throw this.invalidFilterDataException();
        }
        return {
          [field]: { contains: value },
        } as Prisma.MntWorkDefinitionWhereInput;
      }
      case "gt": {
        const normalizedValue = this.normalizeComparableFieldValue(field, value);
        return {
          [field]: { gt: normalizedValue },
        } as Prisma.MntWorkDefinitionWhereInput;
      }
      case "lt": {
        const normalizedValue = this.normalizeComparableFieldValue(field, value);
        return {
          [field]: { lt: normalizedValue },
        } as Prisma.MntWorkDefinitionWhereInput;
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
        } as Prisma.MntWorkDefinitionWhereInput;
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

  private roleNotAuthorizedException(): RpcException {
    return new RpcException({
      status: 403,
      message: "ROLE_NOT_AUTHORIZED",
    });
  }
}
