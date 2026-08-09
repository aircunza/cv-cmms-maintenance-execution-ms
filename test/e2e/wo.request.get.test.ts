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
      organizationCode: context.organizationCode,
      userPermissions: context.userPermissions,
      userRoles: context.userRoles,
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkRequestE2eContext(context);
    }
  });

  it("finds a single work request by id", async () => {
    const response = await sendPattern(
      context.client,
      "work.request.find.one",
      {
        requestId: seedWr1.workRequest.requestId,
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
      },
    );

    expect(response.workRequest.requestId).toBe(seedWr1.workRequest.requestId);
    expect(response.workRequest.issueDescription).toContain("case alpha");
  });

  it("returns 404 when work request does not exist", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.request.find.one", {
        requestId: 999999999,
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
      }),
      404,
    );
  });

  it("filters using eq operator", async () => {
    const response = await sendPattern(
      context.client,
      "work.request.find.all",
      {
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        filters: [{ field: "statusCode", operator: "eq", value: "RELEASED" }],
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
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        filters: [
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
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        filters: [
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
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
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

  it("returns empty result set when other organization queries", async () => {
    const response = await sendPattern(
      context.client,
      "work.request.find.all",
      {
        organizationCode: "E2E_ORG_WO_DIFF",
        userRoles: context.userRoles,
        filters: [],
      },
    );

    expect(response.total).toBe(0);
    expect(response.workRequests).toHaveLength(0);
  });

  it("supports order, limit and offset", async () => {
    const response = await sendPattern(
      context.client,
      "work.request.find.all",
      {
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        filters: [],
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
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
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
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        filters: {
          field: "statusCode",
          operator: "eq",
          value: "RELEASED",
        },
      }),
      400,
      "Invalid filter data",
    );
  });
});
