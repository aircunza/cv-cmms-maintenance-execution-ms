import {
  createWorkRequest,
  createWorkRequestContext,
  setupWorkRequestE2eContext,
  teardownWorkRequestE2eContext,
  sendPattern,
  assertRpcError,
  type WorkRequestE2eContext,
} from "./support/work-request-e2e-context";

describe("WO Request Update (e2e, NATS)", () => {
  let context: WorkRequestE2eContext;
  let wr: any;

  beforeAll(async () => {
    context = await setupWorkRequestE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkRequestE2eContext(context);
    }
  });

  beforeEach(async () => {
    wr = await createWorkRequest(context, {
      issueDescription: `Update source ${Date.now()}`,
    });
  });

  it("updates the issue description of a work request", async () => {
    const response = await sendPattern(context.client, "work.request.update", {
      requestId: wr.workRequest.requestId,
      issueDescription: "Updated issue description",
      actorId: context.actor.id,
      actorName: context.actor.username,
      userPermissions: context.userPermissions,
    });

    expect(response.workRequest.requestId).toBe(wr.workRequest.requestId);
    expect(response.workRequest.issueDescription).toBe(
      "Updated issue description",
    );
    expect(response.workRequest.updatedByName).toBe(context.actor.username);
  });

  it("rejects update when update permission is missing", async () => {
    const restrictedContext = createWorkRequestContext(context, {
      userPermissions: ["mnt.work.request.create"],
    });

    await assertRpcError(
      sendPattern(context.client, "work.request.update", {
        requestId: wr.workRequest.requestId,
        issueDescription: "Should fail",
        actorId: context.actor.id,
        actorName: context.actor.username,
        userPermissions: restrictedContext.userPermissions,
      }),
      403,
    );
  });

  it("rejects update when work request does not exist", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.request.update", {
        requestId: 999999999,
        issueDescription: "Should fail",
        actorId: context.actor.id,
        actorName: context.actor.username,
        userPermissions: context.userPermissions,
      }),
      404,
    );
  });

  it("rejects update when description exceeds max length", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.request.update", {
        requestId: wr.workRequest.requestId,
        issueDescription: "A".repeat(241),
        actorId: context.actor.id,
        actorName: context.actor.username,
        userPermissions: context.userPermissions,
      }),
      400,
    );
  });
});
