import {
  assertRpcError,
  createWorkRequest,
  createWorkRequestContext,
  setupWorkRequestE2eContext,
  teardownWorkRequestE2eContext,
  type WorkRequestE2eContext,
} from "./support/work-request-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WO Request POST (e2e, NATS)", () => {
  let context: WorkRequestE2eContext;

  beforeAll(async () => {
    context = await setupWorkRequestE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkRequestE2eContext(context);
    }
  });

  it("creates a work request successfully and returns associated work order", async () => {
    const response = await createWorkRequest(context, {
      issueDescription: "Hydraulic leak reported in unit A",
    });

    expect(response.workRequest).toBeDefined();
    expect(response.workRequest.requestId).toBeDefined();
    expect(response.workRequest.assetCode).toBe("E2E_WR_AST_001");
    expect(response.workRequest.issueDescription).toBe(
      "Hydraulic leak reported in unit A",
    );
    expect(response.workRequest.organizationCode).toBe(
      context.organizationCode,
    );
    expect(response.workRequest.statusCode).toBe("RELEASED");
    expect(response.workRequest.createdBy).toBe(context.actor.id);
    expect(response.workRequest.createdByName).toBe(context.actor.username);

    expect(response.workOrder).toBeDefined();
    expect(response.workOrder.workOrderCode).toBeDefined();
    expect(response.workOrder.workOrderDescription).toBe(
      "Hydraulic leak reported in unit A",
    );
    expect(response.workOrder.workOrderType).toBe("Not Planned");
    expect(response.workOrder.workOrderSubType).toBe("Emergency");
    expect(response.workOrder.workOrderPriority).toBe("1");
    expect(response.workOrder.woStatusCode).toBe("RELEASED");
    expect(response.workOrder.workRequestId).toBe(
      response.workRequest.requestId,
    );
    expect(response.workOrder.enableOracleWorkOrder).toBe("N");
    expect(response.workOrder.operations).toHaveLength(1);
    expect(response.workOrder.operations[0].operationName).toBe(
      "DEFAULT_OPERATION",
    );
    expect(
      response.workOrder.operations[0].workOrderOperationResource,
    ).toHaveLength(1);
  });

  it("rejects request when required field is missing", async () => {
    await assertRpcError(
      createWorkRequest(context, {
        assetCode: undefined,
        issueDescription: "Missing asset code",
      }),
      400,
    );
  });

  it("rejects request when required field exceeds max length", async () => {
    await assertRpcError(
      createWorkRequest(context, {
        issueDescription: "A".repeat(241),
      }),
      400,
    );
  });

  it("rejects request when enableOracleWorkOrder is invalid", async () => {
    await assertRpcError(
      createWorkRequest(context, {
        enableOracleWorkOrder: "X",
      }),
      400,
    );
  });

  it("rejects request when create permission is missing", async () => {
    const restrictedContext = createWorkRequestContext(context, {
      userPermissions: ["mnt.work.orders.create"],
    });

    await assertRpcError(createWorkRequest(restrictedContext), 403);
  });

  it("rejects request when work order create permission is missing", async () => {
    const restrictedContext = createWorkRequestContext(context, {
      userPermissions: ["mnt.work.request.create"],
    });

    await assertRpcError(createWorkRequest(restrictedContext), 403);
  });

  it("rejects request when role is not authorized", async () => {
    const restrictedContext = createWorkRequestContext(context, {
      userRoles: ["PLANNER_MAINTENANCE_01"],
    });

    await assertRpcError(createWorkRequest(restrictedContext), 403);
  });

  it("rejects request when asset is inactive", async () => {
    await assertRpcError(
      createWorkRequest(context, {
        assetCode: "E2E_WR_AST_003_INACTIVE",
      }),
      404,
      "Asset not found or inactive",
    );
  });

  it("rejects request when asset belongs to another organization", async () => {
    await assertRpcError(
      createWorkRequest(context, {
        assetCode: "E2E_WO_AST_OTHER_ORG",
      }),
      403,
    );
  });
});
