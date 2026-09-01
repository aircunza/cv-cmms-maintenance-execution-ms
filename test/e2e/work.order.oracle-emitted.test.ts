import { mockAssets } from "./data-private-mocks/mnt.assets.mock";
import { mockOracleMntMaterials } from "./data-private-mocks/mnt.materials.mock";
import { mockHumanResources } from "./data-private-mocks/hr.mock";
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
    expect(payload.AssetNumber).toBe(mockAssets[0].assetCode);
    expect(payload.WorkOrderTypeCode).toBe("PREVENTIVE");
    expect(payload.WorkOrderSubTypeCode).toBe("ORA_PLANNED");
    expect(payload.WorkOrderPriority).toBe("2");
    expect(payload.WorkOrderStatusCode).toBe("ORA_UNRELEASED");
    expect(typeof payload.PlannedStartDate).toBe("string");
    expect(payload.PlannedStartDate).toContain("+00:00");

    expect(Array.isArray(event.operationCodes)).toBe(true);
    expect(event.operationCodes.length).toBe(1);
    expect(typeof event.operationCodes[0]).toBe("number");

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
    expect(dbWo!.assetCode).toBe(mockAssets[0].assetCode);
    expect(dbWo!.woStatusCode).toBe("UNRELEASED");
  });

  it("emits work.order.created with 2 operations, 2 resources and 2 materials each", async () => {
    const eventPromise = subscribeToEvent(
      context.natsConnection,
      "work.order.created",
    );

    const response = await createWorkOrder(context, {
      workOrderDescription: "E2E Multi-Op Oracle Test",
      operations: [
        {
          operationName: "Lubrication",
          operationDescription: "Lubrication of all components",
          operationSeqNumber: 10,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T08:00:00.000Z",
          actualCompletionDate: "2025-11-21T10:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: mockHumanResources[0].resourceCode,
              resourceSequenceNumber: 1,
              actualHours: 2,
              actualStartDate: "2025-11-21T08:00:00.000Z",
              actualCompletionDate: "2025-11-21T10:00:00.000Z",
            },
            {
              principalFlag: "N",
              resourceCode: mockHumanResources[1].resourceCode,
              resourceSequenceNumber: 1,
              actualHours: 3,
              actualStartDate: "2025-11-21T08:00:00.000Z",
              actualCompletionDate: "2025-11-21T11:00:00.000Z",
            },
          ],
          workOrderOperationMaterial: [
            {
              materialSequenceNumber: 10,
              quantity: 1,
              supplyType: "1",
              materialCode: mockOracleMntMaterials[0].materialCode,
            },
            {
              materialSequenceNumber: 20,
              quantity: 2,
              supplyType: "1",
              materialCode: mockOracleMntMaterials[1].materialCode,
            },
          ],
        },
        {
          operationName: "Inspection",
          operationDescription: "Visual inspection of equipment",
          operationSeqNumber: 20,
          createdBy: context.actor.id,
          operationStatus: "UNRELEASED",
          operationType: "Internal",
          operationSubType: "Preventive",
          actualStartDate: "2025-11-21T11:00:00.000Z",
          actualCompletionDate: "2025-11-21T13:00:00.000Z",
          workOrderOperationResource: [
            {
              principalFlag: "Y",
              resourceCode: mockHumanResources[0].resourceCode,
              resourceSequenceNumber: 1,
              actualHours: 1,
              actualStartDate: "2025-11-21T11:00:00.000Z",
              actualCompletionDate: "2025-11-21T12:00:00.000Z",
            },
            {
              principalFlag: "N",
              resourceCode: mockHumanResources[1].resourceCode,
              resourceSequenceNumber: 1,
              actualHours: 2,
              actualStartDate: "2025-11-21T11:00:00.000Z",
              actualCompletionDate: "2025-11-21T13:00:00.000Z",
            },
          ],
          workOrderOperationMaterial: [
            {
              materialSequenceNumber: 10,
              quantity: 3,
              supplyType: "1",
              materialCode: mockOracleMntMaterials[0].materialCode,
            },
            {
              materialSequenceNumber: 20,
              quantity: 4,
              supplyType: "1",
              materialCode: mockOracleMntMaterials[1].materialCode,
            },
          ],
        },
      ],
    });

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
    expect(payload.WorkOrderDescription).toBe("E2E Multi-Op Oracle Test");
    expect(payload.AssetNumber).toBe(mockAssets[0].assetCode);
    expect(payload.WorkOrderTypeCode).toBe("PREVENTIVE");
    expect(payload.WorkOrderSubTypeCode).toBe("ORA_PLANNED");
    expect(payload.WorkOrderStatusCode).toBe("ORA_UNRELEASED");

    expect(Array.isArray(event.operationCodes)).toBe(true);
    expect(event.operationCodes.length).toBe(2);
    expect(typeof event.operationCodes[0]).toBe("number");
    expect(typeof event.operationCodes[1]).toBe("number");

    expect(Array.isArray(payload.WorkOrderOperation)).toBe(true);
    expect(payload.WorkOrderOperation.length).toBe(2);

    const op1 = payload.WorkOrderOperation[0];
    expect(op1.OperationName).toBe("Lubrication");
    expect(op1.OperationSequenceNumber).toBe(10);
    expect(op1.OperationType).toBe("IN_HOUSE");
    expect(op1.WorkCenterCode).toBe("DEPARTAMENTO_DE_MANTENIMIENTO");
    expect(op1.CountPointOperationFlag).toBe(false);
    expect(op1.WorkOrderOperationResource.length).toBe(2);
    expect(op1.WorkOrderOperationResource[0].ChargeType).toBe("MANUAL");
    expect(op1.WorkOrderOperationResource[1].ChargeType).toBe("MANUAL");
    expect(op1.WorkOrderOperationMaterial.length).toBe(2);
    expect(op1.WorkOrderOperationMaterial[0].MaterialSequenceNumber).toBe(10);
    expect(op1.WorkOrderOperationMaterial[0].Quantity).toBe(1);
    expect(op1.WorkOrderOperationMaterial[0].InventoryItemNumber).toBe(
      mockOracleMntMaterials[0].materialCode,
    );
    expect(op1.WorkOrderOperationMaterial[1].MaterialSequenceNumber).toBe(20);
    expect(op1.WorkOrderOperationMaterial[1].Quantity).toBe(2);
    expect(op1.WorkOrderOperationMaterial[1].InventoryItemNumber).toBe(
      mockOracleMntMaterials[1].materialCode,
    );

    const op2 = payload.WorkOrderOperation[1];
    expect(op2.OperationName).toBe("Inspection");
    expect(op2.OperationSequenceNumber).toBe(20);
    expect(op2.OperationType).toBe("IN_HOUSE");
    expect(op2.CountPointOperationFlag).toBe(true);
    expect(op2.WorkOrderOperationResource.length).toBe(2);
    expect(op2.WorkOrderOperationResource[0].ChargeType).toBe("AUTOMATIC");
    expect(op2.WorkOrderOperationResource[1].ChargeType).toBe("AUTOMATIC");
    expect(op2.WorkOrderOperationMaterial.length).toBe(2);
    expect(op2.WorkOrderOperationMaterial[0].MaterialSequenceNumber).toBe(10);
    expect(op2.WorkOrderOperationMaterial[0].Quantity).toBe(3);
    expect(op2.WorkOrderOperationMaterial[0].InventoryItemNumber).toBe(
      mockOracleMntMaterials[0].materialCode,
    );
    expect(op2.WorkOrderOperationMaterial[1].MaterialSequenceNumber).toBe(20);
    expect(op2.WorkOrderOperationMaterial[1].Quantity).toBe(4);
    expect(op2.WorkOrderOperationMaterial[1].InventoryItemNumber).toBe(
      mockOracleMntMaterials[1].materialCode,
    );

    const dbWo = await context.prisma.mntWorkOrder.findFirst({
      where: { workOrderCode: BigInt(woCode) },
    });

    expect(dbWo).not.toBeNull();
    expect(dbWo!.enableOracleWorkOrder).toBe("Y");
    expect(dbWo!.workOrderDescription).toBe("E2E Multi-Op Oracle Test");
    expect(dbWo!.woStatusCode).toBe("UNRELEASED");
  });
});
