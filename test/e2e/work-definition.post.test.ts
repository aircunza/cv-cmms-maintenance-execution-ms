import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import {
  setupWorkDefinitionE2eContext,
  teardownWorkDefinitionE2eContext,
  sendPattern,
  assertRpcError,
  defaultWorkDefinitionPayload,
  createWorkDefinitionContext,
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

describe("Work Definition Create", () => {
  it("creates a work definition with valid data and authorized role", async () => {
    const result = await sendPattern<any>(
      context.client,
      "work.definition.create",
      defaultWorkDefinitionPayload(context),
    );

    expect(result.workDefinition).toBeDefined();
    expect(result.workDefinition.workDefinitionCode).toBeDefined();
    expect(result.workDefinition.workDefinitionDescription).toBeDefined();
    expect(result.workDefinition.isActive).toBe("Y");
    expect(result.workDefinition.workDefinitionId).toBeDefined();
  });

  it("rejects when role is not authorized", async () => {
    const unauthorizedContext = createWorkDefinitionContext(context, {
      userRoles: ["TECHNICIAN_MAINTENANCE_01"],
    });

    await assertRpcError(
      sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(unauthorizedContext),
      ),
      403,
      "ROLE_NOT_AUTHORIZED",
    );
  });

  it("rejects when work definition code already exists", async () => {
    const code = "WD-DUPLICATE-001";

    await sendPattern(
      context.client,
      "work.definition.create",
      defaultWorkDefinitionPayload(context, {
        workDefinitionCode: code,
        workDefinitionDescription: "First definition",
      }),
    );

    await assertRpcError(
      sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: code,
          workDefinitionDescription: "Duplicate definition",
        }),
      ),
      409,
      "Work definition code already exists",
    );
  });

  it("rejects when workDefinitionCode is empty", async () => {
    await assertRpcError(
      sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionCode: "",
        }),
      ),
      400,
    );
  });

  it("rejects when workDefinitionDescription exceeds max length", async () => {
    await assertRpcError(
      sendPattern(
        context.client,
        "work.definition.create",
        defaultWorkDefinitionPayload(context, {
          workDefinitionDescription: "x".repeat(501),
        }),
      ),
      400,
    );
  });

  it("allows PLANNER_MAINTENANCE_02 role", async () => {
    const plannerContext = createWorkDefinitionContext(context, {
      userRoles: ["PLANNER_MAINTENANCE_02"],
    });

    const result = await sendPattern<any>(
      context.client,
      "work.definition.create",
      defaultWorkDefinitionPayload(plannerContext),
    );

    expect(result.workDefinition).toBeDefined();
    expect(result.workDefinition.isActive).toBe("Y");
  });
});
