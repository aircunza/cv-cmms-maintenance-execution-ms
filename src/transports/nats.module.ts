import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NATS_SERVICE, envs } from 'src/config';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: NATS_SERVICE,
        transport: Transport.NATS,
        options: {
          servers: envs.natsServers,
          user: envs.natsUser,
          pass: envs.natsPass,
          maxReconnectAttempts: 10,
          reconnectTimeWait: 2000,
          timeout: 5000,
          pingInterval: 10000,
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class NatsModule {}
