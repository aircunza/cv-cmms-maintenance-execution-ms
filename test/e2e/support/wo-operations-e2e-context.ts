import {
  assertRpcError,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  sendPattern,
  defaultWoPayload,
  createWorkOrder,
  type WorkOrderE2eContext,
} from "./work-order-e2e-context";
import { mockHumanResources } from "../data/hr.mock";

export {
  assertRpcError,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  sendPattern,
  defaultWoPayload,
  createWorkOrder,
};
export type { WorkOrderE2eContext };

const RES_001 = mockHumanResources[0].resourceCode;
const RES_002 = mockHumanResources[1].resourceCode;
const RES_003 = mockHumanResources[2].resourceCode;

export function defaultOperationPayload(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    workOrderCode: "",
    operationName: "Operation E2E",
    operationDescription: "Operation created in e2e test",
    operationSeqNumber: 20,
    operationStatus: "UNRELEASED",
    operationType: "Internal",
    organizationCode: context.organizationCode,
    actorId: context.actor.id,
    actorName: context.actor.username,
    resources: [
      {
        resourceCode: RES_001,
        resourceSequenceNumber: 1,
        actualHours: 2,
        principalFlag: "Y",
        actualStartDate: "2025-11-21T08:00:00.000Z",
        actualCompletionDate: "2025-11-21T10:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

export async function createOperation(
  context: WorkOrderE2eContext,
  workOrderCode: string | number,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(
    context.client,
    "wo.operation.create",
    defaultOperationPayload(context, {
      workOrderCode,
      ...overrides,
    }),
  );
}

export function findOperationPayload(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...overrides };
}

export async function findOperation(
  context: WorkOrderE2eContext,
  operationCode: string | number,
): Promise<any> {
  return sendPattern(context.client, "wo.operation.find.one", {
    operationCode,
  });
}

export async function findOperations(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(
    context.client,
    "wo.operation.find.all",
    findOperationPayload(context, overrides),
  );
}

export function defaultOperationUpdatePayload(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    operationCode: "",
    actorId: context.actor.id,
    actorName: context.actor.username,
    ...overrides,
  };
}

export async function updateOperation(
  context: WorkOrderE2eContext,
  operationCode: string | number,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(
    context.client,
    "wo.operation.update",
    defaultOperationUpdatePayload(context, { operationCode, ...overrides }),
  );
}

export async function reviewOperation(
  context: WorkOrderE2eContext,
  operationCode: string | number,
): Promise<any> {
  return sendPattern(context.client, "wo.operation.review", {
    operationCode,
    actorId: context.actor.id,
    actorName: context.actor.username,
  });
}

export function defaultOperationCancelPayload(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    operationCode: "",
    workOrderCode: "",
    organizationCode: context.organizationCode,
    actorId: context.actor.id,
    actorName: context.actor.username,
    canceledReason: "Canceled by e2e test",
    ...overrides,
  };
}

export async function cancelOperation(
  context: WorkOrderE2eContext,
  workOrderCode: string | number,
  operationCode: string | number,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(
    context.client,
    "wo.operation.cancel",
    defaultOperationCancelPayload(context, {
      workOrderCode,
      operationCode,
      ...overrides,
    }),
  );
}

export function defaultHrUsagePayload(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    operationCode: "",
    organizationCode: context.organizationCode,
    resourceCode: RES_002,
    resourceSequenceNumber: 2,
    actualHours: 3,
    principalFlag: "N",
    hourlyCost: 25.5,
    actualStartDate: "2025-11-21T09:00:00.000Z",
    actualCompletionDate: "2025-11-21T12:00:00.000Z",
    actorId: context.actor.id,
    actorName: context.actor.username,
    ...overrides,
  };
}

export async function createHrUsage(
  context: WorkOrderE2eContext,
  operationCode: string | number,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(
    context.client,
    "operation.hr.create",
    defaultHrUsagePayload(context, { operationCode, ...overrides }),
  );
}

export async function findHrUsages(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(context.client, "operation.hr.find.all", overrides);
}

export function defaultHrUpdatePayload(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "",
    actorId: context.actor.id,
    actorName: context.actor.username,
    ...overrides,
  };
}

export async function updateHrUsage(
  context: WorkOrderE2eContext,
  hrId: string | number,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(
    context.client,
    "operation.hr.update",
    defaultHrUpdatePayload(context, { id: hrId, ...overrides }),
  );
}

export function defaultHrCancelPayload(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "",
    operationCode: "",
    actorId: context.actor.id,
    actorName: context.actor.username,
    canceledReason: "Canceled by e2e test",
    ...overrides,
  };
}

export async function cancelHrUsage(
  context: WorkOrderE2eContext,
  operationCode: string | number,
  hrId: string | number,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(
    context.client,
    "operation.hr.cancel",
    defaultHrCancelPayload(context, {
      operationCode,
      id: hrId,
      ...overrides,
    }),
  );
}

export async function releaseWorkOrder(
  context: WorkOrderE2eContext,
  workOrderCode: string | number,
): Promise<any> {
  return sendPattern(context.client, "work.order.release", {
    workOrderCode,
    organizationCode: context.organizationCode,
    userRoles: context.userRoles,
    actorId: context.actor.id,
    actorName: context.actor.username,
  });
}

export async function findWorkOrder(
  context: WorkOrderE2eContext,
  workOrderCode: string | number,
): Promise<any> {
  return sendPattern(context.client, "work.order.find.one", {
    workOrderCode,
    organizationCode: context.organizationCode,
    userRoles: context.userRoles,
    userPermissions: context.userPermissions,
  });
}

export { RES_001, RES_002, RES_003 };