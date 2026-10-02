import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { RpcException } from "@nestjs/microservices";
import { mockUsers } from "../data/users.mock";
import { mockOrganizations } from "../data/organizations.mock";

@Controller()
export class MockAuthController {
  @MessagePattern("user.exists.by.code")
  handleUserExistsByCode(@Payload() payload: { code: string }) {
    const user = mockUsers.find((u) => u.code === payload.code);
    if (!user) {
      throw new RpcException({ status: 404, message: "User not found" });
    }
    return {
      user: {
        id: user.id,
        code: user.code,
        userName: user.username,
      },
    };
  }

  @MessagePattern("organization.exists.by.code")
  handleOrganizationExistsByCode(@Payload() payload: { code: string }) {
    const org = mockOrganizations.find((o) => o.code === payload.code);
    if (!org) {
      throw new RpcException({ status: 404, message: "Organization not found" });
    }
    return {
      organization: {
        code: org.code,
        name: org.name,
        countryCode: "PE",
        countryName: "Peru",
      },
    };
  }
}
