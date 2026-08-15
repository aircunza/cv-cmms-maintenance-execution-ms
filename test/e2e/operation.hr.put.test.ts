import {
  assertRpcError,
  cancelHrUsage,
  createWorkOrder,
  createOperation,
  createHrUsage,
  findOperations,
  findWorkOrder,
  updateHrUsage,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/wo-operations-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Operation HR Usage Update PUT (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let parentWo: any;
  let parentOp: any;
  let hrOne: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
    parentWo = await createWorkOrder(context, {
      workOrderDescription: "Parent WO for HR update",
      workOrderSubType: "Preventive",
    });

    parentOp = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Update Operation",
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

    hrOne = await createHrUsage(context, parentOp.operation.operationCode, {
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

  // ==================== HAPPY PATH ====================

  it("updates actualHours", async () => {
    const response = await updateHrUsage(context, hrOne.hrUsage.id, {
      actualHours: 8,
    });

    expect(response.hrUsage).toBeDefined();
    expect(response.hrUsage.id).toBe(hrOne.hrUsage.id);
    expect(response.hrUsage.actualHours).toBe(8);
  });

  it("updates hourlyCost and principalFlag", async () => {
    const response = await updateHrUsage(context, hrOne.hrUsage.id, {
      hourlyCost: 45,
      principalFlag: "Y",
    });

    expect(Number(response.hrUsage.hourlyCost)).toBe(45);
    expect(response.hrUsage.principalFlag).toBe("Y");
  });

  it("updates actualStartDate and actualCompletionDate", async () => {
    const response = await updateHrUsage(context, hrOne.hrUsage.id, {
      actualStartDate: "2025-11-21T10:00:00.000Z",
      actualCompletionDate: "2025-11-21T16:00:00.000Z",
    });

    expect(new Date(response.hrUsage.actualStartDate).toISOString()).toBe(
      "2025-11-21T10:00:00.000Z",
    );
    expect(new Date(response.hrUsage.actualCompletionDate).toISOString()).toBe(
      "2025-11-21T16:00:00.000Z",
    );
  });

  it("recalculates parent operation and Work Order when actualHours changes", async () => {
    const op = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Recalc Update",
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

    const extra = await createHrUsage(context, op.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 3,
    });

    const beforeWo = await findWorkOrder(context, parentWo.workOrder.workOrderCode);

    await updateHrUsage(context, extra.hrUsage.id, {
      actualHours: 7,
    });

    const afterOps = await findOperations(context, {
      workOrderCode: parentWo.workOrder.workOrderCode,
      operationStatus: "UNRELEASED",
    });
    const updatedOp = afterOps.operations.find(
      (o: any) => o.operationCode.toString() === op.operation.operationCode.toString(),
    );
    expect(updatedOp.actualHours).toBe(9);

    const afterWo = await findWorkOrder(context, parentWo.workOrder.workOrderCode);
    expect(afterWo.workOrder.actualHours).toBeGreaterThan(
      beforeWo.workOrder.actualHours,
    );
  });

  it("sets updatedBy, updatedByName, updatedAt", async () => {
    const response = await updateHrUsage(context, hrOne.hrUsage.id, {
      actualHours: 5,
    });

    expect(response.hrUsage.updatedBy).toBe(context.actor.id);
    expect(response.hrUsage.updatedByName).toBe(context.actor.username);
    expect(response.hrUsage.updatedAt).toBeDefined();
  });

  // ==================== VALIDATIONS (400 / 404) ====================

  it("rejects when HR usage does not exist", async () => {
    await assertRpcError(
      updateHrUsage(context, "999999", { actualHours: 5 }),
      404,
      "HR usage not found",
    );
  });

  it("rejects when actualHours <= 0", async () => {
    await assertRpcError(
      updateHrUsage(context, hrOne.hrUsage.id, { actualHours: 0 }),
      400,
      "actualHours must be greater than 0",
    );
  });

  it("rejects when both dates make actualStartDate >= actualCompletionDate", async () => {
    await assertRpcError(
      updateHrUsage(context, hrOne.hrUsage.id, {
        actualStartDate: "2025-11-21T12:00:00.000Z",
        actualCompletionDate: "2025-11-21T10:00:00.000Z",
      }),
      400,
      "actualStartDate must be before actualCompletionDate",
    );
  });

  it("rejects updating a CANCELED resource", async () => {
    const op = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Cancel Update",
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

    const hrToCancel = await createHrUsage(context, op.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 3,
    });

    await cancelHrUsage(context, op.operation.operationCode, hrToCancel.hrUsage.id, {
      canceledReason: "Cancel to test update",
    });

    await assertRpcError(
      updateHrUsage(context, hrToCancel.hrUsage.id, { actualHours: 5 }),
      400,
      "Cannot update a canceled resource",
    );
  });
});