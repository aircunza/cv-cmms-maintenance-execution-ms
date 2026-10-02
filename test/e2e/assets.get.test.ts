import {
  assertRpcError,
  createAssetRecord,
  sendPattern,
  setupAssetsE2eContext,
  teardownAssetsE2eContext,
  type AssetsE2eContext,
} from "./support/assets-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

const TEST_RUN_ID = Date.now().toString(36);

describe("Assets GET (e2e, NATS)", () => {
  let context: AssetsE2eContext;

  beforeAll(async () => {
    context = await setupAssetsE2eContext();
    await createAssetRecord(context, {
      assetCode: `AST-GET-001-${TEST_RUN_ID}`,
      assetDescription: "Asset for GET test",
    });
    await createAssetRecord(context, {
      assetCode: `AST-GET-002-${TEST_RUN_ID}`,
      assetDescription: "Another asset for GET test",
      assetStatus: "INACTIVE",
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

  it("finds all assets with filter by assetCode", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      assetCode: "AST-GET",
    });

    expect(response.assets).toBeDefined();
    expect(response.assets.length).toBeGreaterThan(0);
    expect(
      response.assets.every((a: any) => a.assetCode.includes("AST-GET")),
    ).toBe(true);
  });

  it("finds all assets with filter by organizationCode", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      organizationCode: context.organizationCode,
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

  it("finds all assets including inactive when specified", async () => {
    const response = await sendPattern(context.client, "asset.find.all", {
      isActive: "N",
    });

    expect(response.assets).toBeDefined();
    expect(
      response.assets.every((a: any) => a.isActive === "N"),
    ).toBe(true);
  });
});
