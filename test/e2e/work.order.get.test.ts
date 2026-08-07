import {
  assertRpcError,
  createWorkOrder,
  sendPattern,
  setupWorkOrderE2eContext,
  teardownWorkOrderE2eContext,
  type WorkOrderE2eContext,
} from "./support/work-order-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WO GET (e2e, NATS)", () => {
  let context: WorkOrderE2eContext;
  let createdWo: any;
  let secondWo: any;

  beforeAll(async () => {
    context = await setupWorkOrderE2eContext();

    createdWo = await createWorkOrder(context, {
      workOrderDescription: "GET Test WO Alpha",
      workOrderSubType: "Preventive",
    });

    secondWo = await createWorkOrder(context, {
      workOrderDescription: "GET Test WO Beta",
      workOrderSubType: "Preventive",
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  it("returns a work order by code including nested data", async () => {
    const response = await sendPattern(context.client, "work.order.find.one", {
      workOrderCode: createdWo.workOrder.workOrderCode,
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
    });

    expect(response.workOrder).toBeDefined();
    expect(response.workOrder.workOrderCode).toBe(
      createdWo.workOrder.workOrderCode,
    );
    expect(response.workOrder.organizationCode).toBe(context.organizationCode);
    expect(response.workOrder.woStatusLabel).toBe("Unreleased");
    expect(
      response.workOrder.operations[0].workOrderOperationResource,
    ).toBeDefined();
    expect(
      response.workOrder.operations[0].workOrderOperationMaterial,
    ).toBeDefined();
  });

  it("returns work orders using filters, order and pagination", async () => {
    const response = await sendPattern(context.client, "work.order.find.all", {
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      filters: [
        {
          field: "organizationCode",
          operator: "eq",
          value: context.organizationCode,
        },
        { field: "workOrderSubType", operator: "eq", value: "Preventive" },
      ],
      order: [["createdAt", "DESC"]],
      limit: 1,
      offset: 0,
    });

    expect(response.total).toBeGreaterThanOrEqual(1);
    expect(response.workOrders).toHaveLength(1);
    expect(response.workOrders[0].organizationCode).toBe(
      context.organizationCode,
    );
  });

  it("rejects invalid filter data", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.all", {
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        filters: { field: "woStatusCode", operator: "eq", value: "RELEASED" },
      }),
      400,
      "Invalid filter data",
    );
  });

  it("rejects access when organization does not match", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.one", {
        workOrderCode: createdWo.workOrder.workOrderCode,
        organizationCode: "OTHER-ORG",
        userRoles: context.userRoles,
      }),
      403,
      "ORGANIZATION_MISMATCH",
    );
  });
});
