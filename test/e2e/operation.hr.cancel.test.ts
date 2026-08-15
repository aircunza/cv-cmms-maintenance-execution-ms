import {
  assertRpcError,
  createWorkOrder,
  createOperation,
  createHrUsage,
  cancelHrUsage,
  findHrUsages,
  findOperations,
  findWorkOrder,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/wo-operations-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Operation HR Usage Cancel (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let parentWo: any;
  let parentOp: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
    parentWo = await createWorkOrder(context, {
      workOrderDescription: "Parent WO for HR cancel",
      workOrderSubType: "Preventive",
    });

    parentOp = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Cancel Operation",
      operationSeqNumber: 20,
      resources: [
        {
          resourceCode: "RES-001",
          resourceSequenceNumber: 1,
          actualHours: 2,
          principalFlag: "Y",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
        },
      ],
    });

    await createHrUsage(context, parentOp.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 3,
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  async function cancelFirstResource(): Promise<any> {
    const usages = await findHrUsages(context, {
      operationCode: parentOp.operation.operationCode,
    });
    const toCancel = usages.hrUsages.find(
      (hr: any) => hr.resourceCode === "RES-002",
    );
    return cancelHrUsage(context, parentOp.operation.operationCode, toCancel.id, {
      canceledReason: "Canceled by test",
    });
  }

  // ==================== HAPPY PATH ====================

  it("cancels a human resource usage (soft delete)", async () => {
    const response = await cancelFirstResource();

    expect(response.hrUsage).toBeDefined();
    expect(response.hrUsage.status).toBe("CANCELED");
    expect(response.hrUsage.canceledReason).toBe("Canceled by test");
  });

  it("excludes canceled resource from calculations", async () => {
    const op = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Cancel Calc",
      operationSeqNumber: 30,
      resources: [
        {
          resourceCode: "RES-001",
          resourceSequenceNumber: 1,
          actualHours: 5,
          principalFlag: "Y",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
        },
      ],
    });

    const extra = await createHrUsage(context, op.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 3,
    });

    await cancelHrUsage(context, op.operation.operationCode, extra.hrUsage.id, {
      canceledReason: "Calc test",
    });

    const afterOps = await findOperations(context, {
      workOrderCode: parentWo.workOrder.workOrderCode,
      operationStatus: "UNRELEASED",
    });
    const updatedOp = afterOps.operations.find(
      (o: any) => o.operationCode.toString() === op.operation.operationCode.toString(),
    );
    expect(updatedOp.actualHours).toBe(5);
  });

  it("propagates recalculation to the parent Work Order", async () => {
    const beforeWo = await findWorkOrder(context, parentWo.workOrder.workOrderCode);

    const op = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Cancel WO Recalc",
      operationSeqNumber: 40,
      resources: [
        {
          resourceCode: "RES-001",
          resourceSequenceNumber: 1,
          actualHours: 4,
          principalFlag: "Y",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
        },
      ],
    });

    const extra = await createHrUsage(context, op.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 2,
    });

    await cancelHrUsage(context, op.operation.operationCode, extra.hrUsage.id, {
      canceledReason: "WO recalc",
    });

    const afterWo = await findWorkOrder(context, parentWo.workOrder.workOrderCode);
    expect(afterWo.workOrder.actualHours).toBeGreaterThan(
      beforeWo.workOrder.actualHours,
    );
  });

  // ==================== VALIDATIONS (400 / 404) ====================

  it("rejects canceling the last active resource of an operation", async () => {
    const op = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Last Active",
      operationSeqNumber: 50,
      resources: [
        {
          resourceCode: "RES-001",
          resourceSequenceNumber: 1,
          actualHours: 2,
          principalFlag: "Y",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
        },
      ],
    });

    const usage = await createHrUsage(context, op.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 3,
    });

    await cancelHrUsage(context, op.operation.operationCode, usage.hrUsage.id, {
      canceledReason: "Cancel extra",
    });

    const remaining = await findHrUsages(context, {
      operationCode: op.operation.operationCode,
    });
    const last = remaining.hrUsages[0];

    await assertRpcError(
      cancelHrUsage(context, op.operation.operationCode, last.id, {
        canceledReason: "Should fail",
      }),
      400,
      "Cannot cancel the last active resource",
    );
  });

  it("rejects cancel without canceledReason", async () => {
    const usages = await findHrUsages(context, {
      operationCode: parentOp.operation.operationCode,
    });
    const toCancel = usages.hrUsages.find(
      (hr: any) => hr.resourceCode === "RES-001",
    );

    await assertRpcError(
      cancelHrUsage(context, parentOp.operation.operationCode, toCancel.id, {
        canceledReason: "",
      }),
      400,
      "canceledReason is required",
    );
  });

  it("rejects cancel with canceledReason > 240 chars", async () => {
    const usages = await findHrUsages(context, {
      operationCode: parentOp.operation.operationCode,
    });
    const toCancel = usages.hrUsages.find(
      (hr: any) => hr.resourceCode === "RES-001",
    );

    await assertRpcError(
      cancelHrUsage(context, parentOp.operation.operationCode, toCancel.id, {
        canceledReason: "A".repeat(241),
      }),
      400,
      "must not exceed 240 characters",
    );
  });

  it("rejects cancel when HR usage does not exist", async () => {
    await assertRpcError(
      cancelHrUsage(context, parentOp.operation.operationCode, "999999", {
        canceledReason: "Not found",
      }),
      404,
      "HR usage not found",
    );
  });

  it("rejects cancel when resource is already CANCELED", async () => {
    const op = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Double Cancel",
      operationSeqNumber: 60,
      resources: [
        {
          resourceCode: "RES-001",
          resourceSequenceNumber: 1,
          actualHours: 2,
          principalFlag: "Y",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
        },
      ],
    });

    const usage = await createHrUsage(context, op.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 3,
    });

    await cancelHrUsage(context, op.operation.operationCode, usage.hrUsage.id, {
      canceledReason: "First cancel",
    });

    await assertRpcError(
      cancelHrUsage(context, op.operation.operationCode, usage.hrUsage.id, {
        canceledReason: "Second cancel",
      }),
      400,
      "already canceled",
    );
  });
});