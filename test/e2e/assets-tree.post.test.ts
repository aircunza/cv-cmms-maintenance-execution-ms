import {
  assertRpcError,
  createAssetsTreeRecord,
  setupAssetsTreeE2eContext,
  teardownAssetsTreeE2eContext,
  type AssetsTreeE2eContext,
} from "./support/assets-tree-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { mockAssetsTree } from "./data/assets-tree.mock";

describe("Assets Tree POST (e2e, NATS)", () => {
  let context: AssetsTreeE2eContext;

  beforeAll(async () => {
    context = await setupAssetsTreeE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownAssetsTreeE2eContext(context);
    }
  });

  it("creates an assets tree record successfully", async () => {
    const response = await createAssetsTreeRecord(context, {
      assetCode: "AST-005",
      unit: "New System",
      subunit: "New Subunit",
      maintainableItem: "New Item",
      sparePartCode: "SP-NEW-001",
      sparePartName: "New Spare Part",
    });

    expect(response.assetsTree).toBeDefined();
    expect(response.assetsTree.id).toBeDefined();
    expect(response.assetsTree.assetCode).toBe("AST-005");
    expect(response.assetsTree.unit).toBe("New System");
    expect(response.assetsTree.subunit).toBe("New Subunit");
    expect(response.assetsTree.maintainableItem).toBe("New Item");
    expect(response.assetsTree.sparePartCode).toBe("SP-NEW-001");
    expect(response.assetsTree.sparePartName).toBe("New Spare Part");
    expect(response.assetsTree.isActive).toBe("Y");
    expect(response.assetsTree.createdBy).toBe(context.actor.id);
    expect(response.assetsTree.createdByName).toBe(context.actor.username);
  });

  it("rejects when assetCode does not exist", async () => {
    await assertRpcError(
      createAssetsTreeRecord(context, {
        assetCode: "NON-EXISTENT-ASSET",
      }),
      404,
      "not found",
    );
  });

  it("rejects when required field is missing", async () => {
    await assertRpcError(
      createAssetsTreeRecord(context, {
        unit: undefined,
      }),
      400,
    );
  });

  it("rejects when assetCode is missing", async () => {
    await assertRpcError(
      createAssetsTreeRecord(context, {
        assetCode: undefined,
      }),
      400,
    );
  });

  it("rejects when sparePartCode is missing", async () => {
    await assertRpcError(
      createAssetsTreeRecord(context, {
        sparePartCode: undefined,
      }),
      400,
    );
  });

  it("rejects when field exceeds max length", async () => {
    await assertRpcError(
      createAssetsTreeRecord(context, {
        unit: "A".repeat(371),
      }),
      400,
    );
  });

  it("rejects when sparePartCode exceeds max length", async () => {
    await assertRpcError(
      createAssetsTreeRecord(context, {
        sparePartCode: "S".repeat(256),
      }),
      400,
    );
  });

  it("rejects duplicate combination of assetCode, unit, subunit, maintainableItem and sparePartCode", async () => {
    await assertRpcError(
      createAssetsTreeRecord(context, {
        assetCode: mockAssetsTree[0].assetCode,
        unit: mockAssetsTree[0].unit,
        subunit: mockAssetsTree[0].subunit,
        maintainableItem: mockAssetsTree[0].maintainableItem,
        sparePartCode: mockAssetsTree[0].sparePartCode,
        sparePartName: mockAssetsTree[0].sparePartName,
      }),
      400,
      "already exists",
    );
  });

  it("allows same assetCode with different unit", async () => {
    const response = await createAssetsTreeRecord(context, {
      assetCode: "AST-001",
      unit: "Different Unit",
      subunit: "Different Subunit",
      maintainableItem: "Different Item",
      sparePartCode: "SP-DIFF-001",
      sparePartName: "Different Spare",
    });

    expect(response.assetsTree).toBeDefined();
    expect(response.assetsTree.assetCode).toBe("AST-001");
    expect(response.assetsTree.unit).toBe("Different Unit");
  });

  it("allows same unit with different subunit", async () => {
    const response = await createAssetsTreeRecord(context, {
      assetCode: "AST-002",
      unit: "Different Unit 2",
      subunit: "Different Subunit 2",
      maintainableItem: "Different Item 2",
      sparePartCode: "SP-DIFF-002",
      sparePartName: "Different Spare 2",
    });

    expect(response.assetsTree).toBeDefined();
    expect(response.assetsTree.assetCode).toBe("AST-002");
  });

  it("allows same combination with different sparePartCode", async () => {
    const response = await createAssetsTreeRecord(context, {
      assetCode: "AST-001",
      unit: mockAssetsTree[0].unit,
      subunit: mockAssetsTree[0].subunit,
      maintainableItem: mockAssetsTree[0].maintainableItem,
      sparePartCode: "SP-HYD-002",
      sparePartName: "Different Spare Part Code",
    });

    expect(response.assetsTree).toBeDefined();
    expect(response.assetsTree.sparePartCode).toBe("SP-HYD-002");
  });
});
