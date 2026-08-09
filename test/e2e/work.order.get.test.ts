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
      workOrderDescription: "GET E2E WO Alpha",
      workOrderSubType: "Preventive",
    });

    secondWo = await createWorkOrder(context, {
      workOrderDescription: "GET E2E WO Beta",
      workOrderSubType: "Preventive",
    });
  });

  afterAll(async () => {
    if (context) {
      await teardownWorkOrderE2eContext(context);
    }
  });

  // ==================== FIND ONE ====================

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

  it("returns 404 when work order does not exist", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.one", {
        workOrderCode: "999999",
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
      }),
      404,
      "Work order not found",
    );
  });

  it("rejects find.one when workOrderCode is missing -> 400", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.one", {
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
      }),
      400,
    );
  });

  it("rejects find.one when organizationCode is missing -> 400", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.one", {
        workOrderCode: createdWo.workOrder.workOrderCode,
        userRoles: context.userRoles,
      }),
      400,
      "organizationCode should not be empty",
    );
  });

  it("rejects find.one when subtype not authorized for role -> 403 SUBTYPE_NOT_ALLOWED_FOR_ROLE", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.one", {
        workOrderCode: createdWo.workOrder.workOrderCode,
        organizationCode: context.organizationCode,
        userRoles: ["TECHNICIAN_MAINTENANCE_01"],
      }),
      403,
      "SUBTYPE_NOT_ALLOWED_FOR_ROLE",
    );
  });

  it("rejects find.one when userRoles is missing -> 400", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.one", {
        workOrderCode: createdWo.workOrder.workOrderCode,
        organizationCode: context.organizationCode,
      }),
      400,
      "userRoles must be an array",
    );
  });

  it("rejects access when organization does not match -> 403 ORGANIZATION_MISMATCH", async () => {
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

  // ==================== FIND ALL - FILTERS / OPERATORS ====================

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

  it("filters with eq on workOrderCode (BigInt)", async () => {
    const response = await sendPattern(context.client, "work.order.find.all", {
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      filters: [
        {
          field: "workOrderCode",
          operator: "eq",
          value: createdWo.workOrder.workOrderCode,
        },
      ],
    });

    expect(response.total).toBe(1);
    expect(response.workOrders[0].workOrderCode).toBe(
      createdWo.workOrder.workOrderCode,
    );
  });

  it("filters with like on workOrderDescription", async () => {
    const response = await sendPattern(context.client, "work.order.find.all", {
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      filters: [
        { field: "workOrderDescription", operator: "like", value: "Alpha" },
      ],
    });

    expect(response.total).toBeGreaterThanOrEqual(1);
    for (const wo of response.workOrders) {
      expect(wo.workOrderDescription).toContain("Alpha");
    }
  });

  it("filters with gt on createdAt", async () => {
    const response = await sendPattern(context.client, "work.order.find.all", {
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      filters: [
        {
          field: "createdAt",
          operator: "gt",
          value: "2020-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(response.total).toBeGreaterThanOrEqual(1);
  });

  it("filters with lt on createdAt", async () => {
    const response = await sendPattern(context.client, "work.order.find.all", {
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      filters: [
        {
          field: "createdAt",
          operator: "lt",
          value: "2099-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(response.total).toBeGreaterThanOrEqual(2);
  });

  it("filters with in on woStatusCode", async () => {
    const response = await sendPattern(context.client, "work.order.find.all", {
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      filters: [
        { field: "woStatusCode", operator: "in", value: ["UNRELEASED"] },
      ],
    });

    expect(response.total).toBeGreaterThanOrEqual(2);
    for (const wo of response.workOrders) {
      expect(wo.woStatusCode).toBe("UNRELEASED");
    }
  });

  it("supports legacy field woStatusCode", async () => {
    const response = await sendPattern(context.client, "work.order.find.all", {
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      woStatusCode: "UNRELEASED",
    });

    expect(response.total).toBeGreaterThanOrEqual(2);
    for (const wo of response.workOrders) {
      expect(wo.woStatusCode).toBe("UNRELEASED");
    }
  });

  it("supports legacy field workOrderType", async () => {
    const response = await sendPattern(context.client, "work.order.find.all", {
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      workOrderType: "Planned",
    });

    expect(response.total).toBeGreaterThanOrEqual(1);
    for (const wo of response.workOrders) {
      expect(wo.workOrderType).toBe("Planned");
    }
  });

  // ==================== FIND ALL - VALIDATIONS ====================

  it("rejects find.all when organizationCode is missing -> 400", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.all", {
        userRoles: context.userRoles,
      }),
      400,
      "organizationCode is required",
    );
  });

  it("rejects find.all when userRoles is missing -> 400", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.all", {
        organizationCode: context.organizationCode,
      }),
      400,
      "userRoles must be a non-empty array",
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

  it("rejects filter with unsupported field -> 400 Invalid filter data", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.all", {
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        filters: [{ field: "bogusField", operator: "eq", value: "x" }],
      }),
      400,
      "Invalid filter data",
    );
  });

  it("rejects filter with unsupported operator -> 400 Invalid filter data", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.all", {
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        filters: [
          { field: "organizationCode", operator: "equals", value: "x" },
        ],
      }),
      400,
      "Invalid filter data",
    );
  });

  it("rejects malformed order -> 400 Invalid filter data", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.all", {
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        order: [["bogusField", "DESC"]],
      }),
      400,
      "Invalid filter data",
    );
  });

  it("rejects negative limit -> 400", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.all", {
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        limit: -1,
      }),
      400,
    );
  });

  it("rejects non-integer offset -> 400", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.all", {
        organizationCode: context.organizationCode,
        userRoles: context.userRoles,
        offset: 1.5,
      }),
      400,
    );
  });

  it("rejects subtype not authorized for role -> 403 SUBTYPE_NOT_ALLOWED_FOR_ROLE", async () => {
    await assertRpcError(
      sendPattern(context.client, "work.order.find.all", {
        organizationCode: context.organizationCode,
        userRoles: ["TECHNICIAN_MAINTENANCE_01"],
        filters: [
          { field: "workOrderSubType", operator: "eq", value: "Preventive" },
        ],
      }),
      403,
      "SUBTYPE_NOT_ALLOWED_FOR_ROLE",
    );
  });

  // ==================== FIND ALL - RESPONSE SEMANTICS ====================

  it("returns empty result set when no records match", async () => {
    const response = await sendPattern(context.client, "work.order.find.all", {
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
      filters: [
        { field: "woStatusCode", operator: "eq", value: "NONEXISTENT_STATUS" },
      ],
    });

    expect(response.workOrders).toHaveLength(0);
    expect(response.total).toBe(0);
  });

  it("returns default order createdAt DESC when no order provided", async () => {
    const response = await sendPattern(context.client, "work.order.find.all", {
      organizationCode: context.organizationCode,
      userRoles: context.userRoles,
    });

    expect(response.total).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < response.workOrders.length; i++) {
      const prev = new Date(response.workOrders[i - 1].createdAt).getTime();
      const curr = new Date(response.workOrders[i].createdAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });
});
