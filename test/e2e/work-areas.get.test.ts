import {
  assertRpcError,
  createWorkAreaRecord,
  sendPattern,
  setupWorkAreasE2eContext,
  teardownWorkAreasE2eContext,
  type WorkAreasE2eContext,
} from "./support/work-areas-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("Work Areas GET (e2e, NATS)", () => {
  let context: WorkAreasE2eContext;
  let createdWorkAreaId: string;

  beforeAll(async () => {
    context = await setupWorkAreasE2eContext();
    const response = await createWorkAreaRecord(context, {
      workAreaCode: "WA-GET-001",
      workAreaDescription: "Work Area for GET test",
    });
    createdWorkAreaId = response.workArea.id;
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkAreasE2eContext(context);
    }
  });

  it("finds a work area by id", async () => {
    const response = await sendPattern(context.client, "work.area.find.one", {
      id: createdWorkAreaId,
    });

    expect(response.workArea).toBeDefined();
    expect(response.workArea.id).toBe(createdWorkAreaId);
    expect(response.workArea.workAreaCode).toBe("WA-GET-001");
  });

  it("returns 404 when work area not found", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.area.find.one", {
        id: "00000000-0000-0000-0000-000000000000",
      }),
      404,
      "not found",
    );
  });

  it("finds all work areas", async () => {
    const response = await sendPattern(context.client, "work.area.find.all", {});

    expect(response.workAreas).toBeDefined();
    expect(Array.isArray(response.workAreas)).toBe(true);
    expect(response.total).toBeGreaterThan(0);
  });

  it("finds all work areas with filter by workAreaCode", async () => {
    const response = await sendPattern(context.client, "work.area.find.all", {
      workAreaCode: "WA-GET",
    });

    expect(response.workAreas).toBeDefined();
    expect(response.workAreas.length).toBeGreaterThan(0);
    expect(
      response.workAreas.every((wa: any) => wa.workAreaCode.includes("WA-GET")),
    ).toBe(true);
  });

  it("finds all work areas with filter by organizationCode", async () => {
    const response = await sendPattern(context.client, "work.area.find.all", {
      organizationCode: context.organizationCode,
    });

    expect(response.workAreas).toBeDefined();
    expect(response.workAreas.length).toBeGreaterThan(0);
  });

  it("finds all active work areas by default", async () => {
    const response = await sendPattern(context.client, "work.area.find.all", {});

    expect(response.workAreas).toBeDefined();
    expect(
      response.workAreas.every((wa: any) => wa.isActive === "Y"),
    ).toBe(true);
  });
});
