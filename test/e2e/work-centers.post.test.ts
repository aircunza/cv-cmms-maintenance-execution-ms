import {
  assertRpcError,
  createWorkCenterRecord,
  setupWorkCentersE2eContext,
  teardownWorkCentersE2eContext,
  type WorkCentersE2eContext,
} from "./support/work-centers-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

const TEST_RUN_ID = Date.now().toString(36);

describe("Work Centers POST (e2e, NATS)", () => {
  let context: WorkCentersE2eContext;

  beforeAll(async () => {
    context = await setupWorkCentersE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkCentersE2eContext(context);
    }
  });

  it("creates a work center successfully", async () => {
    const response = await createWorkCenterRecord(context, {
      workCenterCode: `WC-POST-${TEST_RUN_ID}`,
      workCenterDescription: "New Work Center",
      centerCostCode: 9002,
    });

    expect(response.workCenter).toBeDefined();
    expect(response.workCenter.workCenterCode).toBe(`WC-POST-${TEST_RUN_ID}`);
    expect(response.workCenter.workCenterDescription).toBe("New Work Center");
    expect(response.workCenter.workAreaId.toLowerCase()).toBe(context.workAreaId.toLowerCase());
    expect(response.workCenter.centerCostCode).toBe(9002);
    expect(response.workCenter.isActive).toBe("Y");
  });

  it("rejects when centerCostCode already exists for work area", async () => {
    await createWorkCenterRecord(context, {
      workCenterCode: `WC-DUP-COST-${TEST_RUN_ID}`,
      centerCostCode: 9003,
    });

    await assertRpcError(
      createWorkCenterRecord(context, {
        workCenterCode: `WC-DUP-COST-2-${TEST_RUN_ID}`,
        centerCostCode: 9003,
      }),
      400,
      "already exists",
    );
  });

  it("rejects when workCenterCode is missing", async () => {
    await assertRpcError(
      createWorkCenterRecord(context, {
        workCenterCode: undefined,
      }),
      400,
    );
  });

  it("rejects when workAreaId is missing", async () => {
    await assertRpcError(
      createWorkCenterRecord(context, {
        workAreaId: undefined,
      }),
      400,
    );
  });

  it("rejects when centerCostCode is missing", async () => {
    await assertRpcError(
      createWorkCenterRecord(context, {
        centerCostCode: undefined,
      }),
      400,
    );
  });

  it("rejects when workCenterCode exceeds max length", async () => {
    await assertRpcError(
      createWorkCenterRecord(context, {
        workCenterCode: "W".repeat(256),
      }),
      400,
    );
  });

  it("rejects when workAreaId does not exist", async () => {
    await assertRpcError(
      createWorkCenterRecord(context, {
        workAreaId: "00000000-0000-0000-0000-000000000000",
      }),
      404,
    );
  });

  it("allows same centerCostCode in different work areas", async () => {
    const response = await createWorkCenterRecord(context, {
      workCenterCode: `WC-SAME-COST-${TEST_RUN_ID}`,
      centerCostCode: 9004,
    });

    expect(response.workCenter).toBeDefined();
    expect(response.workCenter.centerCostCode).toBe(9004);
  });
});
