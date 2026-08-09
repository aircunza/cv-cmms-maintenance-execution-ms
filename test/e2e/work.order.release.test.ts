import {
  assertRpcError,
  createWorkOrder,
  sendPattern,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/work-order-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WO Release (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  function releasePayload(
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

  it("releases WO from UNRELEASED -> RELEASED with releasedDate", async () => {
    const releaseWo = await createWorkOrder(context, {
      workOrderDescription: "Release E2E WO",
      workOrderSubType: "Preventive",
    });

    const response = await sendPattern(
      context.client,
      "work.order.release",
      releasePayload(releaseWo.workOrder.workOrderCode),
    );

    expect(response.workOrder.woStatusCode).toBe("RELEASED");
    expect(response.workOrder.releasedDate).toBeDefined();
    expect(response.workOrder.operations).toBeDefined();
    for (const op of response.workOrder.operations) {
      expect(op.operationStatus).toBe("RELEASED");
    }
  });

  it("releases WO from ON_HOLD -> RELEASED", async () => {
    const holdWo = await createWorkOrder(context, {
      workOrderDescription: "Release On Hold E2E WO",
      workOrderSubType: "Preventive",
    });

    await sendPattern(
      context.client,
      "work.order.hold",
      releasePayload(holdWo.workOrder.workOrderCode),
    );

    const response = await sendPattern(
      context.client,
      "work.order.release",
      releasePayload(holdWo.workOrder.workOrderCode),
    );

    expect(response.workOrder.woStatusCode).toBe("RELEASED");
  });

  it("allows release from COMPLETED -> RELEASED (per spec)", async () => {
    const completeWo = await createWorkOrder(context, {
      workOrderDescription: "Complete Then Release E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = completeWo.workOrder.workOrderCode;
    await sendPattern(
      context.client,
      "work.order.release",
      releasePayload(code),
    );
    await sendPattern(
      context.client,
      "work.order.complete",
      releasePayload(code),
    );

    const response = await sendPattern(
      context.client,
      "work.order.release",
      releasePayload(code),
    );

    expect(response.workOrder.woStatusCode).toBe("RELEASED");
  });

  it("rejects release from CLOSED (terminal) -> 400", async () => {
    const closedWo = await createWorkOrder(context, {
      workOrderDescription: "Release Closed E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = closedWo.workOrder.workOrderCode;
    await sendPattern(
      context.client,
      "work.order.release",
      releasePayload(code),
    );
    await sendPattern(
      context.client,
      "work.order.complete",
      releasePayload(code),
    );
    await sendPattern(context.client, "work.order.close", releasePayload(code));

    await assertRpcError(
      sendPattern(context.client, "work.order.release", releasePayload(code)),
      400,
      "Cannot release",
    );
  });

  it("rejects release from CANCELED (terminal) -> 400", async () => {
    const canceledWo = await createWorkOrder(context, {
      workOrderDescription: "Release Canceled E2E WO",
      workOrderSubType: "Preventive",
    });

    const code = canceledWo.workOrder.workOrderCode;
    await sendPattern(context.client, "work.order.cancel", {
      ...releasePayload(code),
      userPermissions: ["mnt.work.orders.cancel"],
      canceledReason: "Cancel then release",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.release", releasePayload(code)),
      400,
      "Cannot release",
    );
  });

  it("rejects release when WO does not exist -> 404", async () => {
    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.release",
        releasePayload("999999"),
      ),
      404,
      "Work order not found",
    );
  });

  it("rejects release with different organization -> 403 ORGANIZATION_MISMATCH", async () => {
    const tenantWo = await createWorkOrder(context, {
      workOrderDescription: "Release Tenant E2E WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.order.release",
        releasePayload(tenantWo.workOrder.workOrderCode, "OTHER-ORG"),
      ),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });
});
