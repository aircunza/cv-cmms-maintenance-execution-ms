import {
  assertRpcError,
  createWorkAreaRecord,
  sendPattern,
  setupWorkAreasE2eContext,
  teardownWorkAreasE2eContext,
  type WorkAreasE2eContext,
} from "./support/work-areas-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Work Areas PATCH (e2e, NATS)", () => {
  let context: WorkAreasE2eContext;
  let createdWorkAreaId: string;
  let workAreaToDeactivateId: string;

  beforeAll(async () => {
    context = await setupWorkAreasE2eContext();
    const response1 = await createWorkAreaRecord(context, {
      workAreaCode: "WA-PATCH-001",
      workAreaDescription: "Work Area to update",
    });
    createdWorkAreaId = response1.workArea.id;

    const response2 = await createWorkAreaRecord(context, {
      workAreaCode: "WA-PATCH-002",
      workAreaDescription: "Work Area to deactivate",
    });
    workAreaToDeactivateId = response2.workArea.id;
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkAreasE2eContext(context);
    }
  });

  it("updates a work area successfully", async () => {
    const response = await sendPattern(context.client, "work.area.update", {
      id: createdWorkAreaId,
      workAreaDescription: "Updated description",
    });

    expect(response.workArea).toBeDefined();
    expect(response.workArea.id).toBe(createdWorkAreaId);
    expect(response.workArea.workAreaDescription).toBe("Updated description");
  });

  it("returns 404 when updating non-existent work area", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.area.update", {
        id: "00000000-0000-0000-0000-000000000000",
        workAreaDescription: "New description",
      }),
      404,
      "not found",
    );
  });

  it("rejects when no fields to update", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.area.update", {
        id: createdWorkAreaId,
      }),
      400,
      "No fields to update",
    );
  });

  it("deactivates a work area successfully", async () => {
    const response = await sendPattern(context.client, "work.area.deactivate", {
      id: workAreaToDeactivateId,
    });

    expect(response.workArea).toBeDefined();
    expect(response.workArea.id).toBe(workAreaToDeactivateId);
    expect(response.workArea.isActive).toBe("N");
    expect(response.message).toContain("deactivated");
  });

  it("returns 404 when deactivating non-existent work area", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.area.deactivate", {
        id: "00000000-0000-0000-0000-000000000000",
      }),
      404,
      "not found",
    );
  });

  it("updates organizationCode and syncs", async () => {
    const response = await sendPattern(context.client, "work.area.update", {
      id: createdWorkAreaId,
      organizationCode: context.organizationCode,
    });

    expect(response.workArea).toBeDefined();
    expect(response.workArea.organizationCode).toBe(context.organizationCode);
  });
});
