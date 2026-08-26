import { OracleEquivalences } from "./oracle-equivalences";

type WorkOrderTypeKey =
  keyof typeof OracleEquivalences.WorkOrderTypeCode;
type WorkOrderSubTypeKey =
  keyof typeof OracleEquivalences.WorkOrderSubTypeCode;
type WorkOrderStatusKey =
  keyof typeof OracleEquivalences.WorkOrderStatusCode;
type WorkOrderOperationTypeKey =
  keyof typeof OracleEquivalences.WorkOrderOperation.OperationType;

interface ResourceWithPrincipal {
  resourceSequenceNumber: number;
  principalFlag: boolean;
  resourceCode: string;
  actualHours: number;
  [key: string]: any;
}

function formatDateForOracle(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function groupResourcesBySequence(resources: any[]): Map<number, any[]> {
  const groups = new Map<number, any[]>();
  for (const resource of resources) {
    const seq = resource.resourceSequenceNumber;
    if (!groups.has(seq)) {
      groups.set(seq, []);
    }
    groups.get(seq)!.push(resource);
  }
  return groups;
}

function assignPrincipalFlags(resources: any[]): ResourceWithPrincipal[] {
  if (!resources || resources.length === 0) return [];

  const groups = groupResourcesBySequence(resources);
  const principalMap = new Map<number, number>();

  for (const [seq, groupResources] of groups.entries()) {
    if (groupResources.length > 1) {
      const firstIndex = resources.indexOf(groupResources[0]);
      principalMap.set(seq, firstIndex);
    }
  }

  return resources.map((resource, index) => {
    const seq = resource.resourceSequenceNumber;
    const group = groups.get(seq)!;
    let principalFlag = false;

    if (group.length > 1) {
      const principalIndex = principalMap.get(seq);
      principalFlag = index === principalIndex;
    }

    return { ...resource, principalFlag };
  });
}

export class OracleWorkOrderMapper {
  static toOraclePayload(fullWorkOrder: any): Record<string, any> {
    const typeKey = fullWorkOrder.workOrderType as WorkOrderTypeKey;
    const subTypeKey = fullWorkOrder.workOrderSubType as WorkOrderSubTypeKey;
    const statusKey = fullWorkOrder.woStatusCode as WorkOrderStatusKey;

    const ops = Array.isArray(fullWorkOrder.woOperations)
      ? fullWorkOrder.woOperations
      : [];
    const lastIndex = Math.max(0, ops.length - 1);

    const mappedOperations = ops.map((op: any, idx: number) => {
      const isCountPoint = idx === lastIndex;
      const opTypeKey = op.operationType as WorkOrderOperationTypeKey;

      const humanResources = Array.isArray(op.hrUsages) ? op.hrUsages : [];
      const resourcesWithPrincipal = assignPrincipalFlags(humanResources);

      const mappedResources = resourcesWithPrincipal.map(
        (hr: ResourceWithPrincipal) => {
          const chargeType = isCountPoint ? "AUTOMATIC" : "MANUAL";
          return {
            PrincipalFlag: hr.principalFlag,
            BasisType: 1,
            ResourceCode: hr.resourceCode,
            UsageRate: hr.actualHours,
            ResourceSequenceNumber: hr.resourceSequenceNumber,
            ChargeType: chargeType,
          };
        },
      );

      const materialUsages = Array.isArray(op.materialUsages)
        ? op.materialUsages
        : [];
      const mappedMaterials = materialUsages.map((mat: any) => ({
        MaterialSequenceNumber: mat.materialSequenceNumber,
        Quantity: mat.quantity,
        SupplyType: mat.supplyType,
        InventoryItemNumber: mat.materialCode,
      }));

      const operation: Record<string, any> = {
        OperationName: op.operationName,
        OperationSequenceNumber: op.operationSeqNumber,
        OperationDescription: op.operationDescription,
        OperationType:
          OracleEquivalences.WorkOrderOperation.OperationType[opTypeKey] ??
          "IN_HOUSE",
        WorkCenterCode:
          OracleEquivalences.WorkCenterCode.MaintenanceDepartment,
        CountPointOperationFlag: idx === lastIndex,
        PlannedStartDate: formatDateForOracle(op.actualStartDate),
        WorkOrderOperationResource: mappedResources,
      };

      if (mappedMaterials.length > 0) {
        operation.WorkOrderOperationMaterial = mappedMaterials;
      }

      return operation;
    });

    return {
      OrganizationCode: fullWorkOrder.organizationCode,
      WorkOrderDescription: fullWorkOrder.workOrderDescription,
      AssetNumber: fullWorkOrder.assetCode,
      WorkOrderTypeCode:
        OracleEquivalences.WorkOrderTypeCode[typeKey],
      WorkOrderSubTypeCode:
        OracleEquivalences.WorkOrderSubTypeCode[subTypeKey],
      WorkOrderPriority: fullWorkOrder.workOrderPriority,
      WorkOrderStatusCode:
        OracleEquivalences.WorkOrderStatusCode[statusKey],
      PlannedStartDate: formatDateForOracle(fullWorkOrder.actualStartDate),
      WorkOrderOperation: mappedOperations,
    };
  }
}
