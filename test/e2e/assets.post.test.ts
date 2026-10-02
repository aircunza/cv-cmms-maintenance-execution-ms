import {
  assertRpcError,
  createAssetRecord,
  setupAssetsE2eContext,
  teardownAssetsE2eContext,
  type AssetsE2eContext,
} from "./support/assets-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

const TEST_RUN_ID = Date.now().toString(36);

describe("Assets POST (e2e, NATS)", () => {
  let context: AssetsE2eContext;

  beforeAll(async () => {
    context = await setupAssetsE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownAssetsE2eContext(context);
    }
  });

  it("creates an asset successfully", async () => {
    const response = await createAssetRecord(context, {
      assetCode: `AST-E2E-${TEST_RUN_ID}`,
      assetDescription: "E2E Test Asset",
      assetShortDescription: "E2E Asset",
      assetStatus: "OPERATIVE",
    });

    expect(response.asset).toBeDefined();
    expect(response.asset.assetCode).toBe(`AST-E2E-${TEST_RUN_ID}`);
    expect(response.asset.assetDescription).toBe("E2E Test Asset");
    expect(response.asset.organizationCode).toBe(context.organizationCode);
    expect(response.asset.isActive).toBe("Y");
    expect(response.asset.createdBy).toBe(context.actor.code);
  });

  it("rejects when assetCode already exists", async () => {
    await createAssetRecord(context, {
      assetCode: `AST-E2E-DUP-${TEST_RUN_ID}`,
    });

    await assertRpcError(
      createAssetRecord(context, {
        assetCode: `AST-E2E-DUP-${TEST_RUN_ID}`,
      }),
      400,
      "already exists",
    );
  });

  it("rejects when assetCode is missing", async () => {
    await assertRpcError(
      createAssetRecord(context, {
        assetCode: undefined,
      }),
      400,
    );
  });

  it("rejects when organizationCode is missing", async () => {
    await assertRpcError(
      createAssetRecord(context, {
        organizationCode: undefined,
      }),
      400,
    );
  });

  it("rejects when actorCode is missing", async () => {
    await assertRpcError(
      createAssetRecord(context, {
        actorCode: undefined,
      }),
      400,
    );
  });

  it("rejects when assetCode exceeds max length", async () => {
    await assertRpcError(
      createAssetRecord(context, {
        assetCode: "A".repeat(81),
      }),
      400,
    );
  });

  it("rejects when organizationCode does not exist", async () => {
    await assertRpcError(
      createAssetRecord(context, {
        organizationCode: "NON-EXISTENT-ORG",
      }),
      404,
    );
  });

  it("creates asset without workCenterId", async () => {
    const response = await createAssetRecord(context, {
      assetCode: `AST-E2E-NO-WC-${TEST_RUN_ID}`,
      workCenterId: undefined,
    });

    expect(response.asset).toBeDefined();
    expect(response.asset.assetCode).toBe(`AST-E2E-NO-WC-${TEST_RUN_ID}`);
    expect(response.asset.workCenterId).toBeNull();
  });

  it("rejects when workCenterId does not exist", async () => {
    await assertRpcError(
      createAssetRecord(context, {
        workCenterId: "00000000-0000-0000-0000-000000000000",
      }),
      404,
    );
  });
});
