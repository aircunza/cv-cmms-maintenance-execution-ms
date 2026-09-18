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

describe("Assets Tree PATCH (e2e, NATS)", () => {
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

  describe("update", () => {
    it("updates an assets tree record successfully", async () => {
      const response = await sendPattern(context.client, "assets.tree.update", {
        id: +mockIds[0],
        unit: "Updated System",
        sparePartName: "Updated Spare Part",
        actorId: context.actor.id,
        actorName: context.actor.username,
      });

      expect(response.assetsTree).toBeDefined();
      expect(response.assetsTree.id).toBe(mockIds[0]);
      expect(response.assetsTree.unit).toBe("Updated System");
      expect(response.assetsTree.sparePartName).toBe("Updated Spare Part");
      expect(response.assetsTree.updatedBy).toBe(context.actor.id);
      expect(response.assetsTree.updatedByName).toBe(context.actor.username);
      expect(response.assetsTree.updatedAt).toBeDefined();
    });

    it("updates assetCode to another valid asset", async () => {
      const response = await sendPattern(context.client, "assets.tree.update", {
        id: +mockIds[0],
        assetCode: "AST-005",
        actorId: context.actor.id,
        actorName: context.actor.username,
      });

      expect(response.assetsTree).toBeDefined();
      expect(response.assetsTree.assetCode).toBe("AST-005");
    });

    it("rejects update when record not found", async () => {
      await assertRpcError(
        sendPattern(context.client, "assets.tree.update", {
          id: 999999,
          unit: "Non-existent",
          actorId: context.actor.id,
          actorName: context.actor.username,
        }),
        404,
        "not found",
      );
    });

    it("rejects update when new assetCode does not exist", async () => {
      await assertRpcError(
        sendPattern(context.client, "assets.tree.update", {
          id: +mockIds[0],
          assetCode: "NON-EXISTENT-ASSET",
          actorId: context.actor.id,
          actorName: context.actor.username,
        }),
        404,
        "not found",
      );
    });

    it("rejects update when new combination already exists", async () => {
      await assertRpcError(
        sendPattern(context.client, "assets.tree.update", {
          id: +mockIds[0],
          assetCode: mockAssetsTree[2].assetCode,
          unit: mockAssetsTree[2].unit,
          subunit: mockAssetsTree[2].subunit,
          maintainableItem: mockAssetsTree[2].maintainableItem,
          sparePartCode: mockAssetsTree[2].sparePartCode,
          actorId: context.actor.id,
          actorName: context.actor.username,
        }),
        400,
        "already exists",
      );
    });

    it("rejects update when field exceeds max length", async () => {
      await assertRpcError(
        sendPattern(context.client, "assets.tree.update", {
          id: +mockIds[0],
          unit: "A".repeat(371),
          actorId: context.actor.id,
          actorName: context.actor.username,
        }),
        400,
      );
    });
  });

  describe("deactivate", () => {
    it("deactivates an assets tree record successfully", async () => {
      const response = await sendPattern(
        context.client,
        "assets.tree.deactivate",
        {
          id: +mockIds[1],
          actorId: context.actor.id,
          actorName: context.actor.username,
        },
      );

      expect(response.assetsTree).toBeDefined();
      expect(response.assetsTree.id).toBe(mockIds[1]);
      expect(response.assetsTree.isActive).toBe("N");
      expect(response.assetsTree.updatedBy).toBe(context.actor.id);
      expect(response.assetsTree.updatedByName).toBe(context.actor.username);
      expect(response.assetsTree.updatedAt).toBeDefined();
    });

    it("rejects deactivate when record not found", async () => {
      await assertRpcError(
        sendPattern(context.client, "assets.tree.deactivate", {
          id: 999999,
          actorId: context.actor.id,
          actorName: context.actor.username,
        }),
        404,
        "not found",
      );
    });
  });
});
