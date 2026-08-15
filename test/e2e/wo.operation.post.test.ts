import {
  assertRpcError,
  createWorkOrder,
  createOperation,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/wo-operations-e2e-context";
import { RES_001, RES_002 } from "./support/wo-operations-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Operation Create POST (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let parentWo: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
    parentWo = await createWorkOrder(context, {
      workOrderDescription: "Parent WO for operation create",
      workOrderSubType: "Preventive",
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  // ==================== HAPPY PATH ====================

  it("creates an operation within an existing Work Order", async () => {
    const response = await createOperation(context, parentWo.workOrder.workOrderCode);

    expect(response.operation).toBeDefined();
    expect(response.operation.operationCode).toBeDefined();
    expect(response.operation.operationName).toBe("Operation E2E");
    expect(response.operation.operationSeqNumber).toBe(20);
    expect(response.operation.operationStatus).toBe("UNRELEASED");
    expect(response.operation.operationType).toBe("Internal");
    expect(response.operation.operationSubType).toBe("Preventive");
    expect(response.operation.operationCode).toBeDefined();
    expect(response.operation.hrUsages).toHaveLength(1);
  });

  it("creates an operation with resource code derived from the child WO", async () => {
    const response = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "Second operation",
      operationSeqNumber: 30,
    });

    expect(response.operation.operationName).toBe("Second operation");
    expect(response.operation.operationCode).toBeDefined();
  });

  // ==================== CALCULATIONS ====================

  it("calculates operation actualHours as SUM of resources", async () => {
    const response = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "Sum Hours",
      operationSeqNumber: 40,
      resources: [
        {
          resourceCode: RES_001,
          resourceSequenceNumber: 1,
          actualHours: 2,
          principalFlag: "Y",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
        },
        {
          resourceCode: RES_002,
          resourceSequenceNumber: 2,
          actualHours: 3,
          principalFlag: "N",
          actualStartDate: "2025-11-21T09:00:00.000Z",
          actualCompletionDate: "2025-11-21T12:00:00.000Z",
        },
      ],
    });

    const op = response.operation;
    expect(op.actualHours).toBe(5);
    expect(new Date(op.actualStartDate).toISOString()).toBe("2025-11-21T08:00:00.000Z");
    expect(new Date(op.actualCompletionDate).toISOString()).toBe("2025-11-21T12:00:00.000Z");
    expect(op.hrUsages).toHaveLength(2);
    for (const hr of op.hrUsages) {
      expect(hr.status).toBe("ACTIVE");
    }
  });

  it("creates all resources with status ACTIVE", async () => {
    const response = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "Active Resources",
      operationSeqNumber: 50,
      resources: [
        {
          resourceCode: RES_001,
          resourceSequenceNumber: 1,
          actualHours: 2,
          principalFlag: "Y",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
        },
        {
          resourceCode: RES_002,
          resourceSequenceNumber: 2,
          actualHours: 4,
          principalFlag: "N",
          actualStartDate: "2025-11-21T10:00:00.000Z",
          actualCompletionDate: "2025-11-21T12:00:00.000Z",
        },
      ],
    });

    expect(response.operation.actualHours).toBe(6);
    for (const hr of response.operation.hrUsages) {
      expect(hr.status).toBe("ACTIVE");
    }
  });

  // ==================== VALIDATIONS (400) ====================

  it("rejects when operationSeqNumber already exists in the same WO", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 20,
      }),
      400,
      "already exists",
    );
  });

  it("rejects when operationStatus is incompatible with WO status", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 90,
        operationStatus: "RELEASED",
      }),
      400,
      "not compatible",
    );
  });

  it("rejects an unknown operationStatus value", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 91,
        operationStatus: "INVALID_STATUS",
      }),
      400,
      "not compatible",
    );
  });

  it("rejects when operationName is less than 2 characters", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 92,
        operationName: "A",
      }),
      400,
      "at least 2 characters",
    );
  });

  it("rejects when resources is missing", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 93,
        resources: undefined,
      }),
      400,
      "at least one resource",
    );
  });

  it("rejects when resources is empty", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 94,
        resources: [],
      }),
      400,
      "at least one resource",
    );
  });

  it("rejects when a resource has actualHours <= 0", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 95,
        resources: [
          {
            resourceCode: RES_001,
            resourceSequenceNumber: 1,
            actualHours: 0,
            principalFlag: "Y",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
          },
        ],
      }),
      400,
      "actualHours must be greater than 0",
    );
  });

  it("rejects when a resource has actualStartDate >= actualCompletionDate", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 96,
        resources: [
          {
            resourceCode: RES_001,
            resourceSequenceNumber: 1,
            actualHours: 2,
            principalFlag: "Y",
            actualStartDate: "2025-11-21T10:00:00.000Z",
            actualCompletionDate: "2025-11-21T08:00:00.000Z",
          },
        ],
      }),
      400,
      "actualStartDate must be before actualCompletionDate",
    );
  });

  it("rejects when a resource has invalid resourceSequenceNumber", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 97,
        resources: [
          {
            resourceCode: RES_001,
            resourceSequenceNumber: -1,
            actualHours: 2,
            principalFlag: "Y",
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
          },
        ],
      }),
      400,
      "non-negative integer",
    );
  });

  it("rejects when a resource has no dates", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 98,
        resources: [
          {
            resourceCode: RES_001,
            resourceSequenceNumber: 1,
            actualHours: 2,
            principalFlag: "Y",
          },
        ],
      }),
      400,
      "must have actualStartDate and actualCompletionDate",
    );
  });

  it("rejects when operation has invalid ISO dates", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 99,
        actualStartDate: "not-a-date",
      }),
      400,
      "invalid ISO 8601",
    );
  });

  // ==================== 404 VALIDATIONS ====================

  it("rejects when parent Work Order does not exist", async () => {
    await assertRpcError(
      createOperation(context, "999999"),
      404,
      "Work order not found",
    );
  });

  it("rejects when asset does not exist", async () => {
    await assertRpcError(
      createOperation(context, parentWo.workOrder.workOrderCode, {
        operationSeqNumber: 100,
        assetCode: "NONEXISTENT",
      }),
      404,
      "Asset not found or inactive",
    );
  });
});