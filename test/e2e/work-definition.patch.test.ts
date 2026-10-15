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

describe("Work Definition Update (isActive toggle)", () => {
  it("deactivates a work definition (Y -> N)", async () => {
    await sendPattern(
      context.client,
      "work.definition.create",
      defaultWorkDefinitionPayload(context, {
        workDefinitionCode: "WD-UPD-001",
        workDefinitionDescription: "To be deactivated",
      }),
    );

    const result = await sendPattern<any>(
      context.client,
      "work.definition.update",
      {
        workDefinitionCode: "WD-UPD-001",
        isActive: "N",
        actorId: context.actor.id,
        actorName: context.actor.username,
        userRoles: context.userRoles,
      },
    );

    expect(result.workDefinition).toBeDefined();
    expect(result.workDefinition.isActive).toBe("N");
    expect(result.workDefinition.workDefinitionCode).toBe("WD-UPD-001");
  });

  it("reactivates a work definition (N -> Y)", async () => {
    await sendPattern(
      context.client,
      "work.definition.create",
      defaultWorkDefinitionPayload(context, {
        workDefinitionCode: "WD-UPD-002",
        workDefinitionDescription: "To be reactivated",
      }),
    );

    await sendPattern(context.client, "work.definition.update", {
      workDefinitionCode: "WD-UPD-002",
      isActive: "N",
      actorId: context.actor.id,
      actorName: context.actor.username,
      userRoles: context.userRoles,
    });

    const result = await sendPattern<any>(
      context.client,
      "work.definition.update",
      {
        workDefinitionCode: "WD-UPD-002",
        isActive: "Y",
        actorId: context.actor.id,
        actorName: context.actor.username,
        userRoles: context.userRoles,
      },
    );

    expect(result.workDefinition.isActive).toBe("Y");
  });

  it("rejects when role is not authorized", async () => {
    await sendPattern(
      context.client,
      "work.definition.create",
      defaultWorkDefinitionPayload(context, {
        workDefinitionCode: "WD-UPD-003",
        workDefinitionDescription: "Unauthorized update",
      }),
    );

    const unauthorizedContext = createWorkDefinitionContext(context, {
      userRoles: ["TECHNICIAN_MAINTENANCE_01"],
    });

    await assertRpcError(
      sendPattern(context.client, "work.definition.update", {
        workDefinitionCode: "WD-UPD-003",
        isActive: "N",
        actorId: context.actor.id,
        actorName: context.actor.username,
        userRoles: unauthorizedContext.userRoles,
      }),
      403,
      "ROLE_NOT_AUTHORIZED",
    );
  });

  it("rejects when work definition code does not exist", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.definition.update", {
        workDefinitionCode: "WD-NOT-EXISTS",
        isActive: "N",
        actorId: context.actor.id,
        actorName: context.actor.username,
        userRoles: context.userRoles,
      }),
      404,
      "Work definition not found",
    );
  });

  it("rejects when isActive is not Y or N", async () => {
    await sendPattern(
      context.client,
      "work.definition.create",
      defaultWorkDefinitionPayload(context, {
        workDefinitionCode: "WD-UPD-004",
        workDefinitionDescription: "Invalid isActive",
      }),
    );

    await assertRpcError(
      sendPattern(context.client, "work.definition.update", {
        workDefinitionCode: "WD-UPD-004",
        isActive: "X",
        actorId: context.actor.id,
        actorName: context.actor.username,
        userRoles: context.userRoles,
      }),
      400,
    );
  });

  it("allows PLANNER_MAINTENANCE_02 role to update", async () => {
    await sendPattern(
      context.client,
      "work.definition.create",
      defaultWorkDefinitionPayload(context, {
        workDefinitionCode: "WD-UPD-005",
        workDefinitionDescription: "Planner 02 update",
      }),
    );

    const plannerContext = createWorkDefinitionContext(context, {
      userRoles: ["PLANNER_MAINTENANCE_02"],
    });

    const result = await sendPattern<any>(
      context.client,
      "work.definition.update",
      {
        workDefinitionCode: "WD-UPD-005",
        isActive: "N",
        actorId: context.actor.id,
        actorName: context.actor.username,
        userRoles: plannerContext.userRoles,
      },
    );

    expect(result.workDefinition.isActive).toBe("N");
  });
});
