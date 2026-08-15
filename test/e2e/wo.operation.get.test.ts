import {
  assertRpcError,
  createWorkOrder,
  createOperation,
  findOperation,
  findOperations,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/wo-operations-e2e-context";
import { RES_002 } from "./support/wo-operations-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Operation GET (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let parentWo: any;
  let opOne: any;
  let opTwo: any;
  let opAsset: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
    parentWo = await createWorkOrder(context, {
      workOrderDescription: "Parent WO for operation get",
      workOrderSubType: "Preventive",
    });

    opOne = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "GET Operation One",
      operationSeqNumber: 20,
    });

    opTwo = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "GET Operation Two",
      operationSeqNumber: 30,
      resources: [
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

    opAsset = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "GET Operation Asset",
      operationSeqNumber: 40,
      assetCode: "AST-001",
      resources: [
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
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  // ==================== FIND ONE ====================

  it("returns a single operation by operationCode", async () => {
    const response = await findOperation(context, opOne.operation.operationCode);

    expect(response.operation).toBeDefined();
    expect(response.operation.operationName).toBe("GET Operation One");
    expect(response.operation.operationSeqNumber).toBe(20);
  });

  it("returns 404 when operation does not exist", async () => {
    await assertRpcError(
      findOperation(context, "999999"),
      404,
      "Operation not found",
    );
  });

  // ==================== FIND ALL ====================

  it("returns operations filtered by workOrderCode", async () => {
    const response = await findOperations(context, {
      workOrderCode: parentWo.workOrder.workOrderCode,
    });

    expect(response.total).toBeGreaterThanOrEqual(3);
    for (const op of response.operations) {
      expect(op.workOrderCode.toString()).toBe(
        parentWo.workOrder.workOrderCode,
      );
    }
  });

  it("returns operations ordered by operationSeqNumber ASC", async () => {
    const response = await findOperations(context, {
      workOrderCode: parentWo.workOrder.workOrderCode,
    });

    const seqs = response.operations.map((op: any) => op.operationSeqNumber);
    const sorted = [...seqs].sort((a, b) => a - b);
    expect(seqs).toEqual(sorted);
  });

  it("filters operations by operationStatus", async () => {
    const response = await findOperations(context, {
      workOrderCode: parentWo.workOrder.workOrderCode,
      operationStatus: "UNRELEASED",
    });

    expect(response.total).toBeGreaterThanOrEqual(3);
    for (const op of response.operations) {
      expect(op.operationStatus).toBe("UNRELEASED");
    }
  });

  it("filters operations by assetCode with like", async () => {
    const response = await findOperations(context, {
      assetCode: "AST-001",
    });

    expect(response.total).toBeGreaterThanOrEqual(1);
    for (const op of response.operations) {
      expect(op.assetCode).toBe("AST-001");
    }
  });
});