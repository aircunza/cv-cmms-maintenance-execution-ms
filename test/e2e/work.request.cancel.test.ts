import {
  createWorkRequest,
  createWorkRequestContext,
  setupWorkRequestE2eContext,
  teardownWorkRequestE2eContext,
  sendPattern,
  assertRpcError,
  type WorkRequestE2eContext,
} from "./support/work-request-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

function cancelPayload(
  context: WorkRequestE2eContext,
  requestId: number | string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    requestId,
    actorId: context.actor.id,
    actorName: context.actor.username,
    organizationCode: context.organizationCode,
    userPermissions: context.userPermissions,
    userRoles: context.userRoles,
    ...overrides,
  };
}

describe("WO Request Cancel (e2e, NATS)", () => {
  let context: WorkRequestE2eContext;

  beforeAll(async () => {
    context = await setupWorkRequestE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkRequestE2eContext(context);
    }
  });

  it("cancels a work request from RELEASED status", async () => {
    const wr = await createWorkRequest(context);

    const response = await sendPattern(
      context.client,
      "work.request.cancel",
      cancelPayload(context, wr.workRequest.requestId),
    );

    expect(response.workRequest.statusCode).toBe("CANCELED");
    expect(response.workRequest.canceledAt).toBeDefined();
  });

  it("cancels the associated work order when canceling the work request", async () => {
    const wr = await createWorkRequest(context);

    const response = await sendPattern(
      context.client,
      "work.request.cancel",
      cancelPayload(context, wr.workRequest.requestId),
    );

    const woFromWr = response.workRequest.workOrders[0];
    expect(woFromWr.woStatusCode).toBe("CANCELED");
  });

  it("cancels a work request from COMPLETED status", async () => {
    const wr = await createWorkRequest(context);

    await sendPattern(
      context.client,
      "work.request.complete",
      cancelPayload(context, wr.workRequest.requestId),
    );

    const response = await sendPattern(
      context.client,
      "work.request.cancel",
      cancelPayload(context, wr.workRequest.requestId),
    );

    expect(response.workRequest.statusCode).toBe("CANCELED");
  });

  it("rejects when cancel request permission is missing", async () => {
    const wr = await createWorkRequest(context);
    const restrictedContext = createWorkRequestContext(context, {
      userPermissions: ["mnt.work.orders.cancel", "mnt.work.request.create"],
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.cancel",
        cancelPayload(restrictedContext, wr.workRequest.requestId),
      ),
      403,
    );
  });

  it("rejects when work order cancel permission is missing", async () => {
    const wr = await createWorkRequest(context);
    const restrictedContext = createWorkRequestContext(context, {
      userPermissions: ["mnt.work.request.cancel", "mnt.work.request.create"],
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.cancel",
        cancelPayload(restrictedContext, wr.workRequest.requestId),
      ),
      403,
    );
  });

  it("rejects when role is not authorized to cancel", async () => {
    const wr = await createWorkRequest(context);
    const restrictedContext = createWorkRequestContext(context, {
      userRoles: ["PLANNER_MAINTENANCE_01"],
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.cancel",
        cancelPayload(restrictedContext, wr.workRequest.requestId),
      ),
      403,
    );
  });

  it("rejects when work request does not exist", async () => {
    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.cancel",
        cancelPayload(context, 999999999),
      ),
      404,
    );
  });

  it("rejects when work request is already canceled", async () => {
    const wr = await createWorkRequest(context);

    await sendPattern(
      context.client,
      "work.request.cancel",
      cancelPayload(context, wr.workRequest.requestId),
    );

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.cancel",
        cancelPayload(context, wr.workRequest.requestId),
      ),
      400,
    );
  });

  it("rejects when the work request record is in an organization mismatch", async () => {
    const wr = await createWorkRequest(context);

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.cancel",
        cancelPayload(context, wr.workRequest.requestId, {
          organizationCode: "E2E_ORG_WO_DIFF",
        }),
      ),
      404,
    );
  });
});
