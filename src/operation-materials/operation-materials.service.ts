import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy, RpcException } from "@nestjs/microservices";
import { PrismaService } from "src/prisma.service";
import { NATS_SERVICE } from "src/config/services";
import { OracleWorkOrderPolicy } from "src/work-orders/policies";
import {
  CreateOperationMaterialDto,
  UpdateOperationMaterialDto,
  FindAllOperationMaterialDto,
} from "./dto";

@Injectable()
export class OperationMaterialsService {
  private readonly logger = new Logger(OperationMaterialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NATS_SERVICE) private readonly natsClient: ClientProxy,
    private readonly oraclePolicy: OracleWorkOrderPolicy,
  ) {}

  async create(
    dto: CreateOperationMaterialDto & { actorId: string; actorName: string; operationCode: number },
  ) {
    try {
      const operation = await this.prisma.mntWoOperation.findFirst({
        where: { operationCode: BigInt(dto.operationCode) },
      });

      if (!operation) {
        throw new RpcException({ status: 404, message: "Operation not found" });
      }

      const existing = await this.prisma.mntOperationMaterialUsage.findFirst({
        where: {
          operationCode: BigInt(dto.operationCode),
          materialSequenceNumber: dto.materialSequenceNumber,
        },
      });

      if (existing) {
        throw new RpcException({
          status: 400,
          message: `Material sequence number ${dto.materialSequenceNumber} already exists for this operation`,
        });
      }

      const quantity = dto.quantity ?? 0;
      const unitCost = dto.unitCost ?? 0;
      const totalCost = quantity * unitCost;

      const materialUsage = await this.prisma.mntOperationMaterialUsage.create({
        data: {
          operationCode: BigInt(dto.operationCode),
          organizationCode: dto.organizationCode,
          materialCode: dto.materialCode,
          materialName: dto.materialName,
          quantity,
          unitCost,
          totalCost,
          supplyType: dto.supplyType ?? "1",
          materialSequenceNumber: dto.materialSequenceNumber,
          createdBy: dto.actorId,
          createdByName: dto.actorName,
        },
      });

      const workOrder = await this.prisma.mntWorkOrder.findFirst({
        where: { workOrderCode: operation.workOrderCode },
      });

      if (
        workOrder?.enableOracleWorkOrder === "Y" &&
        this.oraclePolicy.isOracleEnabled()
      ) {
        this.natsClient
          .emit("operation.material.created", {
            payload: {
              enableOracleWorkOrder: "Y",
              workOrderCode: Number(operation.workOrderCode),
              operationCode: Number(dto.operationCode),
              requiredDate: operation.actualStartDate?.toISOString(),
              material: {
                materialSequenceNumber: dto.materialSequenceNumber,
                materialCode: dto.materialCode,
                quantity,
                supplyType: dto.supplyType ?? "1",
              },
            },
          })
          .subscribe({
            error: (err: unknown) =>
              this.logger.error("Failed to emit operation.material.created", err),
          });
      }

      return { materialUsage };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findAll(dto: FindAllOperationMaterialDto) {
    try {
      const materials = await this.prisma.mntOperationMaterialUsage.findMany({
        where: {
          ...(dto.operationCode
            ? { operationCode: BigInt(dto.operationCode) }
            : {}),
        },
        orderBy: { materialSequenceNumber: "asc" },
      });

      return { materials, total: materials.length };
    } catch (error) {
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async update(
    dto: UpdateOperationMaterialDto & {
      id: number;
      actorId: string;
      actorName: string;
    },
  ) {
    try {
      const existing = await this.prisma.mntOperationMaterialUsage.findFirst({
        where: { id: BigInt(dto.id) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Material usage not found",
        });
      }

      const quantity = dto.quantity ?? (existing.quantity as number);
      const unitCost = dto.unitCost ?? Number(existing.unitCost ?? 0);
      const totalCost = quantity * unitCost;

      const updated = await this.prisma.mntOperationMaterialUsage.update({
        where: { id: BigInt(dto.id) },
        data: {
          ...(dto.materialName !== undefined
            ? { materialName: dto.materialName }
            : {}),
          ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
          ...(dto.unitCost !== undefined ? { unitCost: dto.unitCost } : {}),
          totalCost,
          ...(dto.supplyType !== undefined
            ? { supplyType: dto.supplyType }
            : {}),
          updatedBy: dto.actorId,
          updatedByName: dto.actorName,
          updatedAt: new Date(),
        },
      });

      return { materialUsage: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }
}
