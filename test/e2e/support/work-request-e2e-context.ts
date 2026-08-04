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

(BigInt.prototype as any).toJSON = function toJSON() {
  return this.toString();
};

export type WorkRequestE2eContext = {
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
};

export async function setupWorkRequestE2eContext(): Promise<WorkRequestE2eContext> {
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
  };
}

export async function teardownWorkRequestE2eContext(
  context: WorkRequestE2eContext,
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

export async function createWorkRequest(
  context: WorkRequestE2eContext,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(context.client, "work.request.create", {
    assetCode: "E2E_WR_AST_001",
    issueDescription: `E2E issue ${Date.now()}-${Math.random()}`,
    actorId: context.actor.id,
    actorName: context.actor.username,
    ...overrides,
  });
}
