import {
  createWorkOrder,
  setupOracleFusionE2eContext,
  subscribeToEvent,
  teardownOracleFusionE2eContext,
  type OracleFusionE2eContext,
} from "./support/oracle-fusion-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WO Oracle Fusion Event (e2e, NATS)", () => {
  let context: OracleFusionE2eContext;

  beforeAll(async () => {
    context = await setupOracleFusionE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownOracleFusionE2eContext(context);
    }
  });

  it("emits work.order.created event with correct Oracle payload when enableOracleWorkOrder=Y", async () => {
    const eventPromise = subscribeToEvent(
      context.natsConnection,
      "work.order.created",
    );

    const response = await createWorkOrder(context);

    expect(response.workOrder).toBeDefined();
    expect(response.workOrder.workOrderCode).toBeDefined();
    expect(response.workOrder.enableOracleWorkOrder).toBe("Y");

    const woCode = Number(response.workOrder.workOrderCode);

    const { data: rawEvent } = await eventPromise;
    const event = rawEvent.data ?? rawEvent;

    expect(event).toBeDefined();
    expect(event.enableOracleWorkOrder).toBe("Y");
    expect(event.workOrderCode).toBe(woCode);

    const payload = event.payload;
    expect(payload).toBeDefined();

    expect(payload.OrganizationCode).toBe(context.organizationCode);
    expect(payload.WorkOrderDescription).toBe("E2E Oracle Fusion Test");
    expect(payload.AssetNumber).toBe("AST-001");
    expect(payload.WorkOrderTypeCode).toBe("PREVENTIVE");
    expect(payload.WorkOrderSubTypeCode).toBe("ORA_PLANNED");
    expect(payload.WorkOrderPriority).toBe("2");
    expect(payload.WorkOrderStatusCode).toBe("ORA_UNRELEASED");
    expect(typeof payload.PlannedStartDate).toBe("string");
    expect(payload.PlannedStartDate).toContain("+00:00");

    expect(Array.isArray(payload.WorkOrderOperation)).toBe(true);
    expect(payload.WorkOrderOperation.length).toBe(1);

    const op = payload.WorkOrderOperation[0];
    expect(op.OperationName).toBe("Lubrication");
    expect(op.OperationSequenceNumber).toBe(10);
    expect(op.OperationDescription).toBe("Lubrication of all components");
    expect(op.OperationType).toBe("IN_HOUSE");
    expect(op.WorkCenterCode).toBe("DEPARTAMENTO_DE_MANTENIMIENTO");
    expect(op.CountPointOperationFlag).toBe(true);
    expect(typeof op.PlannedStartDate).toBe("string");

    expect(Array.isArray(op.WorkOrderOperationResource)).toBe(true);
    expect(op.WorkOrderOperationResource.length).toBe(1);

    const resource = op.WorkOrderOperationResource[0];
    expect(resource.BasisType).toBe(1);
    expect(typeof resource.ResourceCode).toBe("string");
    expect(resource.ResourceCode.length).toBeGreaterThan(0);
    expect(resource.UsageRate).toBe(2);
    expect(resource.ResourceSequenceNumber).toBe(1);
    expect(resource.ChargeType).toBe("AUTOMATIC");
    expect(resource.PrincipalFlag).toBe(false);

    const dbWo = await context.prisma.mntWorkOrder.findFirst({
      where: { workOrderCode: BigInt(woCode) },
    });

    expect(dbWo).not.toBeNull();
    expect(dbWo!.enableOracleWorkOrder).toBe("Y");
    expect(dbWo!.workOrderDescription).toBe("E2E Oracle Fusion Test");
    expect(dbWo!.assetCode).toBe("AST-001");
    expect(dbWo!.woStatusCode).toBe("UNRELEASED");
  });
});
