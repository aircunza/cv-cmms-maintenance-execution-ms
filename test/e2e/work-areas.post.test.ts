import {
  assertRpcError,
  createWorkAreaRecord,
  setupWorkAreasE2eContext,
  teardownWorkAreasE2eContext,
  type WorkAreasE2eContext,
} from "./support/work-areas-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Work Areas POST (e2e, NATS)", () => {
  let context: WorkAreasE2eContext;

  beforeAll(async () => {
    context = await setupWorkAreasE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkAreasE2eContext(context);
    }
  });

  it("creates a work area successfully", async () => {
    const response = await createWorkAreaRecord(context, {
      workAreaCode: "WA-POST-001",
      workAreaDescription: "New Work Area",
    });

    expect(response.workArea).toBeDefined();
    expect(response.workArea.workAreaCode).toBe("WA-POST-001");
    expect(response.workArea.workAreaDescription).toBe("New Work Area");
    expect(response.workArea.organizationCode).toBe(context.organizationCode);
    expect(response.workArea.isActive).toBe("Y");
  });

  it("rejects when workAreaCode already exists for organization", async () => {
    await createWorkAreaRecord(context, {
      workAreaCode: "WA-DUP-001",
    });

    await assertRpcError(
      createWorkAreaRecord(context, {
        workAreaCode: "WA-DUP-001",
      }),
      400,
      "already exists",
    );
  });

  it("rejects when workAreaCode is missing", async () => {
    await assertRpcError(
      createWorkAreaRecord(context, {
        workAreaCode: undefined,
      }),
      400,
    );
  });

  it("rejects when organizationCode is missing", async () => {
    await assertRpcError(
      createWorkAreaRecord(context, {
        organizationCode: undefined,
      }),
      400,
    );
  });

  it("rejects when workAreaCode exceeds max length", async () => {
    await assertRpcError(
      createWorkAreaRecord(context, {
        workAreaCode: "W".repeat(256),
      }),
      400,
    );
  });

  it("rejects when organizationCode does not exist", async () => {
    await assertRpcError(
      createWorkAreaRecord(context, {
        organizationCode: "NON-EXISTENT-ORG",
      }),
      404,
    );
  });

  it("allows same workAreaCode in different organizations", async () => {
    const response = await createWorkAreaRecord(context, {
      workAreaCode: "WA-SAME-CODE",
      organizationCode: context.organizationCode,
    });

    expect(response.workArea).toBeDefined();
    expect(response.workArea.workAreaCode).toBe("WA-SAME-CODE");
  });
});
