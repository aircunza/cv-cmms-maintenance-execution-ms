import {
  createWorkRequest,
  setupWorkRequestE2eContext,
  teardownWorkRequestE2eContext,
  sendPattern,
  assertRpcError,
  type WorkRequestE2eContext,
} from "./support/work-request-e2e-context";

describe("WO Request GET (e2e, NATS)", () => {
  let context: WorkRequestE2eContext;
  let seedWr1: any;
  let seedWr2: any;
  let seedWr3: any;

  beforeAll(async () => {
    context = await setupWorkRequestE2eContext();

    seedWr1 = await createWorkRequest(context, {
      issueDescription: "Filter eq and in - case alpha",
    });
    seedWr2 = await createWorkRequest(context, {
      issueDescription: "Filter like - case beta",
    });
    seedWr3 = await createWorkRequest(context, {
      issueDescription: "Different status - case gamma",
    });

    await sendPattern(context.client, "work.request.cancel", {
      requestId: seedWr3.workRequest.requestId,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkRequestE2eContext(context);
    }
  });

  it("filters using eq operator", async () => {
    const response = await sendPattern(
      context.client,
      "work.request.find.all",
      {
        filters: [
          {
            field: "organizationCode",
            operator: "eq",
            value: context.organizationCode,
          },
          { field: "statusCode", operator: "eq", value: "RELEASED" },
        ],
      },
    );

    expect(response.total).toBeGreaterThanOrEqual(2);
    expect(
      response.workRequests.every(
        (item: any) => item.statusCode === "RELEASED",
      ),
    ).toBe(true);
  });

  it("filters using like operator", async () => {
    const response = await sendPattern(
      context.client,
      "work.request.find.all",
      {
        filters: [
          {
            field: "organizationCode",
            operator: "eq",
            value: context.organizationCode,
          },
          { field: "issueDescription", operator: "like", value: "case beta" },
        ],
      },
    );

    expect(response.total).toBeGreaterThanOrEqual(1);
    expect(
      response.workRequests.some((item: any) =>
        String(item.issueDescription).includes("case beta"),
      ),
    ).toBe(true);
  });

  it("filters using gt and lt operators for dates", async () => {
    const lowerBound = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const upperBound = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const response = await sendPattern(
      context.client,
      "work.request.find.all",
      {
        filters: [
          {
            field: "organizationCode",
            operator: "eq",
            value: context.organizationCode,
          },
          { field: "createdAt", operator: "gt", value: lowerBound },
          { field: "createdAt", operator: "lt", value: upperBound },
        ],
      },
    );

    expect(response.total).toBeGreaterThanOrEqual(3);
  });

  it("filters using in operator", async () => {
    const response = await sendPattern(
      context.client,
      "work.request.find.all",
      {
        filters: [
          {
            field: "requestId",
            operator: "in",
            value: [
              seedWr1.workRequest.requestId,
              seedWr2.workRequest.requestId,
              seedWr3.workRequest.requestId,
            ],
          },
        ],
      },
    );

    expect(response.total).toBe(3);
  });

  it("supports order, limit and offset", async () => {
    const response = await sendPattern(
      context.client,
      "work.request.find.all",
      {
        filters: [
          {
            field: "organizationCode",
            operator: "eq",
            value: context.organizationCode,
          },
        ],
        order: [["requestId", "DESC"]],
        limit: 1,
        offset: 1,
      },
    );

    expect(response.workRequests).toHaveLength(1);
  });

  it("returns empty set when no records match", async () => {
    const response = await sendPattern(
      context.client,
      "work.request.find.all",
      {
        filters: [
          {
            field: "issueDescription",
            operator: "eq",
            value: "NON_EXISTENT_E2E_ISSUE",
          },
        ],
      },
    );

    expect(response.total).toBe(0);
    expect(response.workRequests).toHaveLength(0);
  });

  it("returns invalid filter data when filter payload is malformed", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.request.find.all", {
        filters: { field: "statusCode", operator: "eq", value: "RELEASED" },
      }),
      400,
      "Invalid filter data",
    );
  });
});
