import {
  assertRpcError,
  cancelOperation,
  createWorkOrder,
  createOperation,
  createHrUsage,
  findOperations,
  findWorkOrder,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/wo-operations-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Operation HR Usage Create POST (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let parentWo: any;
  let parentOp: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
    parentWo = await createWorkOrder(context, {
      workOrderDescription: "Parent WO for HR create",
      workOrderSubType: "Preventive",
    });

    parentOp = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Target Operation",
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
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  // ==================== HAPPY PATH ====================

  it("creates a human resource usage within an existing operation", async () => {
    const response = await createHrUsage(
      context,
      parentOp.operation.operationCode,
      {
        resourceCode: "RES-002",
        resourceSequenceNumber: 2,
        actualHours: 3,
      },
    );

    expect(response.hrUsage).toBeDefined();
    expect(response.hrUsage.id).toBeDefined();
    expect(response.hrUsage.resourceCode).toBe("RES-002");
    expect(response.hrUsage.resourceSequenceNumber).toBe(2);
    expect(response.hrUsage.actualHours).toBe(3);
    expect(response.hrUsage.status).toBe("ACTIVE");
    expect(response.hrUsage.organizationCode).toBe(context.organizationCode);
  });

  it("recalculates parent operation actualHours and dates", async () => {
    const op = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Recalc Operation",
      operationSeqNumber: 30,
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

    await createHrUsage(context, op.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 4,
      actualStartDate: "2025-11-21T10:00:00.000Z",
      actualCompletionDate: "2025-11-21T14:00:00.000Z",
    });

    const after = await findOperations(context, {
      workOrderCode: parentWo.workOrder.workOrderCode,
      operationStatus: "UNRELEASED",
    });

    const updated = after.operations.find(
      (o: any) => o.operationCode.toString() === op.operation.operationCode.toString(),
    );

    expect(updated.actualHours).toBe(6);
    expect(new Date(updated.actualStartDate).toISOString()).toBe(
      "2025-11-21T08:00:00.000Z",
    );
    expect(new Date(updated.actualCompletionDate).toISOString()).toBe(
      "2025-11-21T14:00:00.000Z",
    );
  });

  it("propagates recalculation to the parent Work Order", async () => {
    const op = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR WO Recalc Operation",
      operationSeqNumber: 40,
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

    const beforeWo = await findWorkOrder(context, parentWo.workOrder.workOrderCode);

    await createHrUsage(context, op.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 1,
    });

    const afterWo = await findWorkOrder(context, parentWo.workOrder.workOrderCode);

    expect(afterWo.workOrder.actualHours).toBeGreaterThan(
      beforeWo.workOrder.actualHours,
    );
  });

  it("creates multiple resources and sums correctly", async () => {
    const op = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Multi Resource",
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

    await createHrUsage(context, op.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 3,
    });
    await createHrUsage(context, op.operation.operationCode, {
      resourceCode: "RES-003",
      resourceSequenceNumber: 3,
      actualHours: 5,
    });

    const after = await findOperations(context, {
      workOrderCode: parentWo.workOrder.workOrderCode,
      operationStatus: "UNRELEASED",
    });
    const updated = after.operations.find(
      (o: any) =>
        o.operationCode.toString() === op.operation.operationCode.toString(),
    );

    expect(updated.actualHours).toBe(10);
  });

  // ==================== VALIDATIONS (400 / 404) ====================

  it("rejects when parent operation does not exist", async () => {
    await assertRpcError(
      createHrUsage(context, "999999", {
        resourceCode: "RES-002",
        resourceSequenceNumber: 2,
        actualHours: 3,
      }),
      404,
      "Operation not found",
    );
  });

  it("rejects when parent operation is CANCELED", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel HR WO",
      workOrderSubType: "Preventive",
    });

    const opA = await createOperation(context, cancelWo.workOrder.workOrderCode, {
      operationName: "HR Cancel A",
      operationSeqNumber: 20,
    });

    await createOperation(context, cancelWo.workOrder.workOrderCode, {
      operationName: "HR Cancel B",
      operationSeqNumber: 30,
    });

    await cancelOperation(context, cancelWo.workOrder.workOrderCode, opA.operation.operationCode, {
      canceledReason: "Cancel op for HR",
    });

    await assertRpcError(
      createHrUsage(context, opA.operation.operationCode, {
        resourceCode: "RES-002",
        resourceSequenceNumber: 2,
        actualHours: 3,
      }),
      400,
      "Cannot add resource to a canceled operation",
    );
  });

  it("rejects duplicate resourceCode + resourceSequenceNumber in the same operation", async () => {
    const op = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Duplicate",
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

    await assertRpcError(
      createHrUsage(context, op.operation.operationCode, {
        resourceCode: "RES-001",
        resourceSequenceNumber: 1,
        actualHours: 3,
      }),
      400,
      "already exists for this resource",
    );
  });

  it("rejects when actualStartDate >= actualCompletionDate", async () => {
    await assertRpcError(
      createHrUsage(
        context,
        parentOp.operation.operationCode,
        {
          resourceCode: "RES-002",
          resourceSequenceNumber: 9,
          actualHours: 3,
          actualStartDate: "2025-11-21T12:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
        },
      ),
      400,
      "actualStartDate must be before actualCompletionDate",
    );
  });
});