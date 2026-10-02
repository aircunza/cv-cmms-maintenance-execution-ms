import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { NATS_SERVICE } from 'src/config';
import { PrismaService } from 'src/prisma.service';
import { CreateAssetDto, FindAllAssetsDto, UpdateAssetDto } from './dto';

interface OrganizationSnapshot {
  organizationCode: string;
  organizationName: string | null;
  countryCode: string | null;
  countryName: string | null;
}

interface WorkCenterSnapshot {
  workCenterId: string | null;
  workCenterCode: string | null;
  workCenterDescription: string | null;
  centerCostCode: number | null;
  workAreaCode: string | null;
  workAreaDescription: string | null;
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NATS_SERVICE) private readonly client: ClientProxy,
  ) {}

  private async getOrganizationSnapshot(code: string) {
    try {
      const localOrg = await this.prisma.organization.findFirst({
        where: { code, isActive: 'Y' },
      });

      if (localOrg) {
        return {
          organizationCode: localOrg.code,
          organizationName: localOrg.name,
          countryCode: localOrg.countryCode,
          countryName: localOrg.countryName,
        } as OrganizationSnapshot;
      }

      const response = await firstValueFrom(
        this.client.send('organization.exists.by.code', { code }),
      );

      const organization =
        typeof response === 'object' &&
        response !== null &&
        'organization' in response &&
        typeof response.organization === 'object' &&
        response.organization !== null
          ? (response.organization as {
              code?: string;
              name?: string;
              countryCode?: string;
              countryName?: string;
            })
          : null;

      if (!organization?.code) {
        throw new RpcException({
          status: 500,
          message: 'Invalid organization response',
        });
      }

      return {
        organizationCode: organization.code,
        organizationName: organization.name ?? null,
        countryCode: organization.countryCode ?? null,
        countryName: organization.countryName ?? null,
      } as OrganizationSnapshot;
    } catch (error) {
      throw new RpcException(error);
    }
  }

  private async ensureUserExists(code: string) {
    try {
      await firstValueFrom(this.client.send('user.exists.by.code', { code }));
    } catch (error) {
      throw new RpcException(error);
    }
  }

  private async getWorkCenterSnapshot(workCenterId?: string) {
    if (!workCenterId) {
      return {
        workCenterId: null,
        workCenterCode: null,
        workCenterDescription: null,
        centerCostCode: null,
        workAreaCode: null,
        workAreaDescription: null,
      } as WorkCenterSnapshot;
    }

    const workCenter = await this.prisma.workCenter.findFirst({
      where: {
        id: workCenterId,
        isActive: 'Y',
      },
      include: {
        workArea: true,
      },
    });

    if (!workCenter) {
      throw new RpcException({ status: 404, message: 'Work center not found' });
    }

    return {
      workCenterId: workCenter.id,
      workCenterCode: workCenter.workCenterCode,
      workCenterDescription: workCenter.workCenterDescription,
      centerCostCode: workCenter.centerCostCode,
      workAreaCode: workCenter.workArea.workAreaCode,
      workAreaDescription: workCenter.workArea.workAreaDescription,
    } as WorkCenterSnapshot;
  }

  private async syncOrganizationNameForAssets(
    assets: Array<{
      assetCode: string;
      organizationCode: string;
      organizationName: string | null;
      countryCode: string | null;
      countryName: string | null;
    }>,
  ) {
    const uniqueCodes = Array.from(
      new Set(assets.map((asset) => asset.organizationCode)),
    );

    for (const organizationCode of uniqueCodes) {
      try {
        const localOrg = await this.prisma.organization.findFirst({
          where: { code: organizationCode, isActive: 'Y' },
        });

        if (!localOrg) {
          continue;
        }

        const hasNameDiff = assets.some(
          (asset) =>
            asset.organizationCode === organizationCode &&
            asset.organizationName !== localOrg.name,
        );

        if (!hasNameDiff) {
          continue;
        }

        await this.prisma.mntAsset.updateMany({
          where: { organizationCode },
          data: {
            organizationName: localOrg.name,
            countryCode: localOrg.countryCode,
            countryName: localOrg.countryName,
          },
        });

        for (const asset of assets) {
          if (asset.organizationCode === organizationCode) {
            asset.organizationName = localOrg.name;
            asset.countryCode = localOrg.countryCode;
            asset.countryName = localOrg.countryName;
          }
        }
      } catch {
      }
    }
  }

  async create(dto: CreateAssetDto) {
    const {
      assetCode,
      assetDescription,
      assetShortDescription,
      assetStatus,
      operationalHoursOrigin,
      organizationCode,
      workCenterId,
      accountingAccountCode,
      supervisorCode,
      assetDependency,
      processTypeCode,
      subprocessTypeCode,
      hierarchyCode,
      assetClass,
      enabledMaintenanceProgram,
      enabledMaintenanceHoursControl,
      enabledFinancialKpi,
      enabledTechnicalKpi,
      woAllowedFlag,
      enabledIiot,
      sector,
      subsector,
      actorCode,
    } = dto;

    try {
      const organizationSnapshot =
        await this.getOrganizationSnapshot(organizationCode);
      await this.ensureUserExists(actorCode);

      if (supervisorCode) {
        await this.ensureUserExists(supervisorCode);
      }

      const workCenterSnapshot = await this.getWorkCenterSnapshot(workCenterId);

      const duplicated = await this.prisma.mntAsset.findFirst({
        where: { assetCode },
      });

      if (duplicated) {
        throw new RpcException({
          status: 400,
          message: 'Asset code already exists',
        });
      }

      const asset = await this.prisma.mntAsset.create({
        data: {
          assetCode,
          assetDescription,
          assetShortDescription,
          assetStatus,
          operationalHoursOrigin,
          organizationCode: organizationSnapshot.organizationCode,
          organizationName: organizationSnapshot.organizationName,
          countryCode: organizationSnapshot.countryCode,
          countryName: organizationSnapshot.countryName,
          workCenterId: workCenterSnapshot.workCenterId,
          workCenterCode: workCenterSnapshot.workCenterCode,
          workCenterDescription: workCenterSnapshot.workCenterDescription,
          centerCostCode: workCenterSnapshot.centerCostCode,
          workAreaCode: workCenterSnapshot.workAreaCode,
          workAreaDescription: workCenterSnapshot.workAreaDescription,
          accountingAccountCode,
          supervisorCode,
          assetDependency,
          processTypeCode,
          subprocessTypeCode,
          hierarchyCode,
          assetClass,
          enabledMaintenanceProgram,
          enabledMaintenanceHoursControl,
          enabledFinancialKpi,
          enabledTechnicalKpi,
          woAllowedFlag,
          createdBy: actorCode,
          updatedBy: actorCode,
          updateUp: new Date(),
          enabledIiot,
          sector,
          subsector,
          isActive: 'Y',
        },
      });

      this.client.emit('asset.created', { asset });

      return { asset };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findOne(assetCode: string) {
    try {
      const asset = await this.prisma.mntAsset.findFirst({
        where: {
          assetCode,
          isActive: 'Y',
        },
      });

      if (!asset) {
        throw new RpcException({ status: 404, message: 'Asset not found' });
      }

      await this.syncOrganizationNameForAssets([
        {
          assetCode: asset.assetCode,
          organizationCode: asset.organizationCode,
          organizationName: asset.organizationName,
          countryCode: asset.countryCode,
          countryName: asset.countryName,
        },
      ]);

      const refreshedAsset = await this.prisma.mntAsset.findFirst({
        where: {
          assetCode,
          isActive: 'Y',
        },
      });

      if (!refreshedAsset) {
        throw new RpcException({ status: 404, message: 'Asset not found' });
      }

      return { asset: refreshedAsset };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async findAll(dto: FindAllAssetsDto) {
    const {
      assetCode,
      organizationCode,
      supervisorCode,
      assetStatus,
      isActive,
    } = dto;

    try {
      const assets = await this.prisma.mntAsset.findMany({
        where: {
          ...(assetCode ? { assetCode: { contains: assetCode } } : {}),
          ...(organizationCode
            ? { organizationCode: { contains: organizationCode } }
            : {}),
          ...(supervisorCode
            ? { supervisorCode: { contains: supervisorCode } }
            : {}),
          ...(assetStatus ? { assetStatus: { contains: assetStatus } } : {}),
          ...(isActive ? { isActive } : { isActive: 'Y' }),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      await this.syncOrganizationNameForAssets(
        assets.map((asset) => ({
          assetCode: asset.assetCode,
          organizationCode: asset.organizationCode,
          organizationName: asset.organizationName,
          countryCode: asset.countryCode,
          countryName: asset.countryName,
        })),
      );

      const refreshedAssets = await this.prisma.mntAsset.findMany({
        where: {
          ...(assetCode ? { assetCode: { contains: assetCode } } : {}),
          ...(organizationCode
            ? { organizationCode: { contains: organizationCode } }
            : {}),
          ...(supervisorCode
            ? { supervisorCode: { contains: supervisorCode } }
            : {}),
          ...(assetStatus ? { assetStatus: { contains: assetStatus } } : {}),
          ...(isActive ? { isActive } : { isActive: 'Y' }),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return { assets: refreshedAssets, total: refreshedAssets.length };
    } catch {
      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async update(dto: UpdateAssetDto) {
    const {
      assetCode,
      assetDescription,
      assetShortDescription,
      assetStatus,
      operationalHoursOrigin,
      organizationCode,
      workCenterId,
      accountingAccountCode,
      supervisorCode,
      assetDependency,
      processTypeCode,
      subprocessTypeCode,
      hierarchyCode,
      assetClass,
      enabledMaintenanceProgram,
      enabledMaintenanceHoursControl,
      enabledFinancialKpi,
      enabledTechnicalKpi,
      woAllowedFlag,
      enabledIiot,
      sector,
      subsector,
      isActive,
      actorCode,
    } = dto;

    try {
      const existing = await this.prisma.mntAsset.findFirst({
        where: {
          assetCode,
          isActive: 'Y',
        },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'Asset not found' });
      }

      await this.ensureUserExists(actorCode);

      const organizationSnapshot =
        organizationCode !== undefined
          ? await this.getOrganizationSnapshot(organizationCode)
          : null;

      if (supervisorCode !== undefined) {
        await this.ensureUserExists(supervisorCode);
      }

      const workCenterSnapshot =
        workCenterId !== undefined
          ? await this.getWorkCenterSnapshot(workCenterId)
          : null;

      const hasUpdatableFields =
        assetDescription !== undefined ||
        assetShortDescription !== undefined ||
        assetStatus !== undefined ||
        operationalHoursOrigin !== undefined ||
        organizationCode !== undefined ||
        workCenterId !== undefined ||
        accountingAccountCode !== undefined ||
        supervisorCode !== undefined ||
        assetDependency !== undefined ||
        processTypeCode !== undefined ||
        subprocessTypeCode !== undefined ||
        hierarchyCode !== undefined ||
        assetClass !== undefined ||
        enabledMaintenanceProgram !== undefined ||
        enabledMaintenanceHoursControl !== undefined ||
        enabledFinancialKpi !== undefined ||
        enabledTechnicalKpi !== undefined ||
        woAllowedFlag !== undefined ||
        enabledIiot !== undefined ||
        sector !== undefined ||
        subsector !== undefined ||
        isActive !== undefined;

      if (!hasUpdatableFields) {
        throw new RpcException({ status: 400, message: 'No fields to update' });
      }

      const updated = await this.prisma.mntAsset.update({
        where: { assetCode },
        data: {
          ...(assetDescription !== undefined ? { assetDescription } : {}),
          ...(assetShortDescription !== undefined
            ? { assetShortDescription }
            : {}),
          ...(assetStatus !== undefined ? { assetStatus } : {}),
          ...(operationalHoursOrigin !== undefined
            ? { operationalHoursOrigin }
            : {}),
          ...(organizationSnapshot
            ? {
                organizationCode: organizationSnapshot.organizationCode,
                organizationName: organizationSnapshot.organizationName,
                countryCode: organizationSnapshot.countryCode,
                countryName: organizationSnapshot.countryName,
              }
            : {}),
          ...(workCenterSnapshot
            ? {
                workCenterId: workCenterSnapshot.workCenterId,
                workCenterCode: workCenterSnapshot.workCenterCode,
                workCenterDescription: workCenterSnapshot.workCenterDescription,
                centerCostCode: workCenterSnapshot.centerCostCode,
                workAreaCode: workCenterSnapshot.workAreaCode,
                workAreaDescription: workCenterSnapshot.workAreaDescription,
              }
            : {}),
          ...(accountingAccountCode !== undefined
            ? { accountingAccountCode }
            : {}),
          ...(supervisorCode !== undefined ? { supervisorCode } : {}),
          ...(assetDependency !== undefined ? { assetDependency } : {}),
          ...(processTypeCode !== undefined ? { processTypeCode } : {}),
          ...(subprocessTypeCode !== undefined ? { subprocessTypeCode } : {}),
          ...(hierarchyCode !== undefined ? { hierarchyCode } : {}),
          ...(assetClass !== undefined ? { assetClass } : {}),
          ...(enabledMaintenanceProgram !== undefined
            ? { enabledMaintenanceProgram }
            : {}),
          ...(enabledMaintenanceHoursControl !== undefined
            ? { enabledMaintenanceHoursControl }
            : {}),
          ...(enabledFinancialKpi !== undefined ? { enabledFinancialKpi } : {}),
          ...(enabledTechnicalKpi !== undefined ? { enabledTechnicalKpi } : {}),
          ...(woAllowedFlag !== undefined ? { woAllowedFlag } : {}),
          ...(enabledIiot !== undefined ? { enabledIiot } : {}),
          ...(sector !== undefined ? { sector } : {}),
          ...(subsector !== undefined ? { subsector } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          updatedBy: actorCode,
          updateUp: new Date(),
        },
      });

      this.client.emit('asset.updated', { asset: updated });

      return { asset: updated };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async deactivate(assetCode: string, actorCode: string) {
    try {
      const existing = await this.prisma.mntAsset.findFirst({
        where: {
          assetCode,
          isActive: 'Y',
        },
      });

      if (!existing) {
        throw new RpcException({ status: 404, message: 'Asset not found' });
      }

      await this.ensureUserExists(actorCode);

      const updated = await this.prisma.mntAsset.update({
        where: { assetCode },
        data: {
          isActive: 'N',
          updatedBy: actorCode,
          updateUp: new Date(),
        },
      });

      this.client.emit('asset.deactivated', { assetCode, isActive: 'N' });

      return {
        asset: updated,
        message: 'Asset deactivated successfully',
      };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({ status: 500, message: 'Internal server error' });
    }
  }

  async syncAssetsByOrganizationCode(
    organizationCode: string,
    orgData: {
      name: string;
      countryCode: string;
      countryName: string;
      isActive: string;
    },
  ) {
    const updateData: Record<string, unknown> = {
      organizationName: orgData.name,
      countryCode: orgData.countryCode,
      countryName: orgData.countryName,
    };

    if (orgData.isActive === 'N') {
      updateData.isActive = 'N';
    }

    await this.prisma.mntAsset.updateMany({
      where: { organizationCode },
      data: updateData,
    });
  }

  async syncOrganization(data: {
    id: string;
    code: string;
    name: string;
    countryCode: string;
    countryName: string;
    timezone: string;
    offsetMinutes: number | null;
    isActive: string;
  }) {
    try {
      await this.prisma.organization.upsert({
        where: { code: data.code },
        create: data,
        update: {
          name: data.name,
          countryCode: data.countryCode,
          countryName: data.countryName,
          timezone: data.timezone,
          offsetMinutes: data.offsetMinutes,
          isActive: data.isActive,
          updatedAt: new Date(),
        },
      });
    } catch {
      throw new RpcException({
        status: 500,
        message: 'Failed to sync organization',
      });
    }
  }

  async updateOrganization(data: {
    id: string;
    code: string;
    name: string;
    countryCode: string;
    countryName: string;
    timezone: string;
    offsetMinutes: number | null;
    isActive: string;
  }) {
    try {
      await this.prisma.organization.update({
        where: { code: data.code },
        data: {
          name: data.name,
          countryCode: data.countryCode,
          countryName: data.countryName,
          timezone: data.timezone,
          offsetMinutes: data.offsetMinutes,
          isActive: data.isActive,
          updatedAt: new Date(),
        },
      });
    } catch {
      throw new RpcException({
        status: 500,
        message: 'Failed to update organization',
      });
    }
  }

  async deactivateOrganization(code: string) {
    try {
      await this.prisma.organization.update({
        where: { code },
        data: {
          isActive: 'N',
          updatedAt: new Date(),
        },
      });
    } catch {
      throw new RpcException({
        status: 500,
        message: 'Failed to deactivate organization',
      });
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

  async handleAssetCreated(assetData: unknown) {
    try {
      const asset = assetData as Record<string, unknown>;
      await this.prisma.mntAsset.upsert({
        where: { assetCode: asset.assetCode as string },
        create: {
          assetCode: asset.assetCode as string,
          assetDescription: asset.assetDescription as string | null,
          assetShortDescription: asset.assetShortDescription as string | null,
          assetStatus: asset.assetStatus as string | null,
          operationalHoursOrigin: asset.operationalHoursOrigin as string | null,
          organizationCode: asset.organizationCode as string,
          organizationName: asset.organizationName as string | null,
          countryCode: asset.countryCode as string | null,
          countryName: asset.countryName as string | null,
          workCenterId: asset.workCenterId as string | null,
          workCenterCode: asset.workCenterCode as string | null,
          workCenterDescription: asset.workCenterDescription as string | null,
          centerCostCode: asset.centerCostCode as number | null,
          workAreaCode: asset.workAreaCode as string | null,
          workAreaDescription: asset.workAreaDescription as string | null,
          accountingAccountCode: asset.accountingAccountCode as string | null,
          supervisorCode: asset.supervisorCode as string | null,
          assetDependency: asset.assetDependency as string | null,
          processTypeCode: asset.processTypeCode as string | null,
          subprocessTypeCode: asset.subprocessTypeCode as string | null,
          hierarchyCode: asset.hierarchyCode as string | null,
          assetClass: asset.assetClass as string | null,
          enabledMaintenanceProgram: asset.enabledMaintenanceProgram as string | null,
          enabledMaintenanceHoursControl: asset.enabledMaintenanceHoursControl as string | null,
          enabledFinancialKpi: asset.enabledFinancialKpi as string | null,
          enabledTechnicalKpi: asset.enabledTechnicalKpi as string | null,
          woAllowedFlag: asset.woAllowedFlag as string | null,
          createdBy: asset.createdBy as string | null,
          updatedBy: asset.updatedBy as string | null,
          updateUp: asset.updateUp as Date | null,
          enabledIiot: asset.enabledIiot as string | null,
          sector: asset.sector as string | null,
          subsector: asset.subsector as string | null,
          isActive: asset.isActive as string,
        },
        update: {
          assetDescription: asset.assetDescription as string | null,
          assetShortDescription: asset.assetShortDescription as string | null,
          assetStatus: asset.assetStatus as string | null,
          operationalHoursOrigin: asset.operationalHoursOrigin as string | null,
          organizationCode: asset.organizationCode as string,
          organizationName: asset.organizationName as string | null,
          countryCode: asset.countryCode as string | null,
          countryName: asset.countryName as string | null,
          workCenterId: asset.workCenterId as string | null,
          workCenterCode: asset.workCenterCode as string | null,
          workCenterDescription: asset.workCenterDescription as string | null,
          centerCostCode: asset.centerCostCode as number | null,
          workAreaCode: asset.workAreaCode as string | null,
          workAreaDescription: asset.workAreaDescription as string | null,
          accountingAccountCode: asset.accountingAccountCode as string | null,
          supervisorCode: asset.supervisorCode as string | null,
          assetDependency: asset.assetDependency as string | null,
          processTypeCode: asset.processTypeCode as string | null,
          subprocessTypeCode: asset.subprocessTypeCode as string | null,
          hierarchyCode: asset.hierarchyCode as string | null,
          assetClass: asset.assetClass as string | null,
          enabledMaintenanceProgram: asset.enabledMaintenanceProgram as string | null,
          enabledMaintenanceHoursControl: asset.enabledMaintenanceHoursControl as string | null,
          enabledFinancialKpi: asset.enabledFinancialKpi as string | null,
          enabledTechnicalKpi: asset.enabledTechnicalKpi as string | null,
          woAllowedFlag: asset.woAllowedFlag as string | null,
          updatedBy: asset.updatedBy as string | null,
          updateUp: asset.updateUp as Date | null,
          enabledIiot: asset.enabledIiot as string | null,
          sector: asset.sector as string | null,
          subsector: asset.subsector as string | null,
          isActive: asset.isActive as string,
        },
      });
      this.logger.log(`Asset projection created/updated: ${asset.assetCode}`);
    } catch (error) {
      this.logger.error('Error handling asset created event', error);
    }
  }

  async handleAssetUpdated(assetData: unknown) {
    try {
      const asset = assetData as Record<string, unknown>;
      await this.prisma.mntAsset.update({
        where: { assetCode: asset.assetCode as string },
        data: {
          assetDescription: asset.assetDescription as string | null,
          assetShortDescription: asset.assetShortDescription as string | null,
          assetStatus: asset.assetStatus as string | null,
          operationalHoursOrigin: asset.operationalHoursOrigin as string | null,
          organizationCode: asset.organizationCode as string,
          organizationName: asset.organizationName as string | null,
          countryCode: asset.countryCode as string | null,
          countryName: asset.countryName as string | null,
          workCenterId: asset.workCenterId as string | null,
          workCenterCode: asset.workCenterCode as string | null,
          workCenterDescription: asset.workCenterDescription as string | null,
          centerCostCode: asset.centerCostCode as number | null,
          workAreaCode: asset.workAreaCode as string | null,
          workAreaDescription: asset.workAreaDescription as string | null,
          accountingAccountCode: asset.accountingAccountCode as string | null,
          supervisorCode: asset.supervisorCode as string | null,
          assetDependency: asset.assetDependency as string | null,
          processTypeCode: asset.processTypeCode as string | null,
          subprocessTypeCode: asset.subprocessTypeCode as string | null,
          hierarchyCode: asset.hierarchyCode as string | null,
          assetClass: asset.assetClass as string | null,
          enabledMaintenanceProgram: asset.enabledMaintenanceProgram as string | null,
          enabledMaintenanceHoursControl: asset.enabledMaintenanceHoursControl as string | null,
          enabledFinancialKpi: asset.enabledFinancialKpi as string | null,
          enabledTechnicalKpi: asset.enabledTechnicalKpi as string | null,
          woAllowedFlag: asset.woAllowedFlag as string | null,
          updatedBy: asset.updatedBy as string | null,
          updateUp: asset.updateUp as Date | null,
          enabledIiot: asset.enabledIiot as string | null,
          sector: asset.sector as string | null,
          subsector: asset.subsector as string | null,
          isActive: asset.isActive as string,
        },
      });
      this.logger.log(`Asset projection updated: ${asset.assetCode}`);
    } catch (error) {
      this.logger.error('Error handling asset updated event', error);
    }
  }

  async handleAssetDeactivated(assetCode: string, isActive: string) {
    try {
      await this.prisma.mntAsset.update({
        where: { assetCode },
        data: { isActive },
      });
      this.logger.log(`Asset projection deactivated: ${assetCode}`);
    } catch (error) {
      this.logger.error('Error handling asset deactivated event', error);
    }
  }
}
