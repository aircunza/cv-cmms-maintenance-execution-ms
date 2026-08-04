import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from 'src/prisma.service';
import { CreateHumanResourceDto, UpdateHumanResourceDto, FindAllHumanResourceDto } from './dto';

@Injectable()
export class HumanResourcesService {
  private readonly logger = new Logger(HumanResourcesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHumanResourceDto & { actorId: string; actorName: string }) {
    try {
      const existing = await this.prisma.mntHumanResource.findFirst({
        where: {
          resourceCode: dto.resourceCode,
          organizationCode: dto.organizationCode,
        },
      });

      if (existing) {
        throw new RpcException({
          status: 400,
          message: `Human resource ${dto.resourceCode} already exists for organization ${dto.organizationCode}`,
        });
      }

      const hr = await this.prisma.mntHumanResource.create({
        data: {
          resourceCode: dto.resourceCode,
          resourceName: dto.resourceName,
          resourceType: dto.resourceType,
          organizationCode: dto.organizationCode,
          organizationName: dto.organizationName,
          availabilityStatus: dto.availabilityStatus,
          supervisorId: dto.supervisorId,
          supervisorName: dto.supervisorName,
          isActive: dto.isActive ?? 'Y',
          createdBy: dto.actorId,
          createdByName: dto.actorName,
        },
      });

      return { humanResource: hr };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findOne(resourceCode: string, organizationCode: string) {
    try {
      const hr = await this.prisma.mntHumanResource.findFirst({
        where: {
          resourceCode,
          organizationCode,
        },
      });

      if (!hr) {
        throw new RpcException({ status: 404, message: 'Human resource not found' });
      }

      return { humanResource: hr };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findAll(dto: FindAllHumanResourceDto) {
    try {
      const hrs = await this.prisma.mntHumanResource.findMany({
        where: {
          ...(dto.organizationCode ? { organizationCode: dto.organizationCode } : {}),
          ...(dto.resourceType ? { resourceType: dto.resourceType } : {}),
          ...(dto.availabilityStatus ? { availabilityStatus: dto.availabilityStatus } : {}),
        },
        orderBy: { resourceName: 'asc' },
      });

      return { humanResources: hrs, total: hrs.length };
    } catch (error) {
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async update(dto: UpdateHumanResourceDto & { resourceCode: string; organizationCode: string; actorId: string; actorName: string }) {
    try {
      const existing = await this.prisma.mntHumanResource.findFirst({
        where: {
          resourceCode: dto.resourceCode,
          organizationCode: dto.organizationCode,
        },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'Human resource not found' });
      }

      const updated = await this.prisma.mntHumanResource.update({
        where: { resourceCode: dto.resourceCode },
        data: {
          ...(dto.resourceName !== undefined ? { resourceName: dto.resourceName } : {}),
          ...(dto.resourceType !== undefined ? { resourceType: dto.resourceType } : {}),
          ...(dto.organizationName !== undefined ? { organizationName: dto.organizationName } : {}),
          ...(dto.availabilityStatus !== undefined ? { availabilityStatus: dto.availabilityStatus } : {}),
          ...(dto.supervisorId !== undefined ? { supervisorId: dto.supervisorId } : {}),
          ...(dto.supervisorName !== undefined ? { supervisorName: dto.supervisorName } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedBy: dto.actorId,
          updatedByName: dto.actorName,
          updatedAt: new Date(),
        },
      });

      return { humanResource: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async deactivate(resourceCode: string, organizationCode: string, actorId: string, actorName: string) {
    try {
      const existing = await this.prisma.mntHumanResource.findFirst({
        where: {
          resourceCode,
          organizationCode,
        },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'Human resource not found' });
      }

      const updated = await this.prisma.mntHumanResource.update({
        where: { resourceCode },
        data: {
          isActive: 'N',
          updatedBy: actorId,
          updatedByName: actorName,
          updatedAt: new Date(),
        },
      });

      return { humanResource: updated };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }
}
