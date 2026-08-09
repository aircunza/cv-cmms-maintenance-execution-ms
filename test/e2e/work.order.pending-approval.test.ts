import {
  assertRpcError,
  createWorkOrder,
  sendPattern,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/work-order-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WO Pending Approval (e2e, NATS)", () => {
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

  it("transitions WO from PENDING_APPROVAL -> UNRELEASED", async () => {
    const paWo = await createWorkOrder(context, {
      workOrderDescription: "Pending Approval E2E WO",
      workOrderSubType: "Preventive",
      woStatusCode: "PENDING_APPROVAL",
    });

    const response = await sendPattern(
      context.client,
      "work.order.pending-approval",
      transitionPayload(paWo.workOrder.workOrderCode),
    );

    expect(response.workOrder.woStatusCode).toBe("UNRELEASED");
  });

  it("rejects pending-approval from UNRELEASED -> 400", async () => {
    const paWo = await createWorkOrder(context, {
      workOrderDescription: "PA Wrong Status E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.pending-approval",
        transitionPayload(paWo.workOrder.workOrderCode),
      ),
      400,
      "PENDING_APPROVAL",
    );
  });

  it("rejects pending-approval from RELEASED -> 400", async () => {
    const paWo = await createWorkOrder(context, {
      workOrderDescription: "PA Released E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = paWo.workOrder.workOrderCode;
    await sendPattern(
      context.client,
      "work.order.release",
      transitionPayload(code),
    );

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.pending-approval",
        transitionPayload(code),
      ),
      400,
      "PENDING_APPROVAL",
    );
  });

  it("rejects pending-approval from CANCELED (terminal) -> 400", async () => {
    const paWo = await createWorkOrder(context, {
      workOrderDescription: "PA Canceled E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = paWo.workOrder.workOrderCode;
    await sendPattern(context.client, "work.order.cancel", {
      ...transitionPayload(code),
      userPermissions: ["mnt.work.orders.cancel"],
      canceledReason: "Cancel then pending approval",
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.pending-approval",
        transitionPayload(code),
      ),
      400,
      "PENDING_APPROVAL",
    );
  });

  it("rejects pending-approval when WO does not exist -> 404", async () => {
    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.pending-approval",
        transitionPayload("999999"),
      ),
      404,
      "Work order not found",
    );
  });

  it("rejects pending-approval with different organization -> 403 ORGANIZATION_MISMATCH", async () => {
    const tenantWo = await createWorkOrder(context, {
      workOrderDescription: "PA Tenant E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.pending-approval",
        transitionPayload(tenantWo.workOrder.workOrderCode, "OTHER-ORG"),
      ),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });
});
