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

function completePayload(
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

describe("WO Request Complete (e2e, NATS)", () => {
  let context: WorkRequestE2eContext;

  beforeAll(async () => {
    context = await setupWorkRequestE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkRequestE2eContext(context);
    }
  });

  it("completes a work request from RELEASED status", async () => {
    const wr = await createWorkRequest(context);

    const response = await sendPattern(
      context.client,
      "work.request.complete",
      completePayload(context, wr.workRequest.requestId),
    );

    expect(response.workRequest.statusCode).toBe("COMPLETED");
    expect(response.workRequest.completedAt).toBeDefined();
    expect(response.workRequest.updatedByName).toBe(context.actor.username);
  });

  it("does not modify the associated work order when completing", async () => {
    const wr = await createWorkRequest(context);

    const response = await sendPattern(
      context.client,
      "work.request.complete",
      completePayload(context, wr.workRequest.requestId),
    );

    const woFromWr = response.workRequest.workOrders[0];
    expect(woFromWr.woStatusCode).toBe("RELEASED");
  });

  it("rejects when complete permission is missing", async () => {
    const wr = await createWorkRequest(context);
    const restrictedContext = createWorkRequestContext(context, {
      userPermissions: ["mnt.work.request.create"],
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.complete",
        completePayload(restrictedContext, wr.workRequest.requestId),
      ),
      403,
    );
  });

  it("rejects when role is not authorized to complete", async () => {
    const wr = await createWorkRequest(context);
    const restrictedContext = createWorkRequestContext(context, {
      userRoles: ["CUSTOMER"],
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.complete",
        completePayload(restrictedContext, wr.workRequest.requestId),
      ),
      403,
    );
  });

  it("rejects when work request does not exist", async () => {
    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.complete",
        completePayload(context, 999999999),
      ),
      404,
    );
  });

  it("rejects when work request is not in RELEASED status", async () => {
    const wr = await createWorkRequest(context);

    await sendPattern(
      context.client,
      "work.request.cancel",
      completePayload(context, wr.workRequest.requestId),
    );

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.complete",
        completePayload(context, wr.workRequest.requestId),
      ),
      400,
    );
  });
});
