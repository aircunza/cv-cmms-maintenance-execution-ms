import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import {
  setupWorkDefinitionE2eContext,
  teardownWorkDefinitionE2eContext,
  sendPattern,
  assertRpcError,
  defaultWorkDefinitionPayload,
  type WorkDefinitionE2eContext,
} from "./support/work-definition-e2e-context";

let context: WorkDefinitionE2eContext;

beforeAll(async () => {
  context = await setupWorkDefinitionE2eContext();
});

afterAll(async () => {
  await teardownWorkDefinitionE2eContext(context);
});

beforeEach(async () => {
  await context.prisma.mntWorkDefinition.deleteMany({});
});

describe("Work Definition Find", () => {
  describe("findOne", () => {
    it("finds a work definition by code", async () => {
      const created = await sendPattern<any>(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-FIND-001",
          workDefinitionDescription: "Find test definition",
        }),
      );

      const result = await sendPattern<any>(
        context.client,
        "work.definition.find.one",
        {
          workDefinitionCode: "WD-FIND-001",
          userRoles: context.userRoles,
        },
      );

      expect(result.workDefinition).toBeDefined();
      expect(result.workDefinition.workDefinitionCode).toBe("WD-FIND-001");
      expect(result.workDefinition.workDefinitionDescription).toBe(
        "Find test definition",
      );
      expect(result.workDefinition.isActive).toBe("Y");
    });

    it("returns 404 when work definition code does not exist", async () => {
      await assertRpcError(
        sendPattern(context.client, "work.definition.find.one", {
          workDefinitionCode: "WD-NOT-EXISTS",
          userRoles: context.userRoles,
        }),
        404,
        "Work definition not found",
      );
    });
  });

  describe("findAll", () => {
    it("returns all work definitions", async () => {
      await sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-ALL-001",
          workDefinitionDescription: "Definition one",
        }),
      );
      await sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-ALL-002",
          workDefinitionDescription: "Definition two",
        }),
      );

      const result = await sendPattern<any>(
        context.client,
        "work.definition.find.all",
        {
          userRoles: context.userRoles,
        },
      );

      expect(result.workDefinitions).toBeDefined();
      expect(result.workDefinitions.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it("supports eq filter on isActive", async () => {
      await sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-EQ-001",
          workDefinitionDescription: "Active definition",
        }),
      );

      const result = await sendPattern<any>(
        context.client,
        "work.definition.find.all",
        {
          userRoles: context.userRoles,
          filters: [{ field: "isActive", operator: "eq", value: "Y" }],
        },
      );

      expect(result.workDefinitions.length).toBe(1);
      expect(result.workDefinitions[0].isActive).toBe("Y");
    });

    it("supports like filter on workDefinitionDescription", async () => {
      await sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-LIKE-001",
          workDefinitionDescription: "Hydraulic pump maintenance",
        }),
      );
      await sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-LIKE-002",
          workDefinitionDescription: "Electrical inspection",
        }),
      );

      const result = await sendPattern<any>(
        context.client,
        "work.definition.find.all",
        {
          userRoles: context.userRoles,
          filters: [
            {
              field: "workDefinitionDescription",
              operator: "like",
              value: "Hydraulic",
            },
          ],
        },
      );

      expect(result.workDefinitions.length).toBe(1);
      expect(result.workDefinitions[0].workDefinitionCode).toBe("WD-LIKE-001");
    });

    it("supports in filter on workDefinitionCode", async () => {
      await sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-IN-001",
          workDefinitionDescription: "Def 1",
        }),
      );
      await sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-IN-002",
          workDefinitionDescription: "Def 2",
        }),
      );
      await sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-IN-003",
          workDefinitionDescription: "Def 3",
        }),
      );

      const result = await sendPattern<any>(
        context.client,
        "work.definition.find.all",
        {
          userRoles: context.userRoles,
          filters: [
            {
              field: "workDefinitionCode",
              operator: "in",
              value: ["WD-IN-001", "WD-IN-003"],
            },
          ],
        },
      );

      expect(result.workDefinitions.length).toBe(2);
    });

    it("supports pagination with limit and offset", async () => {
      for (let i = 1; i <= 5; i++) {
        await sendPattern(
          context.client,
          "work.definition.create",
          defaultWorkDefinitionPayload(context, {
            workDefinitionCode: `WD-PAGE-${String(i).padStart(3, "0")}`,
            workDefinitionDescription: `Definition ${i}`,
          }),
        );
      }

      const result = await sendPattern<any>(
        context.client,
        "work.definition.find.all",
        {
          userRoles: context.userRoles,
          limit: 2,
          offset: 0,
        },
      );

      expect(result.workDefinitions.length).toBe(2);
      expect(result.total).toBe(5);
    });

    it("supports ordering", async () => {
      await sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-ORD-A",
          workDefinitionDescription: "Alpha",
        }),
      );
      await sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "WD-ORD-Z",
          workDefinitionDescription: "Zeta",
        }),
      );

      const result = await sendPattern<any>(
        context.client,
        "work.definition.find.all",
        {
          userRoles: context.userRoles,
          order: [["workDefinitionCode", "ASC"]],
        },
      );

      expect(result.workDefinitions[0].workDefinitionCode).toBe("WD-ORD-A");
      expect(result.workDefinitions[1].workDefinitionCode).toBe("WD-ORD-Z");
    });

    it("rejects invalid filter field", async () => {
      await assertRpcError(
        sendPattern(context.client, "work.definition.find.all", {
          userRoles: context.userRoles,
          filters: [
            { field: "nonExistentField", operator: "eq", value: "test" },
          ],
        }),
        400,
        "Invalid filter data",
      );
    });
  });
});
