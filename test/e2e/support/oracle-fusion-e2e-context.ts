import { ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  ClientProxy,
  ClientProxyFactory,
  MicroserviceOptions,
  Transport,
} from "@nestjs/microservices";
import { firstValueFrom, timeout } from "rxjs";
import { connect, NatsConnection, StringCodec } from "nats";
import { AppModule } from "src/app.module";
import { envs } from "src/config";
import { PrismaService } from "src/prisma.service";
import { OracleOrganizationContextBuilder } from "../factories/build/OracleOrganizationContextBuilder";
import { mockOrganizations } from "../data-private-mocks/organizations.mock";
import { mockUsers } from "../data-private-mocks/users.mock";
import { mockHumanResources } from "../data-private-mocks/hr.mock";
import { mockAssets } from "../data-private-mocks/mnt.assets.mock";

(BigInt.prototype as any).toJSON = function toJSON() {
  return this.toString();
};

export type OracleFusionE2eContext = {
  app: any;
  client: ClientProxy;
  natsConnection: NatsConnection;
  prisma: PrismaService;
  contextBuilder: OracleOrganizationContextBuilder;
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

export async function setupOracleFusionE2eContext(): Promise<OracleFusionE2eContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const prisma = moduleFixture.get(PrismaService);
  const contextBuilder = new OracleOrganizationContextBuilder(prisma);

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

  const natsServers = Array.isArray(envs.natsServers)
    ? envs.natsServers
    : [envs.natsServers];
  const natsConnection = await connect({
    servers: natsServers,
    user: envs.natsUser,
    pass: envs.natsPass,
  });

  return {
    app,
    client,
    natsConnection,
    prisma,
    contextBuilder,
    organizationCode: mockOrganizations[0].code,
    organizationName: mockOrganizations[0].name,
    actor: mockUsers[0],
    userPermissions: [
      "mnt.work.orders.view",
      "mnt.work.orders.create",
      "oracle.mnt.work.orders.create",
    ],
    userRoles: ["PLANNER_MAINTENANCE_01"],
  };
}

export async function teardownOracleFusionE2eContext(
  context: OracleFusionE2eContext,
): Promise<void> {
  await context.contextBuilder.teardown();
  context.client.close();
  await context.natsConnection.drain();
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

export async function subscribeToEvent(
  nats: NatsConnection,
  subject: string,
): Promise<{ subject: string; data: any }> {
  const sc = StringCodec();
  const sub = nats.subscribe(subject);
  const iter = sub[Symbol.asyncIterator]();
  const { value: msg, done } = await iter.next();
  if (done || !msg) {
    throw new Error(`No message received on subject: ${subject}`);
  }
  const data = JSON.parse(sc.decode(msg.data));
  sub.unsubscribe();
  return { subject: msg.subject, data };
}

export function defaultWoPayload(
  context: OracleFusionE2eContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    actorId: context.actor.id,
    actorName: context.actor.username,
    organizationCode: context.organizationCode,
    userPermissions: context.userPermissions,
    userRoles: context.userRoles,
    enableOracleWorkOrder: "Y",
    workOrderDescription: "E2E Oracle Fusion Test",
    woStatusCode: "UNRELEASED",
    assetCode: mockAssets[0].assetCode,
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
            actualHours: 2,
            actualStartDate: "2025-11-21T08:00:00.000Z",
            actualCompletionDate: "2025-11-21T10:00:00.000Z",
          },
        ],
        workOrderOperationMaterial: [],
      },
    ],
    ...overrides,
  };
}

export async function createWorkOrder(
  context: OracleFusionE2eContext,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(
    context.client,
    "work.order.create",
    defaultWoPayload(context, overrides),
  );
}
