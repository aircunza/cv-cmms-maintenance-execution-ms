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

function releasePayload(
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

describe("WO Request Release (e2e, NATS)", () => {
  let context: WorkRequestE2eContext;

  beforeAll(async () => {
    context = await setupWorkRequestE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkRequestE2eContext(context);
    }
  });

  it("releases a work request from ON_HOLD status", async () => {
    const wr = await createWorkRequest(context);

    expect(wr.workRequest.statusCode).toBe("ON_HOLD");
    expect(wr.workRequest.requestedAt).toBeDefined();

    const response = await sendPattern(
      context.client,
      "work.request.release",
      releasePayload(context, wr.workRequest.requestId),
    );

    expect(response.workRequest.statusCode).toBe("RELEASED");
    expect(response.workRequest.releasedAt).toBeDefined();
    expect(response.workRequest.updatedByName).toBe(context.actor.username);
  });

  it("rejects when release permission is missing", async () => {
    const wr = await createWorkRequest(context);
    const restrictedContext = createWorkRequestContext(context, {
      userPermissions: ["mnt.work.request.create", "mnt.work.orders.create"],
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.release",
        releasePayload(restrictedContext, wr.workRequest.requestId),
      ),
      403,
    );
  });

  it("rejects when role is not authorized to release", async () => {
    const wr = await createWorkRequest(context);
    const restrictedContext = createWorkRequestContext(context, {
      userRoles: ["TECHNICIAN_MAINTENANCE_01"],
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.release",
        releasePayload(restrictedContext, wr.workRequest.requestId),
      ),
      403,
    );
  });

  it("rejects when work request does not exist", async () => {
    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.release",
        releasePayload(context, 999999999),
      ),
      404,
    );
  });

  it("rejects when work request is not in ON_HOLD status", async () => {
    const wr = await createWorkRequest(context);
    await sendPattern(
      context.client,
      "work.request.release",
      releasePayload(context, wr.workRequest.requestId),
    );

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.release",
        releasePayload(context, wr.workRequest.requestId),
      ),
      400,
    );
  });

  it("rejects when work request is in CANCELED status", async () => {
    const wr = await createWorkRequest(context);
    await sendPattern(
      context.client,
      "work.request.release",
      releasePayload(context, wr.workRequest.requestId),
    );
    await sendPattern(
      context.client,
      "work.request.cancel",
      releasePayload(context, wr.workRequest.requestId),
    );

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.release",
        releasePayload(context, wr.workRequest.requestId),
      ),
      400,
    );
  });

  it("rejects when the work request record is in an organization mismatch", async () => {
    const wr = await createWorkRequest(context);

    await assertRpcError(
      sendPattern(
        context.client,
        "work.request.release",
        releasePayload(context, wr.workRequest.requestId, {
          organizationCode: "E2E_ORG_WO_DIFF",
        }),
      ),
      404,
    );
  });
});
