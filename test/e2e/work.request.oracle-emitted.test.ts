import { mockAssets } from "./data-private-mocks/mnt.assets.mock";
import {
  setupOracleFusionE2eContext,
  subscribeToEvent,
  teardownOracleFusionE2eContext,
  sendPattern,
  type OracleFusionE2eContext,
} from "./support/oracle-fusion-e2e-context";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

describe("WR Oracle Fusion Event (e2e, NATS)", () => {
  let context: OracleFusionE2eContext;

  const oracleWrPermissions = [
    "mnt.work.request.create",
    "mnt.work.orders.create",
    "oracle.mnt.work.orders.create",
  ];

  const oracleWrRoles = ["MANUFACTURING_FACILITATOR"];

  beforeAll(async () => {
    context = await setupOracleFusionE2eContext();
  });

  afterAll(async () => {
    if (context) {
      await teardownOracleFusionE2eContext(context);
    }
  });

  it("emits work.order.created event when creating a work request with enableOracleWorkOrder=Y", async () => {
    const eventPromise = subscribeToEvent(
      context.natsConnection,
      "work.order.created",
    );

    const response = await sendPattern(context.client, "work.request.create", {
      assetCode: mockAssets[0].assetCode,
      issueDescription: "E2E Oracle Fusion WR Test",
      enableOracleWorkOrder: "Y",
      actorId: context.actor.id,
      actorName: context.actor.username,
      organizationCode: context.organizationCode,
      userPermissions: oracleWrPermissions,
      userRoles: oracleWrRoles,
    });

    expect(response.workRequest).toBeDefined();
    expect(response.workRequest.requestId).toBeDefined();
    expect(response.workOrder).toBeDefined();
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
    expect(payload.WorkOrderDescription).toBe("E2E Oracle Fusion WR Test");
    expect(payload.AssetNumber).toBe(mockAssets[0].assetCode);
    expect(payload.WorkOrderTypeCode).toBe("CORRECTIVE");
    expect(payload.WorkOrderSubTypeCode).toBe("ORA_EMERGENCY");
    expect(payload.WorkOrderPriority).toBe("1");
    expect(payload.WorkOrderStatusCode).toBe("ORA_RELEASED");
    expect(typeof payload.PlannedStartDate).toBe("string");
    expect(payload.PlannedStartDate).toContain("+00:00");

    expect(Array.isArray(payload.WorkOrderOperation)).toBe(true);
    expect(payload.WorkOrderOperation.length).toBe(1);

    const op = payload.WorkOrderOperation[0];
    expect(op.OperationName).toBe("DEFAULT_OPERATION");
    expect(op.OperationSequenceNumber).toBe(1);
    expect(op.OperationDescription).toBe("Auto-generated default operation");
    expect(op.OperationType).toBe("IN_HOUSE");
    expect(op.WorkCenterCode).toBe("DEPARTAMENTO_DE_MANTENIMIENTO");
    expect(op.CountPointOperationFlag).toBe(true);
    expect(typeof op.PlannedStartDate).toBe("string");

    expect(Array.isArray(op.WorkOrderOperationResource)).toBe(true);
    expect(op.WorkOrderOperationResource.length).toBe(1);

    const resource = op.WorkOrderOperationResource[0];

    expect(resource.BasisType).toBe(1);
    expect(resource.ResourceCode).toBe("DEFAULT_RESOURCE");
    expect(resource.UsageRate).toBe(1);
    expect(resource.ResourceSequenceNumber).toBe(1);
    expect(resource.ChargeType).toBe("AUTOMATIC");
    expect(resource.PrincipalFlag).toBe(false);

    const dbWo = await context.prisma.mntWorkOrder.findFirst({
      where: { workOrderCode: BigInt(woCode) },
    });

    expect(dbWo).not.toBeNull();
    expect(dbWo!.enableOracleWorkOrder).toBe("Y");
    expect(dbWo!.workOrderDescription).toBe("E2E Oracle Fusion WR Test");
    expect(dbWo!.assetCode).toBe(mockAssets[0].assetCode);
    expect(dbWo!.woStatusCode).toBe("RELEASED");
  });
});
