import {
  assertRpcError,
  cancelWorkOrder,
  createWorkOrder,
  sendPattern,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/work-order-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WO Cancel (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  async function releaseWorkOrder(workOrderCode: string | number) {
    await sendPattern(context.client, "work.order.release", {
      workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });
  }

  it("cancels WO from UNRELEASED -> CANCELED, all operations CANCELED", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel E2E WO",
      workOrderSubType: "Preventive",
    });

    const response = await cancelWorkOrder(
      context,
      cancelWo.workOrder.workOrderCode,
      { canceledReason: "No longer needed" },
    );

    expect(response.workOrder.woStatusCode).toBe("CANCELED");
    expect(response.workOrder.canceledDate).toBeDefined();
    expect(response.workOrder.canceledReason).toBe("No longer needed");
    for (const op of response.workOrder.operations) {
      expect(op.operationStatus).toBe("CANCELED");
    }
  });

  it("cancels WO from RELEASED -> CANCELED", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel Released E2E WO",
      workOrderSubType: "Preventive",
    });

    await releaseWorkOrder(cancelWo.workOrder.workOrderCode);

    const response = await cancelWorkOrder(
      context,
      cancelWo.workOrder.workOrderCode,
      { canceledReason: "Priority changed" },
    );

    expect(response.workOrder.woStatusCode).toBe("CANCELED");
    expect(response.workOrder.canceledReason).toBe("Priority changed");
  });

  it("cancels WO from ON_HOLD -> CANCELED", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel On Hold E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = cancelWo.workOrder.workOrderCode;
    await sendPattern(context.client, "work.order.hold", {
      workOrderCode: code,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    const response = await cancelWorkOrder(context, code, {
      canceledReason: "Held then canceled",
    });

    expect(response.workOrder.woStatusCode).toBe("CANCELED");
  });

  it("rejects cancel without canceledReason -> 400", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel No Reason E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      cancelWorkOrder(context, cancelWo.workOrder.workOrderCode, {
        canceledReason: "",
      }),
      400,
      "canceledReason is required",
    );
  });

  it("rejects cancel with canceledReason > 240 chars -> 400", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel Long Reason E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      cancelWorkOrder(context, cancelWo.workOrder.workOrderCode, {
        canceledReason: "A".repeat(241),
      }),
      400,
      "must not exceed 240 characters",
    );
  });

  it("rejects cancel without mnt.work.orders.cancel permission -> 403 MISSING_PERMISSION", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel No Permission E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.cancel", {
        workOrderCode: cancelWo.workOrder.workOrderCode,
        organizationCode: context.organizationCode,
        userPermissions: [],
        userRoles: context.userRoles,
        actorId: context.actor.id,
        actorName: context.actor.username,
        canceledReason: "Should fail",
      }),
      403,
      "MISSING_PERMISSION",
    );
  });

  it("rejects cancel from CLOSED (terminal) -> 400", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel Closed E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = cancelWo.workOrder.workOrderCode;
    await releaseWorkOrder(code);
    await sendPattern(context.client, "work.order.complete", {
      workOrderCode: code,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });
    await sendPattern(context.client, "work.order.close", {
      workOrderCode: code,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    await assertRpcError(
      cancelWorkOrder(context, code, { canceledReason: "Too late" }),
      400,
      "Cannot cancel",
    );
  });

  it("rejects cancel from CANCELED (terminal) -> 400", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel Twice E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = cancelWo.workOrder.workOrderCode;
    await cancelWorkOrder(context, code, { canceledReason: "First time" });

    await assertRpcError(
      cancelWorkOrder(context, code, { canceledReason: "Second time" }),
      400,
      "Cannot cancel",
    );
  });

  it("rejects cancel when WO does not exist -> 404", async () => {
    await assertRpcError(
      cancelWorkOrder(context, "999999", { canceledReason: "Not found" }),
      404,
      "Work order not found",
    );
  });

  it("rejects cancel with different organization -> 403 ORGANIZATION_MISMATCH", async () => {
    const tenantWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel Tenant E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.cancel", {
        workOrderCode: tenantWo.workOrder.workOrderCode,
        organizationCode: "OTHER-ORG",
        userPermissions: ["mnt.work.orders.cancel"],
        userRoles: context.userRoles,
        actorId: context.actor.id,
        actorName: context.actor.username,
        canceledReason: "Should fail",
      }),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });
});
