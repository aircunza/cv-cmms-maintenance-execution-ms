import { Injectable } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { Prisma } from "generated/prisma/client";
import { PrismaService } from "src/prisma.service";
import {
  FindHumanResourcesPlainWoOperationDto,
  WoOperationFilterDto,
} from "./dto";

type ColumnType = "string" | "number" | "bigint" | "date";
type ColumnDef = { sql: string; type: ColumnType };

const str = (sql: string): ColumnDef => ({ sql, type: "string" });
const num = (sql: string): ColumnDef => ({ sql, type: "number" });
const big = (sql: string): ColumnDef => ({ sql, type: "bigint" });
const date = (sql: string): ColumnDef => ({ sql, type: "date" });

// Lista blanca unica: se usa para filtrar, ordenar y seleccionar.
// op  = mnt_wo_operations (base)
// a   = mnt_assets (por asset_code)
// wo  = mnt_work_orders (por work_order_code)
// hr  = recurso indexado de mnt_operation_human_resource_usages (menor resource_sequence_number)
const COLUMNS: ReadonlyMap<string, ColumnDef> = new Map<string, ColumnDef>([
  ["assetCode", str("op.asset_code")],
  ["assetShortDescription", str("op.asset_short_description")],
  ["workCenterCode", str("op.work_center_code")],
  ["workCenterDescription", str("op.work_center_description")],
  ["centerCostCode", num("op.center_cost_code")],
  ["workAreaCode", str("op.work_area_code")],
  ["workAreaDescription", str("op.work_area_description")],
  ["sector", str("op.sector")],
  ["subsector", str("op.subsector")],
  ["organizationCode", str("op.organization_code")],
  ["organizationName", str("op.organization_name")],
  ["plannedStartDate", date("op.planned_start_date")],
  ["plannedCompletionDate", date("op.planned_completion_date")],
  ["actualStartDate", date("op.actual_start_date")],
  ["actualCompletionDate", date("op.actual_completion_date")],
  ["plannedHours", num("op.planned_hours")],
  ["actualHours", num("op.actual_hours")],
  ["operationSubType", str("op.operation_sub_type")],
  ["operationStatus", str("op.operation_status")],
  ["assetTreeId", big("op.asset_tree_id")],
  ["unit", str("op.unit")],
  ["subunit", str("op.subunit")],
  ["maintainableItem", str("op.maintainable_item")],
  ["specialtyType", str("op.specialty_type")],
  ["operationCode", big("op.operation_code")],
  ["operationName", str("op.operation_name")],
  ["operationDescription", str("op.operation_description")],
  ["operationSeqNumber", num("op.operation_seq_number")],
  ["workOrderCode", big("op.work_order_code")],
  ["assignedToCode", str("op.assigned_to_code")],
  ["assignedToName", str("op.assigned_to_name")],
  ["supervisorCode", str("a.supervisor_code")],
  ["supervisorName", str("a.supervisor_name")],
  ["workOrderDescription", str("wo.work_order_description")],
  ["resourceCode", str("hr.resource_code")],
  ["resourceActualStartDate", date("hr.actual_start_date")],
  ["resourceActualCompletionDate", date("hr.actual_completion_date")],
  ["resourceActualHours", num("hr.actual_hours")],
]);

const SELECT_LIST = Prisma.raw(
  [...COLUMNS.entries()]
    .map(([field, def]) => `${def.sql} AS ${field}`)
    .join(", "),
);

// Operacion base + un unico recurso por operacion (menor resourceSequenceNumber;
// NULL se considera al final). Si no hay recurso, las columnas hr.* quedan en NULL.
const FROM_CLAUSE = Prisma.raw(`
FROM mnt_wo_operations op
LEFT JOIN mnt_assets a
  ON a.asset_code = op.asset_code
LEFT JOIN mnt_work_orders wo
  ON wo.work_order_code = op.work_order_code
LEFT JOIN (
  SELECT ranked.operation_code, ranked.resource_code,
         ranked.actual_start_date, ranked.actual_completion_date, ranked.actual_hours
  FROM (
    SELECT u.operation_code, u.resource_code,
           u.actual_start_date, u.actual_completion_date, u.actual_hours,
           ROW_NUMBER() OVER (
             PARTITION BY u.operation_code
             ORDER BY CASE WHEN u.resource_sequence_number IS NULL THEN 1 ELSE 0 END,
                      u.resource_sequence_number ASC,
                      u.id ASC
           ) AS rn
    FROM mnt_operation_human_resource_usages u
  ) ranked
  WHERE ranked.rn = 1
) hr
  ON hr.operation_code = op.operation_code
`);

const DEFAULT_ORDER = Prisma.raw(
  "ORDER BY op.operation_seq_number ASC, op.operation_code ASC",
);

type PlainRow = Record<string, unknown>;
type CountRow = { total: number | bigint };

@Injectable()
export class WoOperationsHumanResourcesPlainService {
  constructor(private readonly prisma: PrismaService) {}

  // Operaciones (base) con su recurso humano indexado, asset y work order.
  // El gateway calcula organizationCodes (orgs donde el usuario tiene
  // mnt.work.orders.view) y envia userPermissions.
  async findAllHumanResourcesPlain(
    dto: FindHumanResourcesPlainWoOperationDto & {
      organizationCodes: string[];
      userPermissions: string[];
    },
  ) {
    try {
      if (
        !Array.isArray(dto.userPermissions) ||
        !dto.userPermissions.includes("mnt.work.orders.view")
      ) {
        throw new RpcException({ status: 403, message: "MISSING_PERMISSION" });
      }

      if (
        !Array.isArray(dto.organizationCodes) ||
        dto.organizationCodes.length === 0
      ) {
        throw new RpcException({ status: 403, message: "MISSING_PERMISSION" });
      }

      const conditions: Prisma.Sql[] = [
        Prisma.sql`op.organization_code IN (${Prisma.join(dto.organizationCodes)})`,
      ];

      if (dto.filters !== undefined) {
        if (!Array.isArray(dto.filters)) {
          throw this.invalidFilterDataException();
        }
        conditions.push(
          ...dto.filters.map((filter) => this.buildFilterCondition(filter)),
        );
      }

      const where = this.joinSql(conditions, " AND ");
      const orderBy = this.buildOrderBy(dto.order);
      const limit = this.parsePaginationValue(dto.limit);
      const offset = this.parsePaginationValue(dto.offset) ?? 0;

      const countSql = Prisma.sql`SELECT COUNT(*) AS total ${FROM_CLAUSE} WHERE ${where}`;

      if (limit === 0) {
        const countRows = await this.prisma.$queryRaw<CountRow[]>(countSql);
        return { operations: [] as PlainRow[], total: Number(countRows[0]?.total ?? 0) };
      }

      const pagination =
        limit === undefined
          ? Prisma.sql`OFFSET ${offset} ROWS`
          : Prisma.sql`OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

      const selectSql = Prisma.sql`SELECT ${SELECT_LIST} ${FROM_CLAUSE} WHERE ${where} ${orderBy} ${pagination}`;

      const [operations, countRows] = await this.prisma.$transaction([
        this.prisma.$queryRaw<PlainRow[]>(selectSql),
        this.prisma.$queryRaw<CountRow[]>(countSql),
      ]);

      return { operations, total: Number(countRows[0]?.total ?? 0) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  private buildFilterCondition(filter: WoOperationFilterDto): Prisma.Sql {
    if (!filter || typeof filter !== "object") {
      throw this.invalidFilterDataException();
    }

    const { field, operator, value } = filter;
    const def =
      typeof field === "string" ? COLUMNS.get(field) : undefined;
    if (!def || typeof operator !== "string") {
      throw this.invalidFilterDataException();
    }

    const col = Prisma.raw(def.sql);

    switch (operator.toLowerCase()) {
      case "eq":
        return Prisma.sql`${col} = ${this.normalizeValue(def, value)}`;
      case "like":
        if (def.type !== "string" || typeof value !== "string") {
          throw this.invalidFilterDataException();
        }
        return Prisma.sql`${col} LIKE ${`%${value}%`}`;
      case "gt":
        return Prisma.sql`${col} > ${this.normalizeValue(def, value)}`;
      case "lt":
        return Prisma.sql`${col} < ${this.normalizeValue(def, value)}`;
      case "in": {
        if (!Array.isArray(value)) {
          throw this.invalidFilterDataException();
        }
        if (value.length === 0) {
          return Prisma.sql`1 = 0`;
        }
        const items = value.map((item) => this.normalizeValue(def, item));
        return Prisma.sql`${col} IN (${Prisma.join(items)})`;
      }
      default:
        throw this.invalidFilterDataException();
    }
  }

  private buildOrderBy(order: unknown): Prisma.Sql {
    if (order === undefined) return DEFAULT_ORDER;

    if (!Array.isArray(order)) {
      throw this.invalidFilterDataException();
    }

    const parts = order.map((criterion) => {
      if (!Array.isArray(criterion) || criterion.length !== 2) {
        throw this.invalidFilterDataException();
      }
      const [field, direction] = criterion as unknown[];
      const def =
        typeof field === "string" ? COLUMNS.get(field) : undefined;
      if (!def || typeof direction !== "string") {
        throw this.invalidFilterDataException();
      }
      const dir = direction.toLowerCase();
      if (dir !== "asc" && dir !== "desc") {
        throw this.invalidFilterDataException();
      }
      return Prisma.sql`${Prisma.raw(def.sql)} ${Prisma.raw(dir.toUpperCase())}`;
    });

    if (parts.length === 0) return DEFAULT_ORDER;

    parts.push(Prisma.sql`op.operation_code ASC`);
    return Prisma.sql`ORDER BY ${this.joinSql(parts, ", ")}`;
  }

  private normalizeValue(
    def: ColumnDef,
    value: unknown,
  ): string | number | bigint | Date {
    switch (def.type) {
      case "string":
        if (typeof value === "string") return value;
        break;
      case "number": {
        const parsed =
          typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : value;
        if (typeof parsed === "number" && Number.isFinite(parsed)) {
          return parsed;
        }
        break;
      }
      case "bigint":
        if (typeof value === "bigint") return value;
        if (typeof value === "number" && Number.isInteger(value)) {
          return BigInt(value);
        }
        if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
          return BigInt(value.trim());
        }
        break;
      case "date":
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return value;
        }
        if (typeof value === "string") {
          const parsed = new Date(value);
          if (!Number.isNaN(parsed.getTime())) return parsed;
        }
        break;
    }
    throw this.invalidFilterDataException();
  }

  private joinSql(parts: Prisma.Sql[], separator: string): Prisma.Sql {
    const sep = Prisma.raw(separator);
    return parts.reduce((acc, part) => Prisma.sql`${acc}${sep}${part}`);
  }

  private parsePaginationValue(value?: number): number | undefined {
    if (value === undefined) return undefined;
    if (!Number.isInteger(value) || value < 0) {
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
}
