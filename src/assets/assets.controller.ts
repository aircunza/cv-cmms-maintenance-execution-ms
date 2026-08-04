import { Controller } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { AssetsService } from "./assets.service";

@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @EventPattern("asset.created")
  handleAssetCreated(@Payload() payload: { asset: unknown }) {
    return this.assetsService.handleAssetCreated(payload.asset);
  }

  @EventPattern("asset.updated")
  handleAssetUpdated(@Payload() payload: { asset: unknown }) {
    return this.assetsService.handleAssetUpdated(payload.asset);
  }

  @EventPattern("asset.deactivated")
  handleAssetDeactivated(
    @Payload() payload: { assetCode: string; isActive: string },
  ) {
    return this.assetsService.handleAssetDeactivated(
      payload.assetCode,
      payload.isActive,
    );
  }
}
