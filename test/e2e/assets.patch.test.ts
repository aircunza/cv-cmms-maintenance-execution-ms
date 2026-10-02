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

describe("Assets PATCH (e2e, NATS)", () => {
  let context: AssetsE2eContext;

  beforeAll(async () => {
    context = await setupAssetsE2eContext();
    await createAssetRecord(context, {
      assetCode: `AST-PATCH-001-${TEST_RUN_ID}`,
      assetDescription: "Asset to update",
    });
    await createAssetRecord(context, {
      assetCode: `AST-PATCH-002-${TEST_RUN_ID}`,
      assetDescription: "Asset to deactivate",
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownAssetsE2eContext(context);
    }
  });

  it("updates an asset successfully", async () => {
    const response = await sendPattern(context.client, "asset.update", {
      assetCode: `AST-PATCH-001-${TEST_RUN_ID}`,
      assetDescription: "Updated description",
      assetShortDescription: "Updated short desc",
      actorCode: context.actor.code,
    });

    expect(response.asset).toBeDefined();
    expect(response.asset.assetCode).toBe(`AST-PATCH-001-${TEST_RUN_ID}`);
    expect(response.asset.assetDescription).toBe("Updated description");
    expect(response.asset.assetShortDescription).toBe("Updated short desc");
    expect(response.asset.updatedBy).toBe(context.actor.code);
  });

  it("returns 404 when updating non-existent asset", async () => {
    await assertRpcError(
      sendPattern(context.client, "asset.update", {
        assetCode: "NON-EXISTENT-ASSET",
        assetDescription: "New description",
        actorCode: context.actor.code,
      }),
      404,
      "not found",
    );
  });

  it("rejects when no fields to update", async () => {
    await assertRpcError(
      sendPattern(context.client, "asset.update", {
        assetCode: `AST-PATCH-001-${TEST_RUN_ID}`,
        actorCode: context.actor.code,
      }),
      400,
      "No fields to update",
    );
  });

  it("rejects when actorCode is missing", async () => {
    await assertRpcError(
      sendPattern(context.client, "asset.update", {
        assetCode: `AST-PATCH-001-${TEST_RUN_ID}`,
        assetDescription: "New description",
      }),
      400,
    );
  });

  it("deactivates an asset successfully", async () => {
    const response = await sendPattern(context.client, "asset.deactivate", {
      assetCode: `AST-PATCH-002-${TEST_RUN_ID}`,
      actorCode: context.actor.code,
    });

    expect(response.asset).toBeDefined();
    expect(response.asset.assetCode).toBe(`AST-PATCH-002-${TEST_RUN_ID}`);
    expect(response.asset.isActive).toBe("N");
    expect(response.message).toContain("deactivated");
  });

  it("returns 404 when deactivating non-existent asset", async () => {
    await assertRpcError(
      sendPattern(context.client, "asset.deactivate", {
        assetCode: "NON-EXISTENT-ASSET",
        actorCode: context.actor.code,
      }),
      404,
      "not found",
    );
  });

  it("updates organization and syncs snapshot", async () => {
    const response = await sendPattern(context.client, "asset.update", {
      assetCode: `AST-PATCH-001-${TEST_RUN_ID}`,
      organizationCode: context.organizationCode,
      actorCode: context.actor.code,
    });

    expect(response.asset).toBeDefined();
    expect(response.asset.organizationCode).toBe(context.organizationCode);
  });
});
