import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
