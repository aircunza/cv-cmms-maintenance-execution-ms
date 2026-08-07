import { ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  ClientProxy,
  ClientProxyFactory,
  MicroserviceOptions,
  Transport,
} from "@nestjs/microservices";
import { expect } from "@jest/globals";
import { firstValueFrom, timeout } from "rxjs";
import { AppModule } from "src/app.module";
import { envs } from "src/config";
import { PrismaService } from "src/prisma.service";
import { OrganizationContextBuilder } from "../factories/build/OrganizationContextBuilder";
import { mockOrganizations } from "../data/organizations.mock";
import { mockUsers } from "../data/users.mock";
import { mockHumanResources } from "../data/hr.mock";

(BigInt.prototype as any).toJSON = function toJSON() {
  return this.toString();
};

export type WorkOrderE2eContext = {
  app: any;
  client: ClientProxy;
  prisma: PrismaService;
  contextBuilder: OrganizationContextBuilder;
  organizationCode: string;
  organizationName: string;
  actor: {
    id: string;
    code: string;
    username: string;
  };
  userPermissions: string[];
  userRoles: string[];
};

export async function setupWorkOrderE2eContext(): Promise<WorkOrderE2eContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const prisma = moduleFixture.get(PrismaService);
  const contextBuilder = new OrganizationContextBuilder(prisma);

  await contextBuilder.teardown();
  await contextBuilder.setup();

  const app = moduleFixture.createNestMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: envs.natsServers,
      user: envs.natsUser,
      pass: envs.natsPass,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen();

  const client = ClientProxyFactory.create({
    transport: Transport.NATS,
    options: {
      servers: envs.natsServers,
      user: envs.natsUser,
      pass: envs.natsPass,
    },
  });

  await client.connect();
  return {
    app,
    client,
    prisma,
    contextBuilder,
    organizationCode: mockOrganizations[0].code,
    organizationName: mockOrganizations[0].name,
    actor: mockUsers[0],
    userPermissions: ["mnt.work.orders.create"],
    userRoles: ["PLANNER_MAINTENANCE_01"],
  };
}

export async function teardownWorkOrderE2eContext(
  context: WorkOrderE2eContext,
): Promise<void> {
  await context.contextBuilder.teardown();
  context.client.close();
  await context.app.close();
  await context.prisma.$disconnect();
}

export async function sendPattern<T = any>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
): Promise<T> {
  return firstValueFrom(client.send<T>(pattern, payload).pipe(timeout(8000)));
}

export async function assertRpcError(
  operation: Promise<unknown>,
  expectedStatus: number,
  expectedMessage?: string,
): Promise<void> {
  try {
    await operation;
    throw new Error("Expected RPC error, but operation succeeded");
  } catch (error: any) {
    const messageText = Array.isArray(error?.message)
      ? error.message.join(" ")
      : String(error?.message ?? "");

    const numericStatus =
      typeof error?.status === "number"
        ? error.status
        : typeof error?.statusCode === "number"
          ? error.statusCode
          : undefined;

    if (numericStatus !== undefined) {
      expect(numericStatus).toBe(expectedStatus);
    } else {
      const inferredStatus =
        /not found|404/i.test(messageText) ||
        /not found/i.test(String(error?.error ?? ""))
          ? 404
          : /bad request|400|validation|must|should not be empty|must be shorter/i.test(
                messageText,
              )
            ? 400
            : undefined;

      expect(inferredStatus).toBe(expectedStatus);
    }

    if (expectedMessage !== undefined) {
      expect(messageText).toContain(expectedMessage);
    }
  }
}

export function defaultWoPayload(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    actorId: context.actor.id,
    actorName: context.actor.username,
    organizationCode: context.organizationCode,
    userPermissions: context.userPermissions,
    userRoles: context.userRoles,
    enableOracleWorkOrder: "N",
    workOrderDescription: "E2E Work Order Test",
    woStatusCode: "UNRELEASED",
    assetCode: "E2E_WO_AST_001",
    workOrderType: "Planned",
    workOrderSubType: "Preventive",
    workOrderPriority: "2",
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
            plannedHours: 2,
            actualHours: 2,
          },
        ],
        workOrderOperationMaterial: [],
      },
    ],
    ...overrides,
  };
}

export async function createWorkOrder(
  context: WorkOrderE2eContext,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(
    context.client,
    "work.order.create",
    defaultWoPayload(context, overrides),
  );
}
