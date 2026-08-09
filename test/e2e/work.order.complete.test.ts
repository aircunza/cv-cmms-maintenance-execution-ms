import {
  assertRpcError,
  createWorkOrder,
  sendPattern,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/work-order-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WO Complete (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  function transitionPayload(
    workOrderCode: string | number,
    organizationCode: string = context.organizationCode,
  ) {
    return {
      workOrderCode,
      organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    };
  }

  it("completes WO from RELEASED -> COMPLETED", async () => {
    const completeWo = await createWorkOrder(context, {
      workOrderDescription: "Complete E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = completeWo.workOrder.workOrderCode;
    await sendPattern(
      context.client,
      "work.order.release",
      transitionPayload(code),
    );

    const response = await sendPattern(
      context.client,
      "work.order.complete",
      transitionPayload(code),
    );

    expect(response.workOrder.woStatusCode).toBe("COMPLETED");
  });

  it("rejects complete from UNRELEASED -> 400", async () => {
    const newWo = await createWorkOrder(context, {
      workOrderDescription: "Complete Reject E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.complete",
        transitionPayload(newWo.workOrder.workOrderCode),
      ),
      400,
      "Cannot complete",
    );
  });

  it("rejects complete from ON_HOLD -> 400", async () => {
    const holdWo = await createWorkOrder(context, {
      workOrderDescription: "Complete On Hold E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = holdWo.workOrder.workOrderCode;
    await sendPattern(
      context.client,
      "work.order.hold",
      transitionPayload(code),
    );

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.complete",
        transitionPayload(code),
      ),
      400,
      "Cannot complete",
    );
  });

  it("rejects complete from CANCELED (terminal) -> 400", async () => {
    const canceledWo = await createWorkOrder(context, {
      workOrderDescription: "Complete Canceled E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = canceledWo.workOrder.workOrderCode;
    await sendPattern(context.client, "work.order.cancel", {
      ...transitionPayload(code),
      userPermissions: ["mnt.work.orders.cancel"],
      canceledReason: "Cancel then complete",
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.complete",
        transitionPayload(code),
      ),
      400,
      "Cannot complete",
    );
  });

  it("rejects complete when WO does not exist -> 404", async () => {
    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.complete",
        transitionPayload("999999"),
      ),
      404,
      "Work order not found",
    );
  });

  it("rejects complete with different organization -> 403 ORGANIZATION_MISMATCH", async () => {
    const tenantWo = await createWorkOrder(context, {
      workOrderDescription: "Complete Tenant E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.complete",
        transitionPayload(tenantWo.workOrder.workOrderCode, "OTHER-ORG"),
      ),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });
});
