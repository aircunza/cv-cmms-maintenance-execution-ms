import {
  assertRpcError,
  cancelOperation,
  createWorkOrder,
  createOperation,
  findOperation,
  releaseWorkOrder,
  updateOperation,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/wo-operations-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Operation Update PUT (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let parentWo: any;
  let operation: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
    parentWo = await createWorkOrder(context, {
      workOrderDescription: "Parent WO for operation update",
      workOrderSubType: "Preventive",
    });

    operation = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "Update Target",
      operationSeqNumber: 20,
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  // ==================== HAPPY PATH ====================

  it("updates operationName only", async () => {
    const response = await updateOperation(context, operation.operation.operationCode, {
      operationName: "Updated Name",
    });

    expect(response.operation).toBeDefined();
    expect(response.operation.operationName).toBe("Updated Name");
    expect(response.operation.operationCode).toBe(
      operation.operation.operationCode,
    );
  });

  it("updates operationDescription", async () => {
    const response = await updateOperation(context, operation.operation.operationCode, {
      operationDescription: "Updated description",
    });

    expect(response.operation.operationDescription).toBe("Updated description");
  });

  it("updates multiple fields at once", async () => {
    const response = await updateOperation(context, operation.operation.operationCode, {
      operationName: "Multi Updated",
      operationDescription: "Multi description",
      operationType: "Supplier",
    });

    expect(response.operation.operationName).toBe("Multi Updated");
    expect(response.operation.operationDescription).toBe("Multi description");
    expect(response.operation.operationType).toBe("Supplier");
  });

  it("does not modify fields not sent (partial update)", async () => {
    const before = await findOperation(context, operation.operation.operationCode);

    await updateOperation(context, operation.operation.operationCode, {
      operationName: "Partial update",
    });

    const after = await findOperation(context, operation.operation.operationCode);

    expect(after.operation.operationName).toBe("Partial update");
    expect(after.operation.operationDescription).toBe(
      before.operation.operationDescription,
    );
  });

  it("updates operationStatus to a compatible value when WO is RELEASED", async () => {
    const releasedWo = await createWorkOrder(context, {
      workOrderDescription: "WO for status update",
      workOrderSubType: "Preventive",
    });

    await releaseWorkOrder(context, releasedWo.workOrder.workOrderCode);

    const releasedOp = await createOperation(context, releasedWo.workOrder.workOrderCode, {
      operationName: "Released op",
      operationSeqNumber: 20,
      operationStatus: "RELEASED",
    });

    const response = await updateOperation(context, releasedOp.operation.operationCode, {
      operationStatus: "IN_PROCESS",
    });

    expect(response.operation.operationStatus).toBe("IN_PROCESS");
  });

  it("sets updatedBy, updatedByName, updatedAt", async () => {
    const response = await updateOperation(context, operation.operation.operationCode, {
      operationName: "Audit update",
    });

    expect(response.operation.updatedBy).toBe(context.actor.id);
    expect(response.operation.updatedByName).toBe(context.actor.username);
    expect(response.operation.updatedAt).toBeDefined();
  });

  // ==================== VALIDATIONS (400 / 404) ====================

  it("rejects when operation does not exist", async () => {
    await assertRpcError(
      updateOperation(context, "999999", { operationName: "Not found" }),
      404,
      "Operation not found",
    );
  });

  it("rejects attempting to update a calculated field actualHours", async () => {
    await assertRpcError(
      updateOperation(context, operation.operation.operationCode, {
        actualHours: 5,
      }),
      400,
      "calculated field",
    );
  });

  it("rejects attempting to update a calculated field actualStartDate", async () => {
    await assertRpcError(
      updateOperation(context, operation.operation.operationCode, {
        actualStartDate: "2025-11-21T08:00:00.000Z",
      }),
      400,
      "calculated field",
    );
  });

  it("rejects attempting to update a calculated field actualCompletionDate", async () => {
    await assertRpcError(
      updateOperation(context, operation.operation.operationCode, {
        actualCompletionDate: "2025-11-21T10:00:00.000Z",
      }),
      400,
      "calculated field",
    );
  });

  it("rejects operationStatus incompatible with WO status", async () => {
    await assertRpcError(
      updateOperation(context, operation.operation.operationCode, {
        operationStatus: "RELEASED",
      }),
      400,
      "not compatible",
    );
  });

  it("rejects updating a CANCELED operation", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "WO for canceled op update",
      workOrderSubType: "Preventive",
    });
    const opA = await createOperation(context, cancelWo.workOrder.workOrderCode, {
      operationName: "Op A",
      operationSeqNumber: 20,
    });
    const opB = await createOperation(context, cancelWo.workOrder.workOrderCode, {
      operationName: "Op B",
      operationSeqNumber: 30,
    });

    await cancelOperation(context, cancelWo.workOrder.workOrderCode, opA.operation.operationCode, {
      canceledReason: "Cancel to test update rejection",
    });

    await assertRpcError(
      updateOperation(context, opA.operation.operationCode, {
        operationName: "Should fail",
      }),
      400,
      "Cannot update a canceled operation",
    );
  });
});