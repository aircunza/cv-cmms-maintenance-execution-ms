import {
  createWorkOrder,
  createOperation,
  createHrUsage,
  cancelHrUsage,
  findHrUsages,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/wo-operations-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Operation HR Usage GET (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let parentWo: any;
  let parentOp: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
    parentWo = await createWorkOrder(context, {
      workOrderDescription: "Parent WO for HR get",
      workOrderSubType: "Preventive",
    });

    parentOp = await createOperation(context, parentWo.workOrder.workOrderCode, {
      operationName: "HR Get Operation",
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

    // Create an additional resource and then cancel it to test includeCanceled.
    const second = await createHrUsage(context, parentOp.operation.operationCode, {
      resourceCode: "RES-002",
      resourceSequenceNumber: 2,
      actualHours: 3,
    });

    await cancelHrUsage(context, parentOp.operation.operationCode, second.hrUsage.id, {
      canceledReason: "Cancel for GET test",
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  it("returns active HR usages by operationCode", async () => {
    const response = await findHrUsages(context, {
      operationCode: parentOp.operation.operationCode,
    });

    expect(response.total).toBe(1);
    expect(response.hrUsages).toHaveLength(1);
    expect(response.hrUsages[0].resourceCode).toBe("RES-001");
    expect(response.hrUsages[0].status).toBe("ACTIVE");
  });

  it("returns all HR usages when includeCanceled = Y", async () => {
    const response = await findHrUsages(context, {
      operationCode: parentOp.operation.operationCode,
      includeCanceled: "Y",
    });

    expect(response.total).toBe(2);
    const statuses = response.hrUsages.map((hr: any) => hr.status).sort();
    expect(statuses).toEqual(["ACTIVE", "CANCELED"]);
  });

  it("orders results by resourceSequenceNumber ASC", async () => {
    const response = await findHrUsages(context, {
      operationCode: parentOp.operation.operationCode,
      includeCanceled: "Y",
    });

    const seqs = response.hrUsages.map((hr: any) => hr.resourceSequenceNumber);
    const sorted = [...seqs].sort((a, b) => a - b);
    expect(seqs).toEqual(sorted);
  });

  it("returns empty result set when no records match", async () => {
    const response = await findHrUsages(context, {
      operationCode: "999999",
    });

    expect(response.hrUsages).toHaveLength(0);
    expect(response.total).toBe(0);
  });
});