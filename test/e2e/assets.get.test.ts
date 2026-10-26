import {
  assertRpcError,
  createAssetRecord,
  sendPattern,
  setupAssetsE2eContext,
  teardownAssetsE2eContext,
  type AssetsE2eContext,
} from "./support/assets-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

const TEST_RUN_ID = dateNow().toString(36);

function dateNow() {
  return Date.now();
}

describe("Assets GET (e2e, NATS)", () => {
  let context: AssetsE2eContext;

  beforeAll(async () => {
    context = await setupAssetsE2eContext();
    await createAssetRecord(context, {
      assetCode: `AST-GET-001-${TEST_RUN_ID}`,
      assetDescription: "Asset for GET test",
      sector: "EXTRUSION",
    });
    await createAssetRecord(context, {
      assetCode: `AST-GET-002-${TEST_RUN_ID}`,
      assetDescription: "Another asset for GET test",
      assetStatus: "INACTIVE",
      sector: "MAINTENANCE",
    });
    await sendPattern(context.client, "asset.deactivate", {
      assetCode: `AST-GET-002-${TEST_RUN_ID}`,
      actorCode: context.actor.code,
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownAssetsE2eContext(context);
    }
  });

  it("finds an asset by assetCode", async () => {
    const response = await sendPattern(context.client, "asset.find.one", {
      assetCode: `AST-GET-001-${TEST_RUN_ID}`,
    });

    expect(response.asset).toBeDefined();
    expect(response.asset.assetCode).toBe(`AST-GET-001-${TEST_RUN_ID}`);
    expect(response.asset.assetDescription).toBe("Asset for GET test");
  });

  it("returns 404 when asset not found", async () => {
    await assertRpcError(
      sendPattern(context.client, "asset.find.one", {
        assetCode: "NON-EXISTENT-ASSET",
      }),
      404,
      "not found",
    );
  });

  it("finds all assets", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {});

    expect(response.assets).toBeDefined();
    expect(Array.isArray(response.assets)).toBe(true);
    expect(response.total).toBeGreaterThan(0);
  });

  it("finds all assets with filter by assetCode using like", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      filters: [
        { field: "assetCode", operator: "like", value: "AST-GET" },
      ],
    });

    expect(response.assets).toBeDefined();
    expect(response.assets.length).toBeGreaterThan(0);
    expect(
      response.assets.every((a: any) => a.assetCode.includes("AST-GET")),
    ).toBe(true);
  });

  it("finds all assets with filter by organizationCode using eq", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      filters: [
        {
          field: "organizationCode",
          operator: "eq",
          value: context.organizationCode,
        },
      ],
    });

    expect(response.assets).toBeDefined();
    expect(response.assets.length).toBeGreaterThan(0);
  });

  it("finds all active assets by default", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {});

    expect(response.assets).toBeDefined();
    expect(
      response.assets.every((a: any) => a.isActive === "Y"),
    ).toBe(true);
  });

  it("finds all assets including inactive when specified with filter", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      filters: [{ field: "isActive", operator: "eq", value: "N" }],
    });

    expect(response.assets).toBeDefined();
    expect(
      response.assets.every((a: any) => a.isActive === "N"),
    ).toBe(true);
  });

  it("finds assets with filter by sector using eq", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      filters: [{ field: "sector", operator: "eq", value: "EXTRUSION" }],
    });

    expect(response.assets).toBeDefined();
    expect(response.assets.length).toBeGreaterThan(0);
    expect(
      response.assets.every((a: any) => a.sector === "EXTRUSION"),
    ).toBe(true);
  });

  it("finds assets with multiple filters", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      filters: [
        {
          field: "organizationCode",
          operator: "eq",
          value: context.organizationCode,
        },
        { field: "assetCode", operator: "like", value: "AST-GET" },
      ],
    });

    expect(response.assets).toBeDefined();
    expect(response.assets.length).toBeGreaterThan(0);
  });

  it("finds assets with pagination", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      limit: 1,
      offset: 0,
    });

    expect(response.assets).toBeDefined();
    expect(response.assets.length).toBeLessThanOrEqual(1);
  });

  it("finds assets with order", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      order: [["assetCode", "ASC"]],
    });

    expect(response.assets).toBeDefined();
    if (response.assets.length > 1) {
      expect(response.assets[0].assetCode <= response.assets[1].assetCode).toBe(
        true,
      );
    }
  });

  it("finds assets with filter using in operator", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      filters: [
        {
          field: "sector",
          operator: "in",
          value: ["EXTRUSION", "MAINTENANCE"],
        },
      ],
    });

    expect(response.assets).toBeDefined();
    expect(response.assets.length).toBeGreaterThan(0);
    expect(
      response.assets.every(
        (a: any) => a.sector === "EXTRUSION" || a.sector === "MAINTENANCE",
      ),
    ).toBe(true);
  });

  it("rejects invalid filter field", async () => {
    await assertRpcError(
      sendPattern(context.client, "asset.find.all", {
        filters: [
          { field: "invalidField", operator: "eq", value: "someValue" },
        ],
      }),
      400,
      "Invalid filter data",
    );
  });

  it("rejects like operator on non-string field", async () => {
    await assertRpcError(
      sendPattern(context.client, "asset.find.all", {
        filters: [
          { field: "centerCostCode", operator: "like", value: "100" },
        ],
      }),
      400,
      "Invalid filter data",
    );
  });

  it("rejects filters that is not an array", async () => {
    await assertRpcError(
      sendPattern(context.client, "asset.find.all", {
        filters: { field: "sector", operator: "eq", value: "EXTRUSION" },
      }),
      400,
      "Invalid filter data",
    );
  });
});
