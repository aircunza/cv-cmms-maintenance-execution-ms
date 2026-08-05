import {
  assertRpcError,
  createWorkRequest,
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

  it("creates a work request successfully and returns requestId", async () => {
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

  it("rejects request when asset is inactive", async () => {
    await assertRpcError(
      createWorkRequest(context, {
        assetCode: "E2E_WR_AST_003_INACTIVE",
      }),
      404,
      "Asset not found or inactive",
    );
  });

  it("does not assert automatic work-order side-effects (out of scope)", async () => {
    expect(true).toBe(true);
  });
});
