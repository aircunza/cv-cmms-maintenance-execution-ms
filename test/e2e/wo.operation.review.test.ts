import {
  assertRpcError,
  createWorkOrder,
  createOperation,
  reviewOperation,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/wo-operations-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Operation Review (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let operation: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();

    const parentWo = await createWorkOrder(context, {
      workOrderDescription: "Parent WO for operation review",
      workOrderSubType: "Preventive",
    });

    operation = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "Review Target",
      operationSeqNumber: 20,
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  it("marks an operation as reviewed with actor and timestamp", async () => {
    const response = await reviewOperation(context, operation.operation.operationCode);

    expect(response.operation).toBeDefined();
    expect(response.operation.reviewedBy).toBe(context.actor.id);
    expect(response.operation.reviewedByName).toBe(context.actor.username);
    expect(response.operation.reviewedAt).toBeDefined();
    expect(response.operation.operationCode).toBe(
      operation.operation.operationCode,
    );
  });

  it("returns 404 when operation does not exist", async () => {
    await assertRpcError(
      reviewOperation(context, "999999"),
      404,
      "Operation not found",
    );
  });
});