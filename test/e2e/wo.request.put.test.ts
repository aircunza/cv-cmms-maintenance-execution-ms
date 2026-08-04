import {
  createWorkRequest,
  setupWorkRequestE2eContext,
  teardownWorkRequestE2eContext,
  sendPattern,
  assertRpcError,
  type WorkRequestE2eContext,
} from "./support/work-request-e2e-context";

describe("WO Request PUT (e2e, NATS)", () => {
  let context: WorkRequestE2eContext;
  let wrA: any;
  let wrB: any;

  beforeAll(async () => {
    context = await setupWorkRequestE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkRequestE2eContext(context);
    }
  });

  beforeEach(async () => {
    wrA = await createWorkRequest(context, {
      issueDescription: `Bulk update source A ${Date.now()}`,
    });

    wrB = await createWorkRequest(context, {
      issueDescription: `Bulk update source B ${Date.now()}`,
    });
  });

  it("updates multiple work requests using condition in + eq", async () => {
    const response = await sendPattern(context.client, "work.request.update", {
      data: {
        statusCode: "COMPLETED",
        issueDescription: "Bulk updated description",
      },
      condition: [
        {
          field: "requestId",
          operator: "in",
          value: [wrA.workRequest.requestId, wrB.workRequest.requestId],
        },
        {
          field: "organizationCode",
          operator: "eq",
          value: context.organizationCode,
        },
      ],
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    expect(response.affectedRows).toBe(2);
    expect(response.updatedInstances).toHaveLength(2);
    expect(
      response.updatedInstances.every(
        (item: any) =>
          item.statusCode === "COMPLETED" &&
          item.issueDescription === "Bulk updated description",
      ),
    ).toBe(true);
  });

  it("rejects update when data includes non-updatable fields", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.request.update", {
        data: {
          issueDescription: "Should fail",
          assetShortDescription: "NOT_ALLOWED",
        },
        condition: [
          {
            field: "requestId",
            operator: "eq",
            value: wrA.workRequest.requestId,
          },
        ],
        actorId: context.actor.id,
        actorName: context.actor.username,
      }),
      400,
      "Invalid update data",
    );
  });

  it("rejects update when condition operator is unsupported", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.request.update", {
        data: { issueDescription: "Should fail" },
        condition: [
          {
            field: "requestId",
            operator: "like",
            value: wrA.workRequest.requestId,
          },
        ],
        actorId: context.actor.id,
        actorName: context.actor.username,
      }),
      400,
      "Invalid update condition",
    );
  });

  it("rejects update when in operator receives non-array value", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.request.update", {
        data: { issueDescription: "Should fail" },
        condition: [
          {
            field: "requestId",
            operator: "in",
            value: wrA.workRequest.requestId,
          },
        ],
        actorId: context.actor.id,
        actorName: context.actor.username,
      }),
      400,
      "Invalid update condition",
    );
  });
});
