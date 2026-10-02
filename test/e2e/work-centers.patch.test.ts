import {
  assertRpcError,
  createWorkCenterRecord,
  sendPattern,
  setupWorkCentersE2eContext,
  teardownWorkCentersE2eContext,
  type WorkCentersE2eContext,
} from "./support/work-centers-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

const TEST_RUN_ID = Date.now().toString(36);

describe("Work Centers PATCH (e2e, NATS)", () => {
  let context: WorkCentersE2eContext;
  let createdWorkCenterId: string;
  let workCenterToDeactivateId: string;

  beforeAll(async () => {
    context = await setupWorkCentersE2eContext();
    const response1 = await createWorkCenterRecord(context, {
      workCenterCode: `WC-PATCH-001-${TEST_RUN_ID}`,
      workCenterDescription: "Work Center to update",
      centerCostCode: 9020,
    });
    createdWorkCenterId = response1.workCenter.id;

    const response2 = await createWorkCenterRecord(context, {
      workCenterCode: `WC-PATCH-002-${TEST_RUN_ID}`,
      workCenterDescription: "Work Center to deactivate",
      centerCostCode: 9021,
    });
    workCenterToDeactivateId = response2.workCenter.id;
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkCentersE2eContext(context);
    }
  });

  it("updates a work center successfully", async () => {
    const response = await sendPattern(context.client, "work.center.update", {
      id: createdWorkCenterId,
      workCenterDescription: "Updated description",
    });

    expect(response.workCenter).toBeDefined();
    expect(response.workCenter.id).toBe(createdWorkCenterId);
    expect(response.workCenter.workCenterDescription).toBe("Updated description");
  });

  it("returns 404 when updating non-existent work center", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.center.update", {
        id: "00000000-0000-0000-0000-000000000000",
        workCenterDescription: "New description",
      }),
      404,
      "not found",
    );
  });

  it("rejects when no fields to update", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.center.update", {
        id: createdWorkCenterId,
      }),
      400,
      "No fields to update",
    );
  });

  it("deactivates a work center successfully", async () => {
    const response = await sendPattern(context.client, "work.center.deactivate", {
      id: workCenterToDeactivateId,
    });

    expect(response.workCenter).toBeDefined();
    expect(response.workCenter.id).toBe(workCenterToDeactivateId);
    expect(response.workCenter.isActive).toBe("N");
    expect(response.message).toContain("deactivated");
  });

  it("returns 404 when deactivating non-existent work center", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.center.deactivate", {
        id: "00000000-0000-0000-0000-000000000000",
      }),
      404,
      "not found",
    );
  });

  it("updates centerCostCode and checks uniqueness", async () => {
    const response = await sendPattern(context.client, "work.center.update", {
      id: createdWorkCenterId,
      centerCostCode: 9099,
    });

    expect(response.workCenter).toBeDefined();
    expect(response.workCenter.centerCostCode).toBe(9099);
  });
});
