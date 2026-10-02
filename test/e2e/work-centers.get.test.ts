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

describe("Work Centers GET (e2e, NATS)", () => {
  let context: WorkCentersE2eContext;
  let createdWorkCenterId: string;

  beforeAll(async () => {
    context = await setupWorkCentersE2eContext();
    const response = await createWorkCenterRecord(context, {
      workCenterCode: `WC-GET-${TEST_RUN_ID}`,
      workCenterDescription: "Work Center for GET test",
      centerCostCode: 9010,
    });
    createdWorkCenterId = response.workCenter.id;
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkCentersE2eContext(context);
    }
  });

  it("finds a work center by id", async () => {
    const response = await sendPattern(context.client, "work.center.find.one", {
      id: createdWorkCenterId,
    });

    expect(response.workCenter).toBeDefined();
    expect(response.workCenter.id).toBe(createdWorkCenterId);
    expect(response.workCenter.workCenterCode).toBe(`WC-GET-${TEST_RUN_ID}`);
  });

  it("returns 404 when work center not found", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.center.find.one", {
        id: "00000000-0000-0000-0000-000000000000",
      }),
      404,
      "not found",
    );
  });

  it("finds all work centers", async () => {
    const response = await sendPattern(context.client, "work.center.find.all", {});

    expect(response.workCenters).toBeDefined();
    expect(Array.isArray(response.workCenters)).toBe(true);
    expect(response.total).toBeGreaterThan(0);
  });

  it("finds all work centers with filter by workCenterCode", async () => {
    const response = await sendPattern(context.client, "work.center.find.all", {
      workCenterCode: `WC-GET-${TEST_RUN_ID}`,
    });

    expect(response.workCenters).toBeDefined();
    expect(response.workCenters.length).toBeGreaterThan(0);
    expect(
      response.workCenters.every((wc: any) => wc.workCenterCode.includes(`WC-GET-${TEST_RUN_ID}`)),
    ).toBe(true);
  });

  it("finds all work centers with filter by workAreaId", async () => {
    const response = await sendPattern(context.client, "work.center.find.all", {
      workAreaId: context.workAreaId,
    });

    expect(response.workCenters).toBeDefined();
    expect(response.workCenters.length).toBeGreaterThan(0);
  });

  it("finds all active work centers by default", async () => {
    const response = await sendPattern(context.client, "work.center.find.all", {});

    expect(response.workCenters).toBeDefined();
    expect(
      response.workCenters.every((wc: any) => wc.isActive === "Y"),
    ).toBe(true);
  });
});
