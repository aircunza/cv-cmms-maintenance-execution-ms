import {
  assertRpcError,
  cancelOperation,
  createWorkOrder,
  createOperation,
  findOperation,
  findWorkOrder,
  releaseWorkOrder,
  updateOperation,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/wo-operations-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Operation Cancel (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  async function buildWoWithTwoOps(): Promise<{ wo: any; opA: any; opB: any }> {
    const wo = await createWorkOrder(context, {
      workOrderDescription: "Cancel E2E WO",
      workOrderSubType: "Preventive",
    });

    const opA = await createOperation(context, wo.workOrder.workOrderCode, {
      operationName: "Cancel Op A",
      operationSeqNumber: 20,
    });

    const opB = await createOperation(context, wo.workOrder.workOrderCode, {
      operationName: "Cancel Op B",
      operationSeqNumber: 30,
    });

    return { wo, opA, opB };
  }

  // ==================== HAPPY PATH ====================

  it("cancels an operation UNRELEASED -> CANCELED", async () => {
    const { wo, opA, opB } = await buildWoWithTwoOps();

    const code = wo.workOrder.workOrderCode;
    const before = await findOperation(context, opA.operation.operationCode);

    const response = await cancelOperation(context, code, opA.operation.operationCode, {
      canceledReason: "No longer needed",
    });

    expect(response.operation.operationStatus).toBe("CANCELED");
    expect(response.operation.operationCode).toBe(opA.operation.operationCode);
    // All resources of the operation are canceled
    for (const hr of response.operation.hrUsages) {
      expect(hr.status).toBe("CANCELED");
    }

    // The remaining operation stays active
    const remaining = await findOperation(context, opB.operation.operationCode);
    expect(remaining.operation.operationStatus).toBe("UNRELEASED");

    // WO must still have at least one active operation (opB)
    const woAfter = await findWorkOrder(context, code);
    expect(woAfter.workOrder.operations.length).toBeGreaterThanOrEqual(1);
  });

  it("recalculates the parent Work Order after cancel", async () => {
    const wo = await createWorkOrder(context, {
      workOrderDescription: "Recalc Cancel WO",
      workOrderSubType: "Preventive",
    });

    // Default op (from WO creation) has 2 hours; add two more ops.
    const op20 = await createOperation(context, wo.workOrder.workOrderCode, {
      operationName: "Recalc Op 20",
      operationSeqNumber: 20,
    });
    await createOperation(context, wo.workOrder.workOrderCode, {
      operationName: "Recalc Op 30",
      operationSeqNumber: 30,
    });

    const code = wo.workOrder.workOrderCode;
    const beforeWo = await findWorkOrder(context, code);
    expect(beforeWo.workOrder.actualHours).toBe(6);

    await cancelOperation(context, code, op20.operation.operationCode, {
      canceledReason: "Recalculate",
    });

    const afterWo = await findWorkOrder(context, code);
    expect(afterWo.workOrder.actualHours).toBe(4);
  });

  it("cancels a RELEASED operation", async () => {
    const wo = await createWorkOrder(context, {
      workOrderDescription: "Release Cancel WO",
      workOrderSubType: "Preventive",
    });

    const opB = await createOperation(context, wo.workOrder.workOrderCode, {
      operationName: "Release Cancel Op B",
      operationSeqNumber: 30,
    });

    const code = wo.workOrder.workOrderCode;
    await releaseWorkOrder(context, code);

    const response = await cancelOperation(context, code, opB.operation.operationCode, {
      canceledReason: "Cancel released",
    });

    expect(response.operation.operationStatus).toBe("CANCELED");
  });

  // ==================== VALIDATIONS (400 / 404) ====================

  it("rejects canceling the last active operation of the WO", async () => {
    const wo = await createWorkOrder(context, {
      workOrderDescription: "Last Active WO",
      workOrderSubType: "Preventive",
    });

    // Only the default operation exists -> cannot cancel it
    const defaultOpCode = wo.workOrder.operations[0].operationCode;

    await assertRpcError(
      cancelOperation(context, wo.workOrder.workOrderCode, defaultOpCode, {
        canceledReason: "Should fail",
      }),
      400,
      "Cannot cancel the last active operation",
    );
  });

  it("rejects cancel without canceledReason", async () => {
    const { wo, opA } = await buildWoWithTwoOps();

    await assertRpcError(
      cancelOperation(context, wo.workOrder.workOrderCode, opA.operation.operationCode, {
        canceledReason: "",
      }),
      400,
      "canceledReason is required",
    );
  });

  it("rejects cancel with canceledReason > 240 chars", async () => {
    const { wo, opA } = await buildWoWithTwoOps();

    await assertRpcError(
      cancelOperation(context, wo.workOrder.workOrderCode, opA.operation.operationCode, {
        canceledReason: "A".repeat(241),
      }),
      400,
      "must not exceed 240 characters",
    );
  });

  it("rejects cancel of an operation with invalid status transition (COMPLETED)", async () => {
    const wo = await createWorkOrder(context, {
      workOrderDescription: "Complete Cancel WO",
      workOrderSubType: "Preventive",
    });

    const opB = await createOperation(context, wo.workOrder.workOrderCode, {
      operationName: "Complete Cancel Op B",
      operationSeqNumber: 30,
    });

    const code = wo.workOrder.workOrderCode;
    await releaseWorkOrder(context, code);

    // Move opB to COMPLETED (allowed while WO is RELEASED)
    await updateOperation(context, opB.operation.operationCode, {
      operationStatus: "COMPLETED",
    });

    await assertRpcError(
      cancelOperation(context, code, opB.operation.operationCode, {
        canceledReason: "Should fail",
      }),
      400,
      "Cannot cancel operation from status",
    );
  });

  it("rejects cancel when operation does not exist", async () => {
    await assertRpcError(
      cancelOperation(context, "999999", "999999", {
        canceledReason: "Not found",
      }),
      404,
      "Operation not found",
    );
  });

  it("rejects cancel when operation is already CANCELED", async () => {
    const { wo, opA } = await buildWoWithTwoOps();

    const code = wo.workOrder.workOrderCode;
    await cancelOperation(context, code, opA.operation.operationCode, {
      canceledReason: "First cancel",
    });

    await assertRpcError(
      cancelOperation(context, code, opA.operation.operationCode, {
        canceledReason: "Second cancel",
      }),
      400,
      "Cannot cancel operation from status",
    );
  });
});