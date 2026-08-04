import { PrismaClient } from 'generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaMssql } from '@prisma/adapter-mssql';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      adapter: new PrismaMssql(process.env.DATABASE_URL!),
    });
  }
}
