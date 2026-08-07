import {
  assertRpcError,
  createWorkOrder,
  defaultWoPayload,
  sendPattern,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/work-order-e2e-context";
import { mockHumanResources } from "./data/hr.mock";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

const RES_001 = mockHumanResources[0].resourceCode;
const RES_002 = mockHumanResources[1].resourceCode;

describe("WO Creation POST (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  // ==================== HAPPY PATH ====================

  it("creates WO with full operations, resources, and materials", async () => {
    const response = await createWorkOrder(context, {
      operations: [
        {
          operationName: "Lubrication",
          operationDescription: "Lubrication of all components",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
          ],
          workOrderOperationMaterial: [
            {
              materialSequenceNumber: 10,
              quantity: 1,
              supplyType: "1",
              materialCode: "MAT-001",
            },
          ],
        },
      ],
    });

    expect(response.workOrder).toBeDefined();
    expect(response.workOrder.workOrderCode).toBeDefined();
    expect(response.workOrder.workOrderDescription).toBe("E2E Work Order Test");
    expect(response.workOrder.assetCode).toBe("E2E_WO_AST_001");
    expect(response.workOrder.woStatusCode).toBe("UNRELEASED");
    expect(response.workOrder.woStatusLabel).toBe("Unreleased");
    expect(response.workOrder.workOrderType).toBe("Planned");
    expect(response.workOrder.workOrderSubType).toBe("Preventive");
    expect(response.workOrder.workOrderPriority).toBe("2");
    expect(response.workOrder.enableOracleWorkOrder).toBe("N");
    expect(response.workOrder.organizationCode).toBe(context.organizationCode);
    expect(response.workOrder.createdBy).toBe(context.actor.id);
    expect(response.workOrder.createdByName).toBe(context.actor.username);
    expect(response.workOrder.operations).toBeDefined();
    expect(response.workOrder.operations.length).toBe(1);

    const op = response.workOrder.operations[0];
    expect(op.operationName).toBe("Lubrication");
    expect(op.operationSubType).toBe("Preventive");
    expect(op.operationStatusLabel).toBe("Unreleased");
    expect(op.workOrderOperationResource.length).toBe(1);
    expect(op.workOrderOperationMaterial.length).toBe(1);
  });

  it("creates WO without operations -> default operation created", async () => {
    const response = await createWorkOrder(context, {
      operations: [],
    });

    expect(response.workOrder).toBeDefined();
    expect(response.workOrder.operations.length).toBe(1);

    const op = response.workOrder.operations[0];
    expect(op.operationName).toBe("DEFAULT_OPERATION");
    expect(op.operationDescription).toBe("Auto-generated default operation");
    expect(op.operationSeqNumber).toBe(1);
    expect(op.operationStatus).toBe("UNRELEASED");
    expect(op.operationType).toBe("Internal");
    expect(op.operationSubType).toBe("Preventive");
    expect(op.workOrderOperationResource.length).toBe(1);
    expect(op.workOrderOperationResource[0].principalFlag).toBe("N");
  });

  it("creates WO with single operation, single resource", async () => {
    const response = await createWorkOrder(context, {
      operations: [
        {
          operationName: "Single Op",
          operationDescription: "Single operation test",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
          ],
        },
      ],
    });

    expect(response.workOrder.workOrderCode).toBeDefined();
    expect(response.workOrder.operations.length).toBe(1);
    expect(response.workOrder.operations[0].operationName).toBe("Single Op");
  });

  it("creates WO with parallel resources (same seqNumber) -> actualHours = MAX", async () => {
    const response = await createWorkOrder(context, {
      operations: [
        {
          operationName: "Parallel Test",
          operationDescription: "Parallel resources test",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
            {
              principalFlag: "N",
              resourceCode: RES_002,
              resourceSequenceNumber: 1,
              plannedHours: 3,
              actualHours: 3,
            },
          ],
        },
      ],
    });

    const op = response.workOrder.operations[0];
    expect(op.actualHours).toBe(3);
    expect(response.workOrder.actualHours).toBe(3);
  });

  // ==================== CALCULATIONS ====================

  it("calculates actualHours correctly for parallel resources", async () => {
    const response = await createWorkOrder(context, {
      operations: [
        {
          operationName: "Parallel Calc",
          operationDescription: "Verify MAX calculation",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
            {
              principalFlag: "N",
              resourceCode: RES_002,
              resourceSequenceNumber: 1,
              plannedHours: 5,
              actualHours: 5,
            },
          ],
        },
      ],
    });

    const op = response.workOrder.operations[0];
    expect(op.actualHours).toBe(5);
  });

  it("calculates WO actualHours as sum of all operations", async () => {
    const response = await createWorkOrder(context, {
      operations: [
        {
          operationName: "Op 1",
          operationDescription: "First operation",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
          ],
        },
        {
          operationName: "Op 2",
          operationDescription: "Second operation",
          operationSeqNumber: 20,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T11:00:00.000Z",
          actualCompletionDate: "2025-11-21T14:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 3,
              actualHours: 3,
            },
          ],
        },
      ],
    });

    expect(response.workOrder.actualHours).toBe(5);
  });

  it("calculates WO actualStartDate as earliest operation", async () => {
    const response = await createWorkOrder(context, {
      operations: [
        {
          operationName: "Op 1",
          operationDescription: "First operation",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T06:00:00.000Z",
          actualCompletionDate: "2025-11-21T08:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
          ],
        },
        {
          operationName: "Op 2",
          operationDescription: "Second operation",
          operationSeqNumber: 20,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
          ],
        },
      ],
    });

    const woStart = new Date(response.workOrder.actualStartDate);
    expect(woStart.toISOString()).toBe("2025-11-21T06:00:00.000Z");
  });

  it("calculates WO actualCompletionDate as latest operation", async () => {
    const response = await createWorkOrder(context, {
      operations: [
        {
          operationName: "Op 1",
          operationDescription: "First operation",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
          ],
        },
        {
          operationName: "Op 2",
          operationDescription: "Second operation",
          operationSeqNumber: 20,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T11:00:00.000Z",
          actualCompletionDate: "2025-11-21T18:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 7,
              actualHours: 7,
            },
          ],
        },
      ],
    });

    const woCompletion = new Date(response.workOrder.actualCompletionDate);
    expect(woCompletion.toISOString()).toBe("2025-11-21T18:00:00.000Z");
  });

  it("overwrites client-provided actualCompletionDate with backend calculation", async () => {
    const response = await createWorkOrder(context, {
      operations: [
        {
          operationName: "Recalc Test",
          operationDescription: "Backend should recalculate completion date",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T20:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
          ],
        },
      ],
    });

    const op = response.workOrder.operations[0];
    const expectedCompletion = new Date("2025-11-21T08:00:00.000Z");
    expectedCompletion.setHours(expectedCompletion.getHours() + 2);
    expect(new Date(op.actualCompletionDate).getTime()).toBe(
      expectedCompletion.getTime(),
    );
  });

  it("calculates totalManHours and totalSupplierHours correctly", async () => {
    const response = await createWorkOrder(context, {
      operations: [
        {
          operationName: "Internal Op",
          operationDescription: "Internal operation",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
          ],
        },
        {
          operationName: "Supplier Op",
          operationDescription: "Supplier operation",
          operationSeqNumber: 20,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Supplier",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T11:00:00.000Z",
          actualCompletionDate: "2025-11-21T14:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_002,
              resourceSequenceNumber: 1,
              plannedHours: 3,
              actualHours: 3,
            },
          ],
        },
      ],
    });

    expect(response.workOrder.totalManHours).toBe(2);
    expect(response.workOrder.totalSupplierHours).toBe(3);
  });

  // ==================== RESPONSE STRUCTURE ====================

  it("returns woStatusLabel in Title Case", async () => {
    const response = await createWorkOrder(context);

    expect(response.workOrder.woStatusLabel).toBe("Unreleased");
  });

  it("returns operationStatusLabel in Title Case", async () => {
    const response = await createWorkOrder(context);

    expect(response.workOrder.operations[0].operationStatusLabel).toBe(
      "Unreleased",
    );
  });

  it("propagates asset fields to operations", async () => {
    const response = await createWorkOrder(context);

    const op = response.workOrder.operations[0];
    expect(op.assetCode).toBe("E2E_WO_AST_001");
    expect(op.assetShortDescription).toBe("E2E WO AST 001");
    expect(op.organizationCode).toBe(context.organizationCode);
  });

  it("returns all calculated fields", async () => {
    const response = await createWorkOrder(context);

    expect(response.workOrder.actualHours).toBeDefined();
    expect(response.workOrder.actualStartDate).toBeDefined();
    expect(response.workOrder.actualCompletionDate).toBeDefined();
    expect(response.workOrder.totalManHours).toBeDefined();
    expect(response.workOrder.totalSupplierHours).toBeDefined();
    expect(response.workOrder.workOrderCode).toBeDefined();
  });

  // ==================== REQUIRED FIELD VALIDATIONS (400) ====================

  it("rejects when workOrderDescription is missing", async () => {
    await assertRpcError(
      createWorkOrder(context, { workOrderDescription: undefined }),
      400,
    );
  });

  it("rejects when woStatusCode is missing", async () => {
    await assertRpcError(
      createWorkOrder(context, { woStatusCode: undefined }),
      400,
    );
  });

  it("rejects when assetCode is missing", async () => {
    await assertRpcError(
      createWorkOrder(context, { assetCode: undefined }),
      400,
    );
  });

  it("rejects when workOrderType is missing", async () => {
    await assertRpcError(
      createWorkOrder(context, { workOrderType: undefined }),
      400,
    );
  });

  it("rejects when workOrderSubType is missing", async () => {
    await assertRpcError(
      createWorkOrder(context, { workOrderSubType: undefined }),
      400,
    );
  });

  it("rejects when workOrderPriority is missing", async () => {
    await assertRpcError(
      createWorkOrder(context, { workOrderPriority: undefined }),
      400,
    );
  });

  it("rejects when enableOracleWorkOrder is missing", async () => {
    await assertRpcError(
      createWorkOrder(context, { enableOracleWorkOrder: undefined }),
      400,
    );
  });

  // ==================== INVALID VALUE VALIDATIONS (400) ====================

  it("rejects when workOrderPriority is not 1-4", async () => {
    await assertRpcError(
      createWorkOrder(context, { workOrderPriority: "5" }),
      400,
    );
  });

  it("rejects invalid type/subtype combination: Planned + Emergency", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        workOrderType: "Planned",
        workOrderSubType: "Emergency",
      }),
      400,
    );
  });

  it("rejects when enableOracleWorkOrder is not Y/N", async () => {
    await assertRpcError(
      createWorkOrder(context, { enableOracleWorkOrder: "X" }),
      400,
    );
  });

  it("rejects when operation actualStartDate >= actualCompletionDate", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Bad Dates",
            operationDescription: "Start after completion",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T10:00:00.000Z",
            actualCompletionDate: "2025-11-21T08:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      400,
      "actualStartDate must be before actualCompletionDate",
    );
  });

  it("rejects when operationName < 2 chars", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "A",
            operationDescription: "Too short name",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      400,
      "must be longer than or equal to 2 characters",
    );
  });

  it("rejects when operationDescription > 240 chars", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Long Description",
            operationDescription: "A".repeat(241),
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      400,
      "must be shorter than or equal to 240 characters",
    );
  });

  it("rejects when operationType is not Internal/Supplier", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Bad Type",
            operationDescription: "Invalid type",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "External",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      400,
      "operationType must be one of the following values",
    );
  });

  it("rejects when operationStatus is invalid", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Bad Status",
            operationDescription: "Invalid status",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "INVALID_STATUS",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      400,
      "invalid operationStatus",
    );
  });

  it("rejects when operation has no resources", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "No Resources",
            operationDescription: "Missing resources",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [],
          },
        ],
      }),
      400,
      "must have at least one resource",
    );
  });

  it("rejects when resource plannedHours <= 0", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Bad Hours",
            operationDescription: "Zero planned hours",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 0,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      400,
      "must not be less than 0.0001",
    );
  });

  it("rejects when resource actualHours <= 0", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Bad Hours",
            operationDescription: "Zero actual hours",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 0,
              },
            ],
          },
        ],
      }),
      400,
      "must not be less than 0.0001",
    );
  });

  it("rejects when resourceSequenceNumber < 0", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Bad Seq",
            operationDescription: "Negative sequence",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: -1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      400,
      "must not be less than 0",
    );
  });

  it("rejects duplicate operationSeqNumber", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Op 1",
            operationDescription: "First",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
          {
            operationName: "Op 2",
            operationDescription: "Second",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T11:00:00.000Z",
            actualCompletionDate: "2025-11-21T14:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 3,
                actualHours: 3,
              },
            ],
          },
        ],
      }),
      400,
      "Duplicate operationSeqNumber",
    );
  });

  it("rejects operations out of chronological order", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Op 1",
            operationDescription: "First",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T12:00:00.000Z",
            actualCompletionDate: "2025-11-21T14:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
          {
            operationName: "Op 2",
            operationDescription: "Second",
            operationSeqNumber: 20,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      400,
      "starts before operation with seqNumber",
    );
  });

  it("rejects status incompatibility: UNRELEASED WO + RELEASED operation", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Bad Status Combo",
            operationDescription: "Incompatible status",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "RELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      400,
      "not compatible with work order status",
    );
  });

  it("rejects when operationSubType != workOrderSubType", async () => {
    await assertRpcError(
      createWorkOrder(context, {
        operations: [
          {
            operationName: "Mismatch SubType",
            operationDescription: "Wrong subtype",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Corrective",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      400,
      "does not match workOrderSubType",
    );
  });

  // ==================== ASSET VALIDATIONS (404) ====================

  it("rejects when asset not found", async () => {
    await assertRpcError(
      createWorkOrder(context, { assetCode: "NONEXISTENT_ASSET" }),
      404,
      "Asset not found or inactive",
    );
  });

  it("rejects when asset is inactive", async () => {
    await assertRpcError(
      createWorkOrder(context, { assetCode: "E2E_WR_AST_003_INACTIVE" }),
      404,
      "Asset not found or inactive",
    );
  });

  // ==================== PERMISSION VALIDATIONS (403) ====================

  it("rejects when organization mismatch", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.create", {
        ...defaultWoPayload(context),
        assetCode: "E2E_WO_AST_OTHER_ORG",
        organizationCode: context.organizationCode,
      }),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });

  it("rejects when role not authorized for subType: TECHNICIAN_MAINTENANCE_01 + Preventive", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.create", {
        ...defaultWoPayload(context),
        userRoles: ["TECHNICIAN_MAINTENANCE_01"],
        workOrderSubType: "Preventive",
        operations: [
          {
            operationName: "Preventive Op",
            operationDescription: "Technician not allowed for preventive",
            operationSeqNumber: 10,
            createdBy: context.actor.id,
            operationStatus: "UNRELEASED",
            operationType: "Internal",
            operationSubType: "Preventive",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
            workOrderOperationResource: [
              {
                principalFlag: "Y",
                resourceCode: RES_001,
                resourceSequenceNumber: 1,
                plannedHours: 2,
                actualHours: 2,
              },
            ],
          },
        ],
      }),
      403,
      "SUBTYPE_NOT_ALLOWED_FOR_ROLE",
    );
  });

  it("allows when role is authorized: ADMIN + any subType", async () => {
    const response = await sendPattern(context.client, "work.order.create", {
      ...defaultWoPayload(context),
      userRoles: ["ADMIN"],
      workOrderSubType: "TPM",
      operations: [
        {
          operationName: "TPM Op",
          operationDescription: "Admin can create TPM",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "TPM",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: RES_001,
              resourceSequenceNumber: 1,
              plannedHours: 2,
              actualHours: 2,
            },
          ],
        },
      ],
    });

    expect(response.workOrder).toBeDefined();
    expect(response.workOrder.workOrderSubType).toBe("TPM");
  });
});
