import {
  assertRpcError,
  createWorkOrder,
  updateWorkOrder,
  defaultUpdatePayload,
  createUpdateContext,
  sendPattern,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/work-order-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WO Update (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let updateCtx: WorkOrderE2eContext;
  let createdWo: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
    updateCtx = createUpdateContext(context);
    createdWo = await createWorkOrder(context, {
      workOrderDescription: "Update E2E WO",
      workOrderSubType: "Preventive",
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  // ==================== UPDATE HAPPY PATH ====================

  it("updates only workOrderDescription and returns full WO with operations", async () => {
    const response = await updateWorkOrder(
      updateCtx,
      createdWo.workOrder.workOrderCode,
      {
        workOrderDescription: "Updated description",
      },
    );

    expect(response.workOrder).toBeDefined();
    expect(response.workOrder.workOrderDescription).toBe("Updated description");
    expect(response.workOrder.workOrderCode).toBe(
      createdWo.workOrder.workOrderCode,
    );
    expect(response.workOrder.operations).toBeDefined();
    expect(response.workOrder.operations.length).toBeGreaterThanOrEqual(1);
  });

  it("updates only workOrderPriority", async () => {
    const response = await updateWorkOrder(
      updateCtx,
      createdWo.workOrder.workOrderCode,
      {
        workOrderPriority: "1",
      },
    );

    expect(response.workOrder.workOrderPriority).toBe("1");
  });

  it("updates multiple fields at once", async () => {
    const response = await updateWorkOrder(
      updateCtx,
      createdWo.workOrder.workOrderCode,
      {
        workOrderDescription: "Multi update",
        workOrderPriority: "3",
      },
    );

    expect(response.workOrder.workOrderDescription).toBe("Multi update");
    expect(response.workOrder.workOrderPriority).toBe("3");
  });

  it("updates workOrderType + workOrderSubType with valid combination", async () => {
    const response = await updateWorkOrder(
      updateCtx,
      createdWo.workOrder.workOrderCode,
      {
        workOrderType: "Planned",
        workOrderSubType: "Corrective",
      },
    );

    expect(response.workOrder.workOrderType).toBe("Planned");
    expect(response.workOrder.workOrderSubType).toBe("Corrective");
  });

  it("does not modify fields not sent (partial update)", async () => {
    const woBefore = await sendPattern(context.client, "work.order.find.one", {
      workOrderCode: createdWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
    });

    await updateWorkOrder(updateCtx, createdWo.workOrder.workOrderCode, {
      workOrderDescription: "Partial update test",
    });

    const woAfter = await sendPattern(context.client, "work.order.find.one", {
      workOrderCode: createdWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
    });

    expect(woAfter.workOrder.workOrderType).toBe(
      woBefore.workOrder.workOrderType,
    );
    expect(woAfter.workOrder.workOrderPriority).toBe(
      woBefore.workOrder.workOrderPriority,
    );
  });

  it("sets updatedBy, updatedByName, updatedAt", async () => {
    const response = await updateWorkOrder(
      updateCtx,
      createdWo.workOrder.workOrderCode,
      {
        workOrderDescription: "Audit test",
      },
    );

    expect(response.workOrder.updatedBy).toBe(updateCtx.actor.id);
    expect(response.workOrder.updatedByName).toBe(updateCtx.actor.username);
    expect(response.workOrder.updatedAt).toBeDefined();
  });

  // ==================== UPDATE PERMISSION / CONTEXT VALIDATIONS ====================

  it("rejects without mnt.work.orders.update permission -> 403 MISSING_PERMISSION", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.update", {
        ...defaultUpdatePayload(updateCtx),
        workOrderCode: createdWo.workOrder.workOrderCode,
        userPermissions: [],
        workOrderDescription: "Should fail",
      }),
      403,
      "MISSING_PERMISSION",
    );
  });

  it("rejects when enableOracleWorkOrder is missing -> 400", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.update", {
        workOrderCode: createdWo.workOrder.workOrderCode,
        organizationCode: context.organizationCode,
        userPermissions: updateCtx.userPermissions,
        userRoles: updateCtx.userRoles,
        actorId: updateCtx.actor.id,
        actorName: updateCtx.actor.username,
        workOrderDescription: "Should fail",
      }),
      400,
      "enableOracleWorkOrder is required",
    );
  });

  it("rejects when enableOracleWorkOrder is not Y/N -> 400", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.update", {
        ...defaultUpdatePayload(updateCtx),
        workOrderCode: createdWo.workOrder.workOrderCode,
        enableOracleWorkOrder: "X",
        workOrderDescription: "Should fail",
      }),
      400,
      "enableOracleWorkOrder is required",
    );
  });

  it("rejects when organizationCode is missing -> 400", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.update", {
        ...defaultUpdatePayload(updateCtx),
        workOrderCode: createdWo.workOrder.workOrderCode,
        organizationCode: "",
        workOrderDescription: "Should fail",
      }),
      400,
      "organizationCode is required",
    );
  });

  // ==================== UPDATE BUSINESS VALIDATIONS ====================

  it("rejects when WO not found -> 404", async () => {
    await assertRpcError(
      updateWorkOrder(updateCtx, 999999, { workOrderDescription: "Not found" }),
      404,
      "Work order not found",
    );
  });

  it("rejects when organization mismatch -> 403 ORGANIZATION_MISMATCH", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.update", {
        ...defaultUpdatePayload(updateCtx),
        workOrderCode: createdWo.workOrder.workOrderCode,
        organizationCode: "OTHER-ORG",
        workOrderDescription: "Should fail",
      }),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });

  it("rejects invalid type/subtype combination -> 400", async () => {
    await assertRpcError(
      updateWorkOrder(updateCtx, createdWo.workOrder.workOrderCode, {
        workOrderType: "Planned",
        workOrderSubType: "Emergency",
      }),
      400,
      "Invalid combination",
    );
  });

  it("rejects subtype not authorized for role -> 403 SUBTYPE_NOT_ALLOWED_FOR_ROLE", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.update", {
        ...defaultUpdatePayload(updateCtx),
        workOrderCode: createdWo.workOrder.workOrderCode,
        userRoles: ["TECHNICIAN_MAINTENANCE_01"],
        workOrderSubType: "Preventive",
      }),
      403,
      "SUBTYPE_NOT_ALLOWED_FOR_ROLE",
    );
  });

  it("rejects invalid workOrderPriority -> 400", async () => {
    await assertRpcError(
      updateWorkOrder(updateCtx, createdWo.workOrder.workOrderCode, {
        workOrderPriority: "5",
      }),
      400,
      "Invalid workOrderPriority",
    );
  });

  it("allows ADMIN to change to any subtype", async () => {
    const adminCtx = createUpdateContext(context, {
      userRoles: ["ADMIN"],
    });

    const response = await sendPattern(context.client, "work.order.update", {
      ...defaultUpdatePayload(adminCtx),
      workOrderCode: createdWo.workOrder.workOrderCode,
      workOrderSubType: "TPM",
    });

    expect(response.workOrder.workOrderSubType).toBe("TPM");
  });
});
