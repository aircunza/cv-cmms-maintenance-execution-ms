import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AssetsModule } from "./assets/assets.module";
import { WorkRequestsModule } from "./work-requests/work-requests.module";
import { WorkOrdersModule } from "./work-orders/work-orders.module";
import { WoOperationsModule } from "./wo-operations/wo-operations.module";
import { OperationMaterialsModule } from "./operation-materials/operation-materials.module";
import { OperationHumanResourcesModule } from "./operation-human-resources/operation-human-resources.module";
import { HumanResourcesModule } from "./human-resources/human-resources.module";
import { MicroserviceRpcErrorCaptureLayer } from "./common/microservice-error-layer/microservice-rpc-error-capture.layer";

@Module({
  imports: [
    AssetsModule,
    WorkRequestsModule,
    WorkOrdersModule,
    WoOperationsModule,
    OperationMaterialsModule,
    OperationHumanResourcesModule,
    HumanResourcesModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: MicroserviceRpcErrorCaptureLayer,
    },
  ],
})
export class AppModule {}
