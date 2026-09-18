import {
  assertRpcError,
  createAssetsTreeRecord,
  getMockAssetsTreeIds,
  sendPattern,
  setupAssetsTreeE2eContext,
  teardownAssetsTreeE2eContext,
  type AssetsTreeE2eContext,
} from "./support/assets-tree-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { mockAssetsTree } from "./data/assets-tree.mock";

describe("Assets Tree GET (e2e, NATS)", () => {
  let context: AssetsTreeE2eContext;
  let mockIds: string[];

  beforeAll(async () => {
    context = await setupAssetsTreeE2eContext();
    mockIds = await getMockAssetsTreeIds(context);
  });

  afterAll(async () => {
    if (context) {
      await teardownAssetsTreeE2eContext(context);
    }
  });

  describe("find.one", () => {
    it("finds an assets tree record by id", async () => {
      const response = await sendPattern(
        context.client,
        "assets.tree.find.one",
        { id: +mockIds[0] },
      );

      expect(response.assetsTree).toBeDefined();
      expect(response.assetsTree.id).toBe(mockIds[0]);
      expect(response.assetsTree.assetCode).toBe(mockAssetsTree[0].assetCode);
      expect(response.assetsTree.unit).toBe(mockAssetsTree[0].unit);
      expect(response.assetsTree.subunit).toBe(mockAssetsTree[0].subunit);
      expect(response.assetsTree.maintainableItem).toBe(mockAssetsTree[0].maintainableItem);
      expect(response.assetsTree.sparePartCode).toBe(mockAssetsTree[0].sparePartCode);
      expect(response.assetsTree.sparePartName).toBe(mockAssetsTree[0].sparePartName);
      expect(response.assetsTree.isActive).toBe("Y");
    });

    it("returns 404 when record not found", async () => {
      await assertRpcError(
        sendPattern(context.client, "assets.tree.find.one", { id: 999999 }),
        404,
        "not found",
      );
    });
  });

  describe("find.all", () => {
    it("returns all assets tree records from mock", async () => {
      const response = await sendPattern(
        context.client,
        "assets.tree.find.all",
        {},
      );

      expect(response.assetsTree).toBeDefined();
      expect(Array.isArray(response.assetsTree)).toBe(true);
      expect(response.assetsTree.length).toBe(mockAssetsTree.length);
      expect(response.total).toBe(mockAssetsTree.length);
    });

    it("filters by assetCode and returns correct count", async () => {
      const response = await sendPattern(
        context.client,
        "assets.tree.find.all",
        { assetCode: "AST-001" },
      );

      expect(response.assetsTree).toBeDefined();
      expect(Array.isArray(response.assetsTree)).toBe(true);

      const ast001Count = mockAssetsTree.filter(m => m.assetCode === "AST-001").length;
      expect(response.assetsTree.length).toBe(ast001Count);

      for (const record of response.assetsTree) {
        expect(record.assetCode).toBe("AST-001");
      }
    });

    it("returns empty array when no records match filter", async () => {
      const response = await sendPattern(
        context.client,
        "assets.tree.find.all",
        { assetCode: "NON-EXISTENT-ASSET" },
      );

      expect(response.assetsTree).toBeDefined();
      expect(Array.isArray(response.assetsTree)).toBe(true);
      expect(response.assetsTree.length).toBe(0);
      expect(response.total).toBe(0);
    });
  });
});
