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

describe("WO PATCH & Status Transitions (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let updateCtx: WorkOrderE2eContext;
  let createdWo: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();
    updateCtx = createUpdateContext(context);
    createdWo = await createWorkOrder(context, {
      workOrderDescription: "PATCH Test WO",
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
    const response = await updateWorkOrder(updateCtx, createdWo.workOrder.workOrderCode, {
      workOrderDescription: "Updated description",
    });

    expect(response.workOrder).toBeDefined();
    expect(response.workOrder.workOrderDescription).toBe("Updated description");
    expect(response.workOrder.workOrderCode).toBe(createdWo.workOrder.workOrderCode);
    expect(response.workOrder.operations).toBeDefined();
    expect(response.workOrder.operations.length).toBeGreaterThanOrEqual(1);
  });

  it("updates only workOrderPriority", async () => {
    const response = await updateWorkOrder(updateCtx, createdWo.workOrder.workOrderCode, {
      workOrderPriority: "1",
    });

    expect(response.workOrder.workOrderPriority).toBe("1");
  });

  it("updates multiple fields at once", async () => {
    const response = await updateWorkOrder(updateCtx, createdWo.workOrder.workOrderCode, {
      workOrderDescription: "Multi update",
      workOrderPriority: "3",
    });

    expect(response.workOrder.workOrderDescription).toBe("Multi update");
    expect(response.workOrder.workOrderPriority).toBe("3");
  });

  it("updates workOrderType + workOrderSubType with valid combination", async () => {
    const response = await updateWorkOrder(updateCtx, createdWo.workOrder.workOrderCode, {
      workOrderType: "Planned",
      workOrderSubType: "Corrective",
    });

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

    expect(woAfter.workOrder.workOrderType).toBe(woBefore.workOrder.workOrderType);
    expect(woAfter.workOrder.workOrderPriority).toBe(woBefore.workOrder.workOrderPriority);
  });

  it("sets updatedBy, updatedByName, updatedAt", async () => {
    const response = await updateWorkOrder(updateCtx, createdWo.workOrder.workOrderCode, {
      workOrderDescription: "Audit test",
    });

    expect(response.workOrder.updatedBy).toBe(updateCtx.actor.id);
    expect(response.workOrder.updatedByName).toBe(updateCtx.actor.username);
    expect(response.workOrder.updatedAt).toBeDefined();
  });

  // ==================== UPDATE PERMISSION VALIDATIONS ====================

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

  // ==================== RELEASE ====================

  it("releases WO from UNRELEASED -> RELEASED with releasedDate", async () => {
    const releaseWo = await createWorkOrder(context, {
      workOrderDescription: "Release Test WO",
      workOrderSubType: "Preventive",
    });

    const response = await sendPattern(context.client, "work.order.release", {
      workOrderCode: releaseWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    expect(response.workOrder.woStatusCode).toBe("RELEASED");
    expect(response.workOrder.releasedDate).toBeDefined();
    expect(response.workOrder.operations).toBeDefined();
  });

  it("releases WO from ON_HOLD -> RELEASED", async () => {
    const holdWo = await createWorkOrder(context, {
      workOrderDescription: "Hold Release Test WO",
      workOrderSubType: "Preventive",
    });

    await sendPattern(context.client, "work.order.hold", {
      workOrderCode: holdWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    const response = await sendPattern(context.client, "work.order.release", {
      workOrderCode: holdWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    expect(response.workOrder.woStatusCode).toBe("RELEASED");
  });

  it("allows release from COMPLETED -> RELEASED (per spec)", async () => {
    const completeWo = await createWorkOrder(context, {
      workOrderDescription: "Complete Then Release WO",
      workOrderSubType: "Preventive",
    });

    await sendPattern(context.client, "work.order.release", {
      workOrderCode: completeWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    await sendPattern(context.client, "work.order.complete", {
      workOrderCode: completeWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    const response = await sendPattern(context.client, "work.order.release", {
      workOrderCode: completeWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    expect(response.workOrder.woStatusCode).toBe("RELEASED");
  });

  // ==================== COMPLETE ====================

  it("completes WO from RELEASED -> COMPLETED", async () => {
    const completeWo = await createWorkOrder(context, {
      workOrderDescription: "Complete Test WO",
      workOrderSubType: "Preventive",
    });

    await sendPattern(context.client, "work.order.release", {
      workOrderCode: completeWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    const response = await sendPattern(context.client, "work.order.complete", {
      workOrderCode: completeWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    expect(response.workOrder.woStatusCode).toBe("COMPLETED");
  });

  it("rejects complete from UNRELEASED -> 400", async () => {
    const newWo = await createWorkOrder(context, {
      workOrderDescription: "Complete Reject WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.complete", {
        workOrderCode: newWo.workOrder.workOrderCode,
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        actorId: context.actor.id,
        actorName: context.actor.username,
      }),
      400,
      "Cannot complete",
    );
  });

  // ==================== CLOSE ====================

  it("closes WO from COMPLETED -> CLOSED with closedDate", async () => {
    const closeWo = await createWorkOrder(context, {
      workOrderDescription: "Close Test WO",
      workOrderSubType: "Preventive",
    });

    await sendPattern(context.client, "work.order.release", {
      workOrderCode: closeWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    await sendPattern(context.client, "work.order.complete", {
      workOrderCode: closeWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    const response = await sendPattern(context.client, "work.order.close", {
      workOrderCode: closeWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    expect(response.workOrder.woStatusCode).toBe("CLOSED");
    expect(response.workOrder.closedDate).toBeDefined();
  });

  it("rejects close from RELEASED -> 400", async () => {
    const newWo = await createWorkOrder(context, {
      workOrderDescription: "Close Reject WO",
      workOrderSubType: "Preventive",
    });

    await sendPattern(context.client, "work.order.release", {
      workOrderCode: newWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.close", {
        workOrderCode: newWo.workOrder.workOrderCode,
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        actorId: context.actor.id,
        actorName: context.actor.username,
      }),
      400,
      "Cannot close",
    );
  });

  // ==================== CANCEL ====================

  it("cancels WO from UNRELEASED with canceledReason -> CANCELED, all operations CANCELED", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel Test WO",
      workOrderSubType: "Preventive",
    });

    const response = await sendPattern(context.client, "work.order.cancel", {
      workOrderCode: cancelWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
      canceledReason: "No longer needed",
    });

    expect(response.workOrder.woStatusCode).toBe("CANCELED");
    expect(response.workOrder.canceledDate).toBeDefined();
    expect(response.workOrder.canceledReason).toBe("No longer needed");

    for (const op of response.workOrder.operations) {
      expect(op.operationStatus).toBe("CANCELED");
    }
  });

  it("cancels WO from RELEASED with canceledReason", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel Released WO",
      workOrderSubType: "Preventive",
    });

    await sendPattern(context.client, "work.order.release", {
      workOrderCode: cancelWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    const response = await sendPattern(context.client, "work.order.cancel", {
      workOrderCode: cancelWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
      canceledReason: "Priority changed",
    });

    expect(response.workOrder.woStatusCode).toBe("CANCELED");
    expect(response.workOrder.canceledReason).toBe("Priority changed");
  });

  it("rejects cancel without canceledReason -> 400", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel No Reason WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.cancel", {
        workOrderCode: cancelWo.workOrder.workOrderCode,
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        actorId: context.actor.id,
        actorName: context.actor.username,
        canceledReason: "",
      }),
      400,
      "canceledReason is required",
    );
  });

  it("rejects cancel from CLOSED (terminal) -> 400", async () => {
    const cancelWo = await createWorkOrder(context, {
      workOrderDescription: "Cancel Closed WO",
      workOrderSubType: "Preventive",
    });

    await sendPattern(context.client, "work.order.release", {
      workOrderCode: cancelWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    await sendPattern(context.client, "work.order.complete", {
      workOrderCode: cancelWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    await sendPattern(context.client, "work.order.close", {
      workOrderCode: cancelWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.cancel", {
        workOrderCode: cancelWo.workOrder.workOrderCode,
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        actorId: context.actor.id,
        actorName: context.actor.username,
        canceledReason: "Should fail",
      }),
      400,
      "Cannot cancel",
    );
  });

  // ==================== HOLD ON ====================

  it("puts WO on hold from UNRELEASED -> ON_HOLD", async () => {
    const holdWo = await createWorkOrder(context, {
      workOrderDescription: "Hold Test WO",
      workOrderSubType: "Preventive",
    });

    const response = await sendPattern(context.client, "work.order.hold", {
      workOrderCode: holdWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    expect(response.workOrder.woStatusCode).toBe("ON_HOLD");
  });

  it("puts WO on hold from RELEASED -> ON_HOLD", async () => {
    const holdWo = await createWorkOrder(context, {
      workOrderDescription: "Hold Released WO",
      workOrderSubType: "Preventive",
    });

    await sendPattern(context.client, "work.order.release", {
      workOrderCode: holdWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    const response = await sendPattern(context.client, "work.order.hold", {
      workOrderCode: holdWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    expect(response.workOrder.woStatusCode).toBe("ON_HOLD");
  });

  it("rejects hold from CANCELED (terminal) -> 400", async () => {
    const holdWo = await createWorkOrder(context, {
      workOrderDescription: "Hold Reject WO",
      workOrderSubType: "Preventive",
    });

    await sendPattern(context.client, "work.order.cancel", {
      workOrderCode: holdWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
      canceledReason: "Testing hold rejection",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.hold", {
        workOrderCode: holdWo.workOrder.workOrderCode,
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        actorId: context.actor.id,
        actorName: context.actor.username,
      }),
      400,
      "Cannot put work order on hold",
    );
  });

  // ==================== PENDING APPROVAL ====================

  it("transitions WO from PENDING_APPROVAL -> UNRELEASED", async () => {
    const paWo = await createWorkOrder(context, {
      workOrderDescription: "Pending Approval WO",
      workOrderSubType: "Preventive",
      woStatusCode: "PENDING_APPROVAL",
    });

    const response = await sendPattern(context.client, "work.order.pending-approval", {
      workOrderCode: paWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      actorId: context.actor.id,
      actorName: context.actor.username,
    });

    expect(response.workOrder.woStatusCode).toBe("UNRELEASED");
  });

  it("rejects pending-approval from UNRELEASED -> 400", async () => {
    const paWo = await createWorkOrder(context, {
      workOrderDescription: "Wrong Status WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.pending-approval", {
        workOrderCode: paWo.workOrder.workOrderCode,
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        actorId: context.actor.id,
        actorName: context.actor.username,
      }),
      400,
      "PENDING_APPROVAL",
    );
  });

  // ==================== TENANT ISOLATION IN STATUS ====================

  it("rejects release with different organization -> 403 ORGANIZATION_MISMATCH", async () => {
    const tenantWo = await createWorkOrder(context, {
      workOrderDescription: "Tenant Test WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.release", {
        workOrderCode: tenantWo.workOrder.workOrderCode,
        organizationCode: "OTHER-ORG",
        userRoles: context.userRoles,
        actorId: context.actor.id,
        actorName: context.actor.username,
      }),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });

  it("rejects cancel with different organization -> 403 ORGANIZATION_MISMATCH", async () => {
    const tenantWo = await createWorkOrder(context, {
      workOrderDescription: "Tenant Cancel WO",
      workOrderSubType: "Preventive",
    });

    await assertRpcError(
      sendPattern(context.client, "work.order.cancel", {
        workOrderCode: tenantWo.workOrder.workOrderCode,
        organizationCode: "OTHER-ORG",
        userRoles: context.userRoles,
        actorId: context.actor.id,
        actorName: context.actor.username,
        canceledReason: "Should fail",
      }),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });
});
