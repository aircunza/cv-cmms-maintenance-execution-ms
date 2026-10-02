import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { NATS_SERVICE } from 'src/config';
import { PrismaService } from 'src/prisma.service';
import {
  CreateWorkAreaDto,
  FindAllWorkAreasDto,
  UpdateWorkAreaDto,
} from './dto';

@Injectable()
export class WorkAreasService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NATS_SERVICE) private readonly client: ClientProxy,
  ) {}

  private async syncAssetsFromWorkArea(workAreaId: string) {
    const workArea = await this.prisma.workArea.findFirst({
      where: { id: workAreaId },
    });

    if (!workArea) {
      return;
    }

    await this.prisma.mntAsset.updateMany({
      where: {
        workCenter: {
          is: {
            workAreaId,
          },
        },
      },
      data: {
        workAreaCode: workArea.workAreaCode,
        workAreaDescription: workArea.workAreaDescription,
      },
    });
  }

  private async ensureOrganizationExists(code: string) {
    const localOrg = await this.prisma.organization.findFirst({
      where: { code, isActive: 'Y' },
    });

    if (localOrg) {
      return;
    }

    try {
      await firstValueFrom(
        this.client.send('organization.exists.by.code', { code }),
      );
    } catch (error) {
      throw new RpcException({
        status: 404,
        message: 'Organization not found',
      });
    }
  }

  async create(dto: CreateWorkAreaDto) {
    const { workAreaCode, workAreaDescription, organizationCode } = dto;

    try {
      await this.ensureOrganizationExists(organizationCode);

      const duplicated = await this.prisma.workArea.findFirst({
        where: {
          workAreaCode,
          organizationCode,
        },
      });

      if (duplicated) {
        throw new RpcException({
          status: 400,
          message: 'Work area code already exists for this organization',
        });
      }

      const workArea = await this.prisma.workArea.create({
        data: {
          id: randomUUID(),
          workAreaCode,
          workAreaDescription,
          organizationCode,
          isActive: 'Y',
        },
      });

      return { workArea };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findOne(id: string) {
    try {
      const workArea = await this.prisma.workArea.findFirst({
        where: { id, isActive: 'Y' },
      });

      if (!workArea) {
        throw new RpcException({ status: 404, message: 'Work area not found' });
      }

      return { workArea };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findAll(dto: FindAllWorkAreasDto) {
    const { workAreaCode, organizationCode, isActive } = dto;

    try {
      const workAreas = await this.prisma.workArea.findMany({
        where: {
          ...(workAreaCode ? { workAreaCode: { contains: workAreaCode } } : {}),
          ...(organizationCode
            ? { organizationCode: { contains: organizationCode } }
            : {}),
          ...(isActive ? { isActive } : { isActive: 'Y' }),
        },
        orderBy: { createdAt: 'desc' },
      });

      return { workAreas, total: workAreas.length };
    } catch {
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async update(dto: UpdateWorkAreaDto) {
    const { id, workAreaDescription, organizationCode, isActive } = dto;

    try {
      const existing = await this.prisma.workArea.findFirst({
        where: { id, isActive: 'Y' },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'Work area not found' });
      }

      if (organizationCode !== undefined) {
        await this.ensureOrganizationExists(organizationCode);
      }

      const hasUpdatableFields =
        workAreaDescription !== undefined ||
        organizationCode !== undefined ||
        isActive !== undefined;

      if (!hasUpdatableFields) {
        throw new RpcException({ status: 400, message: 'No fields to update' });
      }

      const updated = await this.prisma.workArea.update({
        where: { id },
        data: {
          ...(workAreaDescription !== undefined ? { workAreaDescription } : {}),
          ...(organizationCode !== undefined ? { organizationCode } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          updatedAt: new Date(),
        },
      });

      await this.syncAssetsFromWorkArea(updated.id);

      return { workArea: updated };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async deactivate(id: string) {
    try {
      const workArea = await this.prisma.workArea.findFirst({
        where: { id, isActive: 'Y' },
      });

      if (!workArea) {
        throw new RpcException({ status: 404, message: 'Work area not found' });
      }

      const updated = await this.prisma.workArea.update({
        where: { id },
        data: {
          isActive: 'N',
          updatedAt: new Date(),
        },
      });

      await this.syncAssetsFromWorkArea(updated.id);

      return {
        workArea: updated,
        message: 'Work area deactivated successfully',
      };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findOneByCode(code: string) {
    try {
      const organization = await this.prisma.organization.findFirst({
        where: {
          code,
          isActive: 'Y',
        },
      });

      return organization;
    } catch {
      return null;
    }
  }
}
