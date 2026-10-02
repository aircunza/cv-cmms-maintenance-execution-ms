import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { AssetsService } from './assets.service';
import {
  AssetIdDto,
  CreateAssetDto,
  DeactivateAssetDto,
  FindAllAssetsDto,
  UpdateAssetDto,
} from './dto';

interface OrganizationEventPayload {
  organization: {
    id: string;
    code: string;
    name: string;
    countryCode: string;
    countryName: string;
    timezone: string;
    offsetMinutes: number | null;
    isActive: string;
  };
}

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @MessagePattern('asset.create')
  create(@Payload() dto: CreateAssetDto) {
    return this.assetsService.create(dto);
  }

  @MessagePattern('asset.find.one')
  findOne(@Payload() dto: AssetIdDto) {
    return this.assetsService.findOne(dto.assetCode);
  }

  @MessagePattern('asset.find.all')
  findAll(@Payload() dto: FindAllAssetsDto = {}) {
    return this.assetsService.findAll(dto);
  }

  @MessagePattern('asset.update')
  update(@Payload() dto: UpdateAssetDto) {
    return this.assetsService.update(dto);
  }

  @MessagePattern('asset.deactivate')
  deactivate(@Payload() dto: DeactivateAssetDto) {
    return this.assetsService.deactivate(dto.assetCode, dto.actorCode);
  }

  @EventPattern('asset.created')
  handleAssetCreated(@Payload() payload: { asset: unknown }) {
    return this.assetsService.handleAssetCreated(payload.asset);
  }

  @EventPattern('asset.updated')
  handleAssetUpdated(@Payload() payload: { asset: unknown }) {
    return this.assetsService.handleAssetUpdated(payload.asset);
  }

  @EventPattern('asset.deactivated')
  handleAssetDeactivated(
    @Payload() payload: { assetCode: string; isActive: string },
  ) {
    return this.assetsService.handleAssetDeactivated(
      payload.assetCode,
      payload.isActive,
    );
  }

  @EventPattern('organization.created')
  async handleOrganizationCreated(
    @Payload() payload: OrganizationEventPayload,
  ) {
    const org = payload.organization;
    await this.assetsService.syncOrganization({
      id: org.id,
      code: org.code,
      name: org.name,
      countryCode: org.countryCode,
      countryName: org.countryName,
      timezone: org.timezone,
      offsetMinutes: org.offsetMinutes,
      isActive: org.isActive,
    });
  }

  @EventPattern('organization.updated')
  async handleOrganizationUpdated(
    @Payload() payload: OrganizationEventPayload,
  ) {
    const org = payload.organization;
    await this.assetsService.updateOrganization({
      id: org.id,
      code: org.code,
      name: org.name,
      countryCode: org.countryCode,
      countryName: org.countryName,
      timezone: org.timezone,
      offsetMinutes: org.offsetMinutes,
      isActive: org.isActive,
    });

    await this.assetsService.syncAssetsByOrganizationCode(org.code, {
      name: org.name,
      countryCode: org.countryCode,
      countryName: org.countryName,
      isActive: org.isActive,
    });
  }

  @EventPattern('organization.deactivated')
  async handleOrganizationDeactivated(
    @Payload() payload: OrganizationEventPayload,
  ) {
    const org = payload.organization;
    await this.assetsService.deactivateOrganization(org.code);

    await this.assetsService.syncAssetsByOrganizationCode(org.code, {
      name: org.name,
      countryCode: org.countryCode,
      countryName: org.countryName,
      isActive: org.isActive,
    });
  }
}
