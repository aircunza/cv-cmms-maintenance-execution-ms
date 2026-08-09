import {
  assertRpcError,
  createWorkOrder,
  sendPattern,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/work-order-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WO Close (e2e, NATS)", () => {
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

  it("closes WO from COMPLETED -> CLOSED with closedDate", async () => {
    const closeWo = await createWorkOrder(context, {
      workOrderDescription: "Close E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = closeWo.workOrder.workOrderCode;
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

    const response = await sendPattern(
      context.client,
      "work.order.close",
      transitionPayload(code),
    );

    expect(response.workOrder.woStatusCode).toBe("CLOSED");
    expect(response.workOrder.closedDate).toBeDefined();
  });

  it("rejects close from RELEASED -> 400", async () => {
    const newWo = await createWorkOrder(context, {
      workOrderDescription: "Close Reject E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = newWo.workOrder.workOrderCode;
    await sendPattern(
      context.client,
      "work.order.release",
      transitionPayload(code),
    );

    await assertRpcError(
      sendPattern(context.client, "work.order.close", transitionPayload(code)),
      400,
      "Cannot close",
    );
  });

  it("rejects close from UNRELEASED -> 400", async () => {
    const newWo = await createWorkOrder(context, {
      workOrderDescription: "Close Reject Unreleased E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.close",
        transitionPayload(newWo.workOrder.workOrderCode),
      ),
      400,
      "Cannot close",
    );
  });

  it("rejects close from CANCELED (terminal) -> 400", async () => {
    const canceledWo = await createWorkOrder(context, {
      workOrderDescription: "Close Canceled E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = canceledWo.workOrder.workOrderCode;
    await sendPattern(context.client, "work.order.cancel", {
      ...transitionPayload(code),
      userPermissions: ["mnt.work.orders.cancel"],
      canceledReason: "Cancel then close",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.close", transitionPayload(code)),
      400,
      "Cannot close",
    );
  });

  it("rejects close when WO does not exist -> 404", async () => {
    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.close",
        transitionPayload("999999"),
      ),
      404,
      "Work order not found",
    );
  });

  it("rejects close with different organization -> 403 ORGANIZATION_MISMATCH", async () => {
    const tenantWo = await createWorkOrder(context, {
      workOrderDescription: "Close Tenant E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.close",
        transitionPayload(tenantWo.workOrder.workOrderCode, "OTHER-ORG"),
      ),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });
});
