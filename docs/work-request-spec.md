# Work Request Module

## Communication

All endpoints in this module are accessed via NATS patterns through the gateway.

| Action                 | NATS Pattern            | Gateway Endpoint               |
| ---------------------- | ----------------------- | ------------------------------ |
| Create Work Request    | `work.request.create`   | POST /wo-request               |
| Get Work Request By ID | `work.request.find.one` | GET /wo-request/:id            |
| Get All Work Requests  | `work.request.find.all` | GET /wo-request                |
| Update Description     | `work.request.update`   | PATCH /wo-request/:id          |
| Complete Work Request  | `work.request.complete` | PATCH /wo-request/:id/complete |
| Cancel Work Request    | `work.request.cancel`   | PATCH /wo-request/:id/cancel   |

---

## Create Work Request

### Purpose

Creates a new Work Request and automatically generates an associated Work Order with `workOrderType: "Not Planned"`, `workOrderSubType: "Emergency"`, and `workOrderPriority: "1"`.

### Authentication & Authorization

The endpoint requires:

- **Gateway Auth**: Valid authentication token delegated to the gateway.

#### Gateway-Injected Fields

| Field            | Type     | Source                                                            |
| ---------------- | -------- | ----------------------------------------------------------------- |
| actorId          | string   | User ID from JWT payload                                          |
| actorName        | string   | User name from JWT payload                                        |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userPermissions  | string[] | Permissions from the user's role(s) in the target organization    |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |

#### Role Restriction

Only the **MANUFACTURING_FACILITATOR** role is authorized to create Work Requests.

#### Required Permissions

| Permission                      | Description                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `mnt.work.request.create`       | Required to create a Work Request                                             |
| `mnt.work.orders.create`        | Required to create the associated Work Order                                  |
| `oracle.mnt.work.orders.create` | Required when `enableOracleWorkOrder = "Y"` and Oracle integration is enabled |

#### Oracle Work Order Authorization

When `enableOracleWorkOrder = "Y"` and the system-level `ENABLE_ORACLE_WORK_ORDER_SYSTEM = "Y"`:

- User must have permission `oracle.mnt.work.orders.create`
- User must have one of the allowed Oracle roles: MANUFACTURING_FACILITATOR, TECHNICIAN_MAINTENANCE_01, TECHNICIAN_MAINTENANCE_02, PLANNER_MAINTENANCE_01, PLANNER_MAINTENANCE_02, COORDINATOR_MAINTENANCE_01, COORDINATOR_MAINTENANCE_02, SUPERVISOR_MAINTENANCE_01, SUPERVISOR_MAINTENANCE_02, ADMIN

### Request

#### Required Fields

| Field                 | Type              | Max Length | Description                        |
| --------------------- | ----------------- | ---------- | ---------------------------------- |
| assetCode             | string            | 80         | Asset identifier.                  |
| issueDescription      | string            | 240        | Description of the reported issue. |
| enableOracleWorkOrder | string ("Y"\|"N") | 1          | Flag to enable Oracle integration. |

#### Optional Fields

| Field                 | Type   | Max Length | Description                        |
| --------------------- | ------ | ---------- | ---------------------------------- |
| assetShortDescription | string | 200        | Asset short description.           |
| createdByName         | string | 70         | User name who creates the request. |

#### System Generated Fields

These fields are generated or managed by the system and SHALL NOT be provided when creating a Work Request.

| Field                 | Type    | Length | Description                                            |
| --------------------- | ------- | ------ | ------------------------------------------------------ |
| requestId             | BigInt  | -      | Auto-generated identifier.                             |
| requestedAt           | Date    | -      | Creation timestamp.                                    |
| createdAt             | Date    | -      | Record creation timestamp.                             |
| completedAt           | Date    | -      | Completion timestamp.                                  |
| releasedAt            | Date    | -      | Release timestamp.                                     |
| canceledAt            | Date    | -      | Cancellation timestamp.                                |
| updatedAt             | Date    | -      | Last update timestamp.                                 |
| updatedBy             | string  | -      | Last updated by user.                                  |
| updatedByName         | string  | -      | Last updated by user name.                             |
| statusCode            | string  | 30     | Initial work request status set by system as RELEASED. |
| workCenterCode        | string  | 255    | Work center code.                                      |
| workCenterDescription | string  | 255    | Work center description.                               |
| centerCostCode        | integer | -      | Cost center code.                                      |
| workAreaCode          | string  | 255    | Work area code.                                        |
| workAreaDescription   | string  | 255    | Work area description.                                 |
| sector                | string  | 50     | Sector.                                                |
| subsector             | string  | 50     | Subsector.                                             |
| organizationName      | string  | 255    | Organization name.                                     |
| organizationCode      | string  | 255    | Organization code.                                     |

#### Associated Work Order Fields

When a Work Request is created, the system automatically creates an associated Work Order with the following fixed values:

| Field                 | Value                                              |
| --------------------- | -------------------------------------------------- |
| workOrderDescription  | Same as `issueDescription` from the Work Request   |
| workOrderType         | `"Not Planned"`                                    |
| workOrderSubType      | `"Emergency"`                                      |
| workOrderPriority     | `"1"`                                              |
| woStatusCode          | `"RELEASED"`                                       |
| enableOracleWorkOrder | Same as the Work Request's `enableOracleWorkOrder` |
| operations            | Single default operation with one resource         |

> **Initial data requirement (`DEFAULT_RESOURCE`):** The default operation referenced above uses a single resource with `resourceCode = "DEFAULT_RESOURCE"`. The `mnt_human_resources` table SHALL contain at least one active human resource with `resource_code = 'DEFAULT_RESOURCE'` per environment; without it, creating a Work Request fails with an FK constraint violation when inserting the operation's resource usage.

#### Example Request Payload

```json
{
  "assetCode": "AST-001",
  "issueDescription": "Oil leak detected on the hydraulic pump.",
  "enableOracleWorkOrder": "N",
  "organizationCode": "ORG-BOG-001",
  "userPermissions": ["mnt.work.request.create", "mnt.work.orders.create"],
  "userRoles": ["MANUFACTURING_FACILITATOR"],
  "actorId": "550e8400-e29b-41d4-a716-446655440001",
  "actorName": "John Doe"
}
```

### Validations

**R-WR-CR-01**

The system SHALL require all mandatory fields.

**R-WR-CR-02**

IF any required field is missing,  
THEN the system SHALL reject the request with a 400 status.

**R-WR-CR-03**

IF any required field exceeds the specified maximum number of characters,  
THEN the system SHALL reject the request with a 400 status.

**R-WR-CR-04**

IF `enableOracleWorkOrder` is not "Y" or "N",  
THEN the system SHALL reject the request with a 400 status.

**R-WR-CR-05**

IF `userPermissions` does not include `mnt.work.request.create`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_PERMISSION`.

**R-WR-CR-06**

IF `userPermissions` does not include `mnt.work.orders.create`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_PERMISSION`.

**R-WR-CR-07**

IF `userRoles` does not include `MANUFACTURING_FACILITATOR`,  
THEN the system SHALL reject the request with a 403 status and error code `ROLE_NOT_AUTHORIZED`.

**R-WR-CR-08**

IF `enableOracleWorkOrder = "Y"` and `ENABLE_ORACLE_WORK_ORDER_SYSTEM = "Y"` and `userPermissions` does not include `oracle.mnt.work.orders.create`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_ORACLE_PERMISSION`.

**R-WR-CR-09**

IF the asset does not exist or is inactive,  
THEN the system SHALL reject the request with a 404 status.

**R-WR-CR-10**

IF the asset's `organizationCode` does not match the gateway-injected `organizationCode`,  
THEN the system SHALL reject the request with a 403 status and error code `ORGANIZATION_MISMATCH`.

### Processing

**R-WR-CR-11**

WHEN a valid Work Request creation request is received,  
the system SHALL:

1. Validate all permissions and authorizations
2. Find the asset and validate organization ownership
3. Create the Work Request with `statusCode: "RELEASED"` and `releasedAt: now`
4. Create an associated Work Order with:
   - `workOrderDescription` = `issueDescription` from the Work Request
   - `workOrderType` = `"Not Planned"`
   - `workOrderSubType` = `"Emergency"`
   - `workOrderPriority` = `"1"`
   - `woStatusCode` = `"RELEASED"`
   - `enableOracleWorkOrder` = same as the Work Request
   - `workRequestId` = the newly created Work Request's `requestId`
   - A single default operation with one resource
5. If `enableOracleWorkOrder = "Y"` and Oracle integration is enabled, publish a `WorkOrderCreatedEvent` to the outbox
6. Return the created Work Request and the associated Work Order

### Business Rules

**BR-WR-CR-01**

A Work Request SHALL have an associated Work Order.

**BR-WR-CR-02**

Only the MANUFACTURING_FACILITATOR role can create Work Requests and their associated Work Orders.

**BR-WR-CR-03**

Work Orders created from Work Requests SHALL always have `workOrderType: "Not Planned"` and `workOrderSubType: "Emergency"`.

### Response

**R-WR-CR-12**

WHEN the Work Request is created successfully,  
the system SHALL return a 201 status with:

- `workRequest`: the created Work Request object
- `workOrder`: the associated created Work Order object

### Errors

**R-WR-CR-13**

IF the request contains validation errors,  
THEN the system SHALL return a 400 status with a `message` field containing validation error strings.

**R-WR-CR-14**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Get Work Request By ID

### Purpose

Retrieves a single Work Request by its `requestId`.

### Gateway-Injected Fields

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |

### Validations

**R-WR-FO-01**

IF `requestId` is missing or invalid,  
THEN the system SHALL reject the request.

**R-WR-FO-02**

IF the Work Request does not exist,  
THEN the system SHALL return a 404 status.

### Response

Returns the Work Request object with all fields.

---

## Get All Work Requests

### Purpose

Retrieves Work Requests using dynamic filtering, sorting, and pagination.

### Gateway-Injected Fields

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |

### Request

The query payload SHALL support:

- `filters`: array of filter objects `{ field, operator, value }`
- `order`: array of sort criteria `[field, ASC|DESC]`
- `limit`: maximum number of results
- `offset`: number of results to skip

### Validations

**R-WR-GE-01**

IF the queryParams format is malformed or invalid,  
THEN the system SHALL return a 400 response with error message "Invalid filter data".

**R-WR-GE-02**

IF the requester is not authenticated,  
THEN the system SHALL reject the request.

### Response

Returns:

- `workRequests`: array of Work Requests
- `total`: total number of records matching the query condition

### Errors

**R-WR-GE-03**

IF no work requests match the criteria,  
THEN the system SHALL return an empty result set with `total: 0`.

---

## Update Work Request Description

### Communication

NATS Pattern: `work.request.update` (via gateway)

Gateway endpoint: `PATCH /wo-request/:requestId`

### Purpose

Updates the `issueDescription` of a Work Request.

### Gateway-Injected Fields

| Field     | Type   | Description                |
| --------- | ------ | -------------------------- |
| actorId   | string | User ID from JWT payload   |
| actorName | string | User name from JWT payload |

### Required Permissions

| Permission                | Description                                   |
| ------------------------- | --------------------------------------------- |
| `mnt.work.request.update` | Required to update a Work Request description |

### Request

#### Editable Fields

| Field            | Type   | Max Length | Description                       |
| ---------------- | ------ | ---------- | --------------------------------- |
| issueDescription | string | 240        | Updated description of the issue. |

### Validations

**R-WR-UP-01**

IF `userPermissions` does not include `mnt.work.request.update`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_PERMISSION`.

**R-WR-UP-02**

IF the Work Request does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-WR-UP-03**

IF `issueDescription` exceeds 240 characters,  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-WR-UP-04**

WHEN a valid update request is received,  
the system SHALL update the `issueDescription` and set `updatedBy`, `updatedByName`, and `updatedAt`.

### Response

Returns the updated Work Request.

---

## Complete Work Request

### Communication

NATS Pattern: `work.request.complete` (via gateway)

Gateway endpoint: `PATCH /wo-request/:requestId/complete`

### Purpose

Transitions a Work Request from `RELEASED` to `COMPLETED` status. This action does NOT affect the associated Work Order.

### Gateway-Injected Fields

| Field     | Type   | Description                |
| --------- | ------ | -------------------------- |
| actorId   | string | User ID from JWT payload   |
| actorName | string | User name from JWT payload |

### Required Permissions

| Permission                  | Description                         |
| --------------------------- | ----------------------------------- |
| `mnt.work.request.complete` | Required to complete a Work Request |

### Role Restriction

The following roles are authorized to complete a Work Request:

| Role                       |
| -------------------------- |
| MANUFACTURING_FACILITATOR  |
| TECHNICIAN_MAINTENANCE_01  |
| TECHNICIAN_MAINTENANCE_02  |
| PLANNER_MAINTENANCE_01     |
| PLANNER_MAINTENANCE_02     |
| COORDINATOR_MAINTENANCE_01 |
| COORDINATOR_MAINTENANCE_02 |
| SUPERVISOR_MAINTENANCE_01  |
| SUPERVISOR_MAINTENANCE_02  |
| ADMIN                      |

### Validations

**R-WR-CM-01**

IF `userPermissions` does not include `mnt.work.request.complete`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_PERMISSION`.

**R-WR-CM-02**

IF the user's role is not in the authorized roles list,  
THEN the system SHALL reject the request with a 403 status and error code `ROLE_NOT_AUTHORIZED`.

**R-WR-CM-03**

IF the Work Request does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-WR-CM-04**

IF the Work Request's current status is not `RELEASED`,  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-WR-CM-05**

WHEN a valid complete request is received,  
the system SHALL:

1. Set `statusCode` to `COMPLETED`
2. Set `completedAt` to the current timestamp
3. Set `updatedBy`, `updatedByName`, and `updatedAt`
4. NOT modify the associated Work Order in any way

### Response

Returns the updated Work Request with `statusCode: "COMPLETED"` and `completedAt` set.

---

## Cancel Work Request

### Communication

NATS Pattern: `work.request.cancel` (via gateway)

Gateway endpoint: `PATCH /wo-request/:requestId/cancel`

### Purpose

Cancels a Work Request and its associated Work Order. If Oracle integration is enabled and the Work Order was created in Oracle, it also cancels the Work Order in Oracle Fusion.

### Gateway-Injected Fields

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| actorId          | string   | User ID from JWT payload                                          |
| actorName        | string   | User name from JWT payload                                        |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userPermissions  | string[] | Permissions from the user's role(s) in the target organization    |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |

### Required Permissions

| Permission                      | Description                                                                 |
| ------------------------------- | --------------------------------------------------------------------------- |
| `mnt.work.request.cancel`       | Required to cancel a Work Request                                           |
| `mnt.work.orders.cancel`        | Required to cancel the associated Work Order                                |
| `oracle.mnt.work.orders.cancel` | Required when Oracle integration is enabled and the WO was synced to Oracle |

### Role Restriction

Only the **MANUFACTURING_FACILITATOR** role is authorized to cancel Work Requests.

### Validations

**R-WR-CN-01**

IF `userPermissions` does not include `mnt.work.request.cancel`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_PERMISSION`.

**R-WR-CN-02**

IF `userPermissions` does not include `mnt.work.orders.cancel`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_PERMISSION`.

**R-WR-CN-03**

IF `userRoles` does not include `MANUFACTURING_FACILITATOR`,  
THEN the system SHALL reject the request with a 403 status and error code `ROLE_NOT_AUTHORIZED`.

**R-WR-CN-04**

IF `enableOracleWorkOrder = "Y"` (from the Work Order) and `ENABLE_ORACLE_WORK_ORDER_SYSTEM = "Y"` and `userPermissions` does not include `oracle.mnt.work.orders.cancel`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_ORACLE_PERMISSION`.

**R-WR-CN-05**

IF the Work Request does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-WR-CN-06**

IF the Work Request's current status is `CANCELED`,  
THEN the system SHALL reject the request with a 400 status.

### Allowed Status Transitions

| From Status | Allowed Transitions To |
| ----------- | ---------------------- |
| RELEASED    | CANCELED               |
| COMPLETED   | CANCELED               |

### Processing

**R-WR-CN-07**

WHEN a valid cancel request is received,  
the system SHALL:

1. Set the Work Request `statusCode` to `CANCELED`
2. Set `canceledAt` to the current timestamp
3. Set `updatedBy`, `updatedByName`, and `updatedAt`
4. Set the associated Work Order `woStatusCode` to `CANCELED`
5. Set the associated Work Order `canceledDate` to the current timestamp
6. Set all operations of the associated Work Order to `operationStatus: "CANCELED"`
7. If the Work Order was synced to Oracle (`enableOracleWorkOrder = "Y"` and `ENABLE_ORACLE_WORK_ORDER_SYSTEM = "Y"`), publish a `WorkOrderCanceledEvent` to the outbox

### Response

Returns the canceled Work Request with `statusCode: "CANCELED"` and `canceledAt` set.

---

## Status Transition Reference

### Work Request Status Transitions

| From Status | Allowed Transitions To |
| ----------- | ---------------------- |
| RELEASED    | COMPLETED, CANCELED    |
| COMPLETED   | CANCELED               |
| CANCELED    | [] (terminal)          |

### Work Request Status / Work Order Impact

| Work Request Transition | Work Order Impact                                               |
| ----------------------- | --------------------------------------------------------------- |
| RELEASED → COMPLETED    | None                                                            |
| RELEASED → CANCELED     | WO canceled, all operations canceled, Oracle sync if applicable |
| COMPLETED → CANCELED    | WO canceled, all operations canceled, Oracle sync if applicable |

---

## Error Mapping

| Status | Error Code / Message        | Description                                                     |
| ------ | --------------------------- | --------------------------------------------------------------- |
| 400    | Validation errors           | Missing or invalid fields                                       |
| 400    | Invalid status transition   | Work Request cannot transition from current status              |
| 403    | MISSING_PERMISSION          | User lacks required permission                                  |
| 403    | MISSING_ORACLE_PERMISSION   | User lacks Oracle permission when Oracle integration is enabled |
| 403    | ROLE_NOT_AUTHORIZED         | User's role is not authorized for this action                   |
| 403    | ORGANIZATION_MISMATCH       | Asset belongs to a different organization                       |
| 404    | Asset not found or inactive | The specified asset does not exist or is inactive               |
| 404    | Work Request not found      | The specified Work Request does not exist                       |
| 500    | Internal server error       | Unexpected failure                                              |
