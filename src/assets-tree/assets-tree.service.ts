import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { PrismaService } from "src/prisma.service";
import {
  CreateAssetsTreeMessageDto,
  UpdateAssetsTreeMessageDto,
  FindAllAssetsTreeDto,
} from "./dto";

@Injectable()
export class AssetsTreeService {
  private readonly logger = new Logger(AssetsTreeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAssetsTreeMessageDto) {
    try {
      const asset = await this.prisma.mntAsset.findUnique({
        where: { assetCode: dto.assetCode },
      });

      if (!asset) {
        throw new RpcException({
          status: 404,
          message: `Asset with code ${dto.assetCode} not found`,
        });
      }

      const existing = await this.prisma.mntAssetsTree.findFirst({
        where: {
          assetCode: dto.assetCode,
          unit: dto.unit,
          subunit: dto.subunit,
          maintainableItem: dto.maintainableItem,
          sparePartCode: dto.sparePartCode,
        },
      });

      if (existing) {
        throw new RpcException({
          status: 400,
          message: "Assets tree combination already exists",
        });
      }

      const assetsTree = await this.prisma.mntAssetsTree.create({
        data: {
          assetCode: dto.assetCode,
          unit: dto.unit,
          subunit: dto.subunit,
          maintainableItem: dto.maintainableItem,
          sparePartCode: dto.sparePartCode,
          sparePartName: dto.sparePartName,
          createdBy: dto.actorId,
          createdByName: dto.actorName,
        },
      });

      return { assetsTree: this.mapToResponse(assetsTree) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findOne(id: number) {
    try {
      const assetsTree = await this.prisma.mntAssetsTree.findUnique({
        where: { id: BigInt(id) },
      });

      if (!assetsTree) {
        throw new RpcException({
          status: 404,
          message: "Assets tree record not found",
        });
      }

      return { assetsTree: this.mapToResponse(assetsTree) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async findAll(dto: FindAllAssetsTreeDto) {
    try {
      const assetsTree = await this.prisma.mntAssetsTree.findMany({
        where: {
          ...(dto.assetCode ? { assetCode: dto.assetCode } : {}),
        },
        orderBy: { id: "asc" },
      });

      return {
        assetsTree: assetsTree.map(this.mapToResponse),
        total: assetsTree.length,
      };
    } catch (error) {
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async update(dto: UpdateAssetsTreeMessageDto) {
    try {
      const existing = await this.prisma.mntAssetsTree.findUnique({
        where: { id: BigInt(dto.id) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Assets tree record not found",
        });
      }

      const newAssetCode = dto.assetCode ?? existing.assetCode;
      const newUnit = dto.unit ?? existing.unit;
      const newSubunit = dto.subunit ?? existing.subunit;
      const newMaintainableItem =
        dto.maintainableItem ?? existing.maintainableItem;
      const newSparePartCode = dto.sparePartCode ?? existing.sparePartCode;

      const combinationExists = await this.prisma.mntAssetsTree.findFirst({
        where: {
          assetCode: newAssetCode,
          unit: newUnit,
          subunit: newSubunit,
          maintainableItem: newMaintainableItem,
          sparePartCode: newSparePartCode,
          id: { not: BigInt(dto.id) },
        },
      });

      if (combinationExists) {
        throw new RpcException({
          status: 400,
          message: "Assets tree combination already exists",
        });
      }

      if (dto.assetCode && dto.assetCode !== existing.assetCode) {
        const asset = await this.prisma.mntAsset.findUnique({
          where: { assetCode: dto.assetCode },
        });

        if (!asset) {
          throw new RpcException({
            status: 404,
            message: `Asset with code ${dto.assetCode} not found`,
          });
        }
      }

      const updated = await this.prisma.mntAssetsTree.update({
        where: { id: BigInt(dto.id) },
        data: {
          ...(dto.assetCode !== undefined ? { assetCode: dto.assetCode } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
          ...(dto.subunit !== undefined ? { subunit: dto.subunit } : {}),
          ...(dto.maintainableItem !== undefined
            ? { maintainableItem: dto.maintainableItem }
            : {}),
          ...(dto.sparePartCode !== undefined
            ? { sparePartCode: dto.sparePartCode }
            : {}),
          ...(dto.sparePartName !== undefined
            ? { sparePartName: dto.sparePartName }
            : {}),
          updatedBy: dto.actorId,
          updatedByName: dto.actorName,
          updatedAt: new Date(),
        },
      });

      return { assetsTree: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  async deactivate(id: number, actorId: string, actorName: string) {
    try {
      const existing = await this.prisma.mntAssetsTree.findUnique({
        where: { id: BigInt(id) },
      });

      if (!existing) {
        throw new RpcException({
          status: 404,
          message: "Assets tree record not found",
        });
      }

      const updated = await this.prisma.mntAssetsTree.update({
        where: { id: BigInt(id) },
        data: {
          isActive: "N",
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
      });

      return { assetsTree: this.mapToResponse(updated) };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: "Internal server error" });
    }
  }

  private mapToResponse(record: {
    id: bigint;
    assetCode: string;
    unit: string;
    subunit: string;
    maintainableItem: string;
    sparePartCode: string;
    sparePartName: string;
    createdBy: string | null;
    createdByName: string | null;
    updatedBy: string | null;
    updatedByName: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    isActive: string;
  }) {
    return {
      id: record.id.toString(),
      assetCode: record.assetCode,
      unit: record.unit,
      subunit: record.subunit,
      maintainableItem: record.maintainableItem,
      sparePartCode: record.sparePartCode,
      sparePartName: record.sparePartName,
      createdBy: record.createdBy,
      createdByName: record.createdByName,
      updatedBy: record.updatedBy,
      updatedByName: record.updatedByName,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      isActive: record.isActive,
    };
  }
}
