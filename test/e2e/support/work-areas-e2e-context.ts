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
import { mockOrganizations } from "../data/organizations.mock";
import { mockWorkAreas } from "../data/workArea.mock";
import { MockAuthController } from "./mock-auth.controller";

(BigInt.prototype as any).toJSON = function toJSON() {
  return this.toString();
};

export type WorkAreasE2eContext = {
  app: any;
  client: ClientProxy;
  prisma: PrismaService;
  organizationCode: string;
  organizationName: string;
};

export async function setupWorkAreasE2eContext(): Promise<WorkAreasE2eContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [MockAuthController],
  }).compile();

  const prisma = moduleFixture.get(PrismaService);

  await teardownWorkAreasE2eContextData(prisma);
  await setupWorkAreasE2eContextData(prisma);

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
    organizationCode: mockOrganizations[0].code,
    organizationName: mockOrganizations[0].name,
  };
}

async function setupWorkAreasE2eContextData(prisma: PrismaService): Promise<void> {
  for (const org of mockOrganizations) {
    await prisma.organization.upsert({
      where: { code: org.code },
      create: {
        id: org.id,
        code: org.code,
        name: org.name,
        countryCode: "PE",
        countryName: "Peru",
        timezone: "America/Lima",
        isActive: "Y",
      },
      update: {},
    });
  }

  for (const workArea of mockWorkAreas) {
    await prisma.workArea.upsert({
      where: {
        workAreaCode_organizationCode: {
          workAreaCode: workArea.workAreaCode,
          organizationCode: workArea.organizationCode,
        },
      },
      create: {
        id: workArea.workAreaId,
        workAreaCode: workArea.workAreaCode,
        workAreaDescription: workArea.workAreaDescription,
        organizationCode: workArea.organizationCode,
        isActive: "Y",
      },
      update: {},
    });
  }
}
async function teardownWorkAreasE2eContextData(prisma: PrismaService): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.mntAssetsTree.deleteMany({});
    await tx.mntAsset.deleteMany({});
    await tx.workCenter.deleteMany({});
    await tx.workArea.deleteMany({});
  });
}

export async function teardownWorkAreasE2eContext(
  context: WorkAreasE2eContext,
): Promise<void> {
  await teardownWorkAreasE2eContextData(context.prisma);
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
          : /bad request|400|validation|must|should not be empty|must be shorter|already exists/i.test(
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

export function defaultWorkAreaPayload(
  context: WorkAreasE2eContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    workAreaCode: "WA-E2E-001",
    workAreaDescription: "E2E Test Work Area",
    organizationCode: context.organizationCode,
    ...overrides,
  };
}

export async function createWorkAreaRecord(
  context: WorkAreasE2eContext,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  return sendPattern(
    context.client,
    "work.area.create",
    defaultWorkAreaPayload(context, overrides),
  );
}
