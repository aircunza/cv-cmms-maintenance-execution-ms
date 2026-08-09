import {
  assertRpcError,
  createWorkOrder,
  sendPattern,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/work-order-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WO Hold (e2e, NATS)", () => {
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

  it("puts WO on hold from UNRELEASED -> ON_HOLD", async () => {
    const holdWo = await createWorkOrder(context, {
      workOrderDescription: "Hold E2E WO",
      workOrderSubType: "Preventive",
    });

    const response = await sendPattern(
      context.client,
      "work.order.hold",
      transitionPayload(holdWo.workOrder.workOrderCode),
    );

    expect(response.workOrder.woStatusCode).toBe("ON_HOLD");
  });

  it("puts WO on hold from RELEASED -> ON_HOLD", async () => {
    const holdWo = await createWorkOrder(context, {
      workOrderDescription: "Hold Released E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = holdWo.workOrder.workOrderCode;
    await sendPattern(
      context.client,
      "work.order.release",
      transitionPayload(code),
    );

    const response = await sendPattern(
      context.client,
      "work.order.hold",
      transitionPayload(code),
    );

    expect(response.workOrder.woStatusCode).toBe("ON_HOLD");
  });

  it("rejects hold from CANCELED (terminal) -> 400", async () => {
    const canceledWo = await createWorkOrder(context, {
      workOrderDescription: "Hold Canceled E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = canceledWo.workOrder.workOrderCode;
    await sendPattern(context.client, "work.order.cancel", {
      ...transitionPayload(code),
      userPermissions: ["mnt.work.orders.cancel"],
      canceledReason: "Cancel then hold",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.hold", transitionPayload(code)),
      400,
      "Cannot put work order on hold",
    );
  });

  it("rejects hold from COMPLETED -> 400", async () => {
    const completeWo = await createWorkOrder(context, {
      workOrderDescription: "Hold Completed E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = completeWo.workOrder.workOrderCode;
    await sendPattern(
      context.client,
      "work.order.release",
      transitionPayload(code),
    );
    await sendPattern(
      context.client,
      "work.order.complete",
      transitionPayload(code),
    );

    await assertRpcError(
      sendPattern(context.client, "work.order.hold", transitionPayload(code)),
      400,
      "Cannot put work order on hold",
    );
  });

  it("rejects hold when WO does not exist -> 404", async () => {
    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.hold",
        transitionPayload("999999"),
      ),
      404,
      "Work order not found",
    );
  });

  it("rejects hold with different organization -> 403 ORGANIZATION_MISMATCH", async () => {
    const tenantWo = await createWorkOrder(context, {
      workOrderDescription: "Hold Tenant E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.hold",
        transitionPayload(tenantWo.workOrder.workOrderCode, "OTHER-ORG"),
      ),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });
});
