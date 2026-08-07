import { PrismaService } from "src/prisma.service";
import { mockAssets } from "../../data/mnt.assets.mock";
import { mockOrganizations } from "../../data/organizations.mock";
import { mockHumanResources } from "../../data/hr.mock";

export class OrganizationContextBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async setup(): Promise<void> {
    for (const asset of mockAssets) {
      await this.prisma.mntAsset.upsert({
        where: { assetCode: asset.assetCode },
        create: asset,
        update: {
          assetDescription: asset.assetDescription,
          assetShortDescription: asset.assetShortDescription,
          assetStatus: asset.assetStatus,
          operationalHoursOrigin: asset.operationalHoursOrigin,
          organizationCode: asset.organizationCode,
          organizationName: asset.organizationName,
          workCenterId: asset.workCenterId,
          workCenterCode: asset.workCenterCode,
          workCenterDescription: asset.workCenterDescription,
          centerCostCode: asset.centerCostCode,
          workAreaCode: asset.workAreaCode,
          workAreaDescription: asset.workAreaDescription,
          accountingAccountCode: asset.accountingAccountCode,
          supervisorCode: asset.supervisorCode,
          assetDependency: asset.assetDependency,
          processTypeCode: asset.processTypeCode,
          subprocessTypeCode: asset.subprocessTypeCode,
          hierarchyCode: asset.hierarchyCode,
          assetClass: asset.assetClass,
          enabledMaintenanceProgram: asset.enabledMaintenanceProgram,
          enabledMaintenanceHoursControl: asset.enabledMaintenanceHoursControl,
          enabledFinancialKpi: asset.enabledFinancialKpi,
          enabledTechnicalKpi: asset.enabledTechnicalKpi,
          woAllowedFlag: asset.woAllowedFlag,
          createdBy: asset.createdBy,
          updatedBy: asset.updatedBy,
          updateUp: asset.updateUp,
          enabledIiot: asset.enabledIiot,
          sector: asset.sector,
          subsector: asset.subsector,
          isActive: asset.isActive,
        },
      });
    }

    for (const hr of mockHumanResources) {
      await this.prisma.mntHumanResource.upsert({
        where: { resourceCode: hr.resourceCode },
        create: hr,
        update: hr,
      });
    }
  }

  async teardown(): Promise<void> {
    const organizationCodes = mockOrganizations.map(
      (organization) => organization.code,
    );
    const assetCodes = mockAssets.map((asset) => asset.assetCode);

    // Delete from child tables to parent tables to respect FK constraints.
    await this.prisma.$transaction(async (tx) => {
      await tx.mntOperationMaterialUsage.deleteMany({
        where: { organizationCode: { in: organizationCodes } },
      });

      await tx.mntOperationHumanResourceUsage.deleteMany({
        where: { organizationCode: { in: organizationCodes } },
      });

      await tx.mntWoOperation.deleteMany({
        where: { organizationCode: { in: organizationCodes } },
      });

      await tx.mntWorkOrder.deleteMany({
        where: { organizationCode: { in: organizationCodes } },
      });

      await tx.mntWorkRequest.deleteMany({
        where: { organizationCode: { in: organizationCodes } },
      });

      await tx.mntHumanResource.deleteMany({
        where: { organizationCode: { in: organizationCodes } },
      });

      await tx.mntAsset.deleteMany({
        where: { assetCode: { in: assetCodes } },
      });
    });
  }

  async createWorkRequest(data: {
    requestId: bigint;
    assetCode: string;
    issueDescription: string;
    statusCode: string;
    organizationCode: string;
    createdBy: string;
    createdByName: string;
  }): Promise<void> {
    await this.prisma.mntWorkRequest.create({ data });
  }
}
