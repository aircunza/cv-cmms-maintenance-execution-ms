# Work Order Module

## Create Work Order

### Communication

NATS Pattern: `work.order.create` (via gateway)

Gateway endpoint: POST /api/v1/work-orders

### Purpose

Creates a new Work Order with one or more operations, each containing resources and optional materials.

### Authentication & Authorization

The endpoint requires:

- **Gateway Auth**: Valid authentication token delegated to the gateway. The gateway resolves the user's permissions and roles from the auth service and injects them into the NATS payload.

#### Gateway-Injected Fields

The gateway MUST inject the following fields into the NATS payload after validating the JWT token and resolving the target organization from the `X-Organization-Code` header:

| Field            | Type     | Source                                                            |
| ---------------- | -------- | ----------------------------------------------------------------- |
| actorId          | string   | User ID from JWT payload                                          |
| actorName        | string   | User name from JWT payload                                        |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userPermissions  | string[] | Permissions from the user's role(s) in the target organization    |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |

The client SHALL NOT send these fields directly. They are exclusively set by the gateway.

The gateway MUST validate that:

1. The `X-Organization-Code` header is present and valid
2. The authenticated user has access to the specified organization
3. The `userPermissions` and `userRoles` are extracted from that specific organization's context

The microservice SHALL validate that the asset's `organizationCode` matches the gateway-injected `organizationCode`. If they do not match, the request is rejected with a 403 status and error code `ORGANIZATION_MISMATCH`.

- **OracleWorkOrderPolicy**: When `enableOracleWorkOrder = "Y"`, user must have permission `oracle.mnt.work.orders.create` and an allowed role within the organization
- **WorkOrderSubTypePolicy**: User's role must be authorized to create the requested `workOrderSubType`

#### Role-based Sub-Type Restrictions

| Role                       | Allowed Sub-Types                             |
| -------------------------- | --------------------------------------------- |
| MANUFACTURING_FACILITATOR  | Emergency                                     |
| TECHNICIAN_MAINTENANCE_01  | Corrective                                    |
| TECHNICIAN_MAINTENANCE_02  | Corrective, Emergency, Inspection             |
| PLANNER_MAINTENANCE_01     | Preventive, Corrective, Emergency, Inspection |
| PLANNER_MAINTENANCE_02     | Preventive, Corrective, Emergency, Inspection |
| COORDINATOR_MAINTENANCE_01 | Preventive, Corrective, Emergency             |
| COORDINATOR_MAINTENANCE_02 | Preventive, Corrective, Emergency             |
| SUPERVISOR_MAINTENANCE_01  | Emergency                                     |
| SUPERVISOR_MAINTENANCE_02  | Emergency                                     |
| ADMIN                      | All (no restrictions)                         |

#### Oracle Work Order Authorization

The system-level environment variable `ENABLE_ORACLE_WORK_ORDER_SYSTEM` acts as a global feature flag:

- If `"N"`: Oracle permission checks are bypassed. Work orders are always created locally regardless of `enableOracleWorkOrder` value.
- If `"Y"`: When the client sends `enableOracleWorkOrder = "Y"`:
  - User must have permission `oracle.mnt.work.orders.create` (injected by gateway as `userPermissions`)
  - User must have one of the allowed roles (injected by gateway as `userRoles`)
  - Allowed roles: MANUFACTURING_FACILITATOR, TECHNICIAN_MAINTENANCE_01, TECHNICIAN_MAINTENANCE_02, PLANNER_MAINTENANCE_01, PLANNER_MAINTENANCE_02, COORDINATOR_MAINTENANCE_01, COORDINATOR_MAINTENANCE_02, SUPERVISOR_MAINTENANCE_01, SUPERVISOR_MAINTENANCE_02, ADMIN

### Request

#### Required Fields (Work Order Level)

| Field                 | Type                        | Max Length | Description                                                                                                                                                                                               |
| --------------------- | --------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| workOrderDescription  | string                      | 240        | Description of the work order.                                                                                                                                                                            |
| woStatusCode          | string                      | 30         | Status code in UPPER_SNAKE_CASE (e.g., "UNRELEASED", "RELEASED").                                                                                                                                         |
| assetCode             | string                      | 80         | Asset identifier.                                                                                                                                                                                         |
| workOrderType         | string                      | 30         | Work order type (e.g., "Planned", "Not Planned").                                                                                                                                                         |
| workOrderSubType      | string                      | 30         | Work order sub-type (e.g., "Preventive", "Corrective", "Emergency").                                                                                                                                      |
| workOrderPriority     | string ("1"\|"2"\|"3"\|"4") | -          | Priority level (1=highest, 4=lowest).                                                                                                                                                                     |
| enableOracleWorkOrder | string ("Y"\|"N")           | 1          | Flag to enable Oracle integration.                                                                                                                                                                        |
| operations            | array                       | -          | Array of operations. Required and non-empty when the Work Order is created from the gateway. When created from a Work Request, it is auto-completed with a default operation by the work-request handler. |

> **Creation source of `operations`:** When the Work Order is created **from the gateway** (`work.order.create`), `operations` is a mandatory, non-empty array that the client SHALL send; the gateway rejects requests without at least one operation before forwarding. When the Work Order is created **from a Work Request**, the work-request client does NOT send `operations`; the work-request handler injects a single default operation (`DEFAULT_OPERATION` with one `DEFAULT_RESOURCE` resource) before invoking creation.

> **Initial data requirement (`DEFAULT_RESOURCE`):** The default operation injected when creating a Work Order from a Work Request references `resourceCode = "DEFAULT_RESOURCE"`. Therefore the `mnt_human_resources` table SHALL contain at least one active human resource with `resource_code = 'DEFAULT_RESOURCE'` per environment; without it, inserting the operation's resource usage fails with an FK constraint violation.

#### Gateway-Injected Fields (Work Order Level)

These fields are injected by the gateway and SHALL NOT be provided by the client:

| Field           | Type     | Description                                                   |
| --------------- | -------- | ------------------------------------------------------------- |
| actorId         | string   | User ID from JWT payload.                                     |
| actorName       | string   | User name from JWT payload.                                   |
| userPermissions | string[] | Flattened array of permission codes from all user roles.      |
| userRoles       | string[] | Array of role codes from the user's organization assignments. |

#### Optional Fields (Work Order Level)

| Field                 | Type            | Default | Description                                         |
| --------------------- | --------------- | ------- | --------------------------------------------------- |
| workRequestId         | BigInt          | null    | Associated work request identifier.                 |
| workDefinitionCode    | string          | -       | Work definition code.                               |
| schedulingMethod      | string          | -       | Scheduling method.                                  |
| needByDate            | Date (ISO 8601) | -       | Date by which the work order needs to be completed. |
| plannedStartDate      | Date (ISO 8601) | -       | Planned start date (for advanced scheduling).       |
| plannedCompletionDate | Date (ISO 8601) | -       | Planned completion date (for advanced scheduling).  |

#### Operation Object Structure

Each operation in the `operations` array must contain:

##### Required Fields (Operation Level)

| Field                      | Type                    | Description                                                                                     |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| operationName              | string (min 2, max 120) | Name of the operation.                                                                          |
| operationDescription       | string (max 240 chars)  | Description of the operation.                                                                   |
| operationSeqNumber         | integer (> 0)           | Sequence number for ordering operations. Must be unique within the Work Order.                  |
| createdBy                  | string (UUID)           | User identifier who creates the operation. **Required**.                                        |
| operationStatus            | string                  | One of: "UNRELEASED", "RELEASED", "IN_PROCESS", "COMPLETED", "NOT_DONE", "CANCELED", "ON_HOLD". |
| operationType              | string                  | One of: "Internal", "Supplier".                                                                 |
| actualStartDate            | string (ISO 8601)       | Operation start date. Must be before actualCompletionDate.                                      |
| actualCompletionDate       | string (ISO 8601)       | Operation completion date. Must be after actualStartDate.                                       |
| workOrderOperationResource | array (non-empty)       | Array of resource objects (at least one required).                                              |
| operationSubType           | string                  | Must match the parent Work Order's `workOrderSubType` at creation time.                         |

##### Optional Fields (Operation Level)

| Field                      | Type   | Description                   |
| -------------------------- | ------ | ----------------------------- |
| workOrderOperationMaterial | array  | Array of material objects.    |
| unit                       | string | Unit of measure.              |
| subunit                    | string | Subunit of measure.           |
| maintainableItem           | string | Maintainable item identifier. |
| operationCategory          | string | Operation category.           |

#### Resource Object Structure

Each resource in `workOrderOperationResource` must contain:

| Field                  | Type              | Description                                                                                 |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| resourceCode           | string            | Resource identifier.                                                                        |
| resourceSequenceNumber | integer (>= 0)    | Sequence number for Oracle Fusion integration. Does NOT affect calculations in this system. |
| plannedHours           | number (> 0)      | Planned hours for the resource.                                                             |
| actualHours            | number (> 0)      | Actual hours for the resource. Must be greater than 0.                                      |
| principalFlag          | string ("Y"\|"N") | Principal flag indicator.                                                                   |
| actualStartDate        | string (ISO 8601) | Actual start date for the resource. Must be before actualCompletionDate.                    |
| actualCompletionDate   | string (ISO 8601) | Actual completion date for the resource. Must be after actualStartDate.                     |

##### Optional Fields (Resource Level)

| Field                 | Type   | Description                           |
| --------------------- | ------ | ------------------------------------- |
| hourlyCost            | number | Hourly cost of the resource.          |
| plannedStartDate      | Date   | Planned start date for the resource.  |
| plannedCompletionDate | Date   | Planned completion date for resource. |

#### Material Object Structure (Optional)

Each material in `workOrderOperationMaterial` must contain:

| Field                  | Type         | Description               |
| ---------------------- | ------------ | ------------------------- |
| materialSequenceNumber | integer      | Material sequence number. |
| quantity               | number (> 0) | Quantity of material.     |
| supplyType             | string       | Supply type code.         |
| materialCode           | string       | Material identifier.      |

#### System Generated / Calculated Fields (Work Order Level)

These fields are calculated or managed by the system and SHALL NOT be provided when creating a Work Order.

| Field                 | Type          | Description                                                                                 |
| --------------------- | ------------- | ------------------------------------------------------------------------------------------- |
| workOrderCode         | BigInt        | Auto-generated unique identifier.                                                           |
| actualHours           | Float         | Calculated: SUM of all ACTIVE operations' actualHours.                                      |
| totalManHours         | Float         | Total man hours from operations (operationType = "Internal").                               |
| totalSupplierHours    | Float         | Total supplier hours from operations (operationType = "Supplier").                          |
| createdAt             | DateTime      | Record creation timestamp.                                                                  |
| updatedAt             | DateTime      | Last update timestamp.                                                                      |
| updatedBy             | string        | Last updated by user.                                                                       |
| updatedByName         | string        | Last updated by user name.                                                                  |
| createdBy             | string (UUID) | User identifier who creates the work order.                                                 |
| createdByName         | string        | Creator user name.                                                                          |
| woStatusLabel         | string        | Title Case label for woStatusCode (e.g., "Unreleased").                                     |
| actualStartDate       | DateTime      | Calculated: MIN of all ACTIVE operations' actualStartDate. Editable via reprogram endpoint. |
| actualCompletionDate  | DateTime      | Calculated: MAX of all ACTIVE operations' actualCompletionDate.                             |
| workCenterCode        | string        | Work center code (inferred from asset).                                                     |
| workCenterDescription | string        | Work center description (inferred from asset).                                              |
| centerCostCode        | integer       | Cost center code (inferred from asset).                                                     |
| workAreaCode          | string        | Work area code (inferred from asset).                                                       |
| workAreaDescription   | string        | Work area description (inferred from asset).                                                |
| sector                | string        | Sector (inferred from asset).                                                               |
| subsector             | string        | Subsector (inferred from asset).                                                            |
| organizationCode      | string        | Organization code.                                                                          |
| organizationName      | string        | Organization name (inferred from asset).                                                    |
| assetShortDescription | string        | Asset short description (inferred from asset).                                              |
| plannedHours          | Float         | Planned hours (aggregated).                                                                 |
| releasedDate          | DateTime      | Release timestamp.                                                                          |
| closedDate            | DateTime      | Close timestamp.                                                                            |
| canceledDate          | DateTime      | Cancellation timestamp.                                                                     |
| canceledReason        | string        | Reason for cancellation (required when canceling).                                          |
| oclWorkOrderId        | BigInt        | Oracle Cloud work order ID.                                                                 |
| oclWorkOrderNumber    | string        | Oracle Cloud work order number.                                                             |

#### System Generated / Calculated Fields (Operation Level)

| Field                 | Type     | Description                                                    |
| --------------------- | -------- | -------------------------------------------------------------- |
| operationCode         | BigInt   | Auto-generated unique identifier.                              |
| actualHours           | Float    | Calculated: SUM of all ACTIVE resources' actualHours.          |
| actualStartDate       | DateTime | Calculated: MIN of all ACTIVE resources' actualStartDate.      |
| actualCompletionDate  | DateTime | Calculated: MAX of all ACTIVE resources' actualCompletionDate. |
| operationStatusLabel  | string   | Title Case label for operationStatus (e.g., "Unreleased").     |
| createdAt             | DateTime | Record creation timestamp.                                     |
| updatedAt             | DateTime | Last update timestamp.                                         |
| updatedBy             | string   | Last updated by user.                                          |
| updatedByName         | string   | Last updated by user name.                                     |
| createdByName         | string   | Creator user name.                                             |
| assetCode             | string   | Asset code (propagated from Work Order).                       |
| assetShortDescription | string   | Asset short description (propagated from Work Order).          |
| workCenterCode        | string   | Work center code.                                              |
| workCenterDescription | string   | Work center description.                                       |
| centerCostCode        | integer  | Cost center code.                                              |
| workAreaCode          | string   | Work area code.                                                |
| workAreaDescription   | string   | Work area description.                                         |
| sector                | string   | Sector.                                                        |
| subsector             | string   | Subsector.                                                     |
| organizationCode      | string   | Organization code.                                             |
| organizationName      | string   | Organization name.                                             |
| oclWorkOrderId        | BigInt   | Oracle Cloud work order ID.                                    |
| oclWorkOrderNumber    | string   | Oracle Cloud work order number.                                |
| plannedStartDate      | DateTime | Planned start date.                                            |
| plannedCompletionDate | DateTime | Planned completion date.                                       |
| plannedHours          | Float    | Planned hours.                                                 |
| reviewedBy            | string   | Reviewed by user.                                              |
| reviewedByName        | string   | Reviewed by user name.                                         |
| reviewedAt            | DateTime | Review timestamp.                                              |

#### System Generated / Calculated Fields (Resource Level)

| Field                    | Type              | Description                               |
| ------------------------ | ----------------- | ----------------------------------------- |
| id                       | BigInt            | Auto-generated unique identifier.         |
| operationCode            | BigInt            | Parent operation identifier.              |
| organizationCode         | string            | Organization code.                        |
| transactedInOracle       | string ("Y"\|"N") | Oracle transaction flag.                  |
| oclWoOperationResourceId | BigInt            | Oracle Cloud resource ID.                 |
| syncedToOracleAt         | DateTime          | Oracle sync timestamp.                    |
| createdBy                | string            | Creator user identifier.                  |
| createdByName            | string            | Creator user name.                        |
| updatedBy                | string            | Last updated by user.                     |
| updatedByName            | string            | Last updated by user name.                |
| createdAt                | DateTime          | Record creation timestamp.                |
| updatedAt                | DateTime          | Last update timestamp.                    |
| status                   | string            | "ACTIVE" or "CANCELED". Default "ACTIVE". |

#### System Generated / Calculated Fields (Material Level)

| Field                    | Type              | Description                                 |
| ------------------------ | ----------------- | ------------------------------------------- |
| id                       | BigInt            | Auto-generated unique identifier.           |
| operationCode            | BigInt            | Parent operation identifier.                |
| organizationCode         | string            | Organization code.                          |
| materialName             | string            | Material name (resolved from materialCode). |
| unitCost                 | Decimal           | Unit cost.                                  |
| totalCost                | Decimal           | Total cost (quantity * unitCost).           |
| transactedInOracle       | string ("Y"\|"N") | Oracle transaction flag.                    |
| oclWoOperationMaterialId | BigInt            | Oracle Cloud material ID.                   |
| syncedToOracleAt         | DateTime          | Oracle sync timestamp.                      |
| createdBy                | string            | Creator user identifier.                    |
| createdByName            | string            | Creator user name.                          |
| updatedBy                | string            | Last updated by user.                       |
| updatedByName            | string            | Last updated by user name.                  |
| createdAt                | DateTime          | Record creation timestamp.                  |
| updatedAt                | DateTime          | Last update timestamp.                      |

#### Example Request

```json
{
  "actorId": "550e8400-e29b-41d4-a716-446655440001",
  "actorName": "John Doe",
  "organizationCode": "ORG-BOG-001",
  "userPermissions": [
    "mnt.work.orders.create",
    "oracle.mnt.work.orders.create"
  ],
  "userRoles": ["PLANNER_MAINTENANCE_01"],
  "enableOracleWorkOrder": "N",
  "workOrderDescription": "Preventive maintenance on hydraulic pump",
  "woStatusCode": "UNRELEASED",
  "assetCode": "AST-001",
  "workOrderType": "Planned",
  "workOrderSubType": "Preventive",
  "workOrderPriority": "2",
  "operations": [
    {
      "operationName": "Lubrication",
      "operationDescription": "Lubrication of all components",
      "operationSeqNumber": 10,
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "operationStatus": "UNRELEASED",
      "operationType": "Internal",
      "operationSubType": "Preventive",
      "actualStartDate": "2025-11-21T08:00:00.000Z",
      "actualCompletionDate": "2025-11-21T10:00:00.000Z",
      "workOrderOperationResource": [
        {
          "principalFlag": "Y",
          "resourceCode": "RES-001",
          "resourceSequenceNumber": 1,
          "plannedHours": 2,
          "actualHours": 2,
          "actualStartDate": "2025-11-21T08:00:00.000Z",
          "actualCompletionDate": "2025-11-21T10:00:00.000Z"
        },
        {
          "principalFlag": "N",
          "resourceCode": "RES-002",
          "resourceSequenceNumber": 1,
          "plannedHours": 3,
          "actualHours": 3,
          "actualStartDate": "2025-11-21T08:00:00.000Z",
          "actualCompletionDate": "2025-11-21T11:00:00.000Z"
        }
      ],
      "workOrderOperationMaterial": [
        {
          "materialSequenceNumber": 10,
          "quantity": 1,
          "supplyType": "1",
          "materialCode": "MAT-001"
        }
      ]
    },
    {
      "operationName": "Inspection",
      "operationDescription": "Visual inspection of components",
      "operationSeqNumber": 20,
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "operationStatus": "UNRELEASED",
      "operationType": "Internal",
      "operationSubType": "Preventive",
      "actualStartDate": "2025-11-21T11:00:00.000Z",
      "actualCompletionDate": "2025-11-21T14:00:00.000Z",
      "workOrderOperationResource": [
        {
          "principalFlag": "Y",
          "resourceCode": "RES-001",
          "resourceSequenceNumber": 1,
          "plannedHours": 2,
          "actualHours": 2,
          "actualStartDate": "2025-11-21T11:00:00.000Z",
          "actualCompletionDate": "2025-11-21T13:00:00.000Z"
        },
        {
          "principalFlag": "N",
          "resourceCode": "RES-003",
          "resourceSequenceNumber": 2,
          "plannedHours": 1,
          "actualHours": 1,
          "actualStartDate": "2025-11-21T13:00:00.000Z",
          "actualCompletionDate": "2025-11-21T14:00:00.000Z"
        }
      ]
    }
  ]
}
```

### Validations

**R-WO-CR-01**

The system SHALL require all mandatory fields at the Work Order level.

**R-WO-CR-02**

IF any required Work Order field is missing, empty, or null,  
THEN the system SHALL reject the request with a 400 status.

**R-WO-CR-03**

IF `enableOracleWorkOrder` is not "Y" or "N",  
THEN the system SHALL reject the request.

**R-WO-CR-04**

IF `workOrderPriority` is provided and is not one of "1", "2", "3", "4",  
THEN the system SHALL reject the request.

**R-WO-CR-05**

IF `woStatusCode` is not a valid UPPER_SNAKE_CASE status code,  
THEN the system SHALL reject the request.

**R-WO-CR-06**

IF the combination of `workOrderType` and `workOrderSubType` is not allowed,  
THEN the system SHALL reject the request.

Allowed combinations:

```json
[
  { "workOrderType": "Planned", "workOrderSubType": "Preventive" },
  { "workOrderType": "Planned", "workOrderSubType": "Corrective" },
  { "workOrderType": "Planned", "workOrderSubType": "Inspection" },
  { "workOrderType": "Planned", "workOrderSubType": "TPM" },
  { "workOrderType": "Not Planned", "workOrderSubType": "Emergency" }
]
```

**R-WO-CR-07**

IF `enableOracleWorkOrder = "Y"` and the system-level `ENABLE_ORACLE_WORK_ORDER_SYSTEM` is `"Y"` and the user lacks the required Oracle permission (`oracle.mnt.work.orders.create`) or does not have an allowed role,  
THEN the system SHALL reject the request with a 403 status.

IF `enableOracleWorkOrder = "Y"` but the system-level `ENABLE_ORACLE_WORK_ORDER_SYSTEM` is `"N"`,  
THEN the Oracle permission check is skipped and the work order is created locally without Oracle sync.

**R-WO-CR-07B**

IF the asset's `organizationCode` does not match the gateway-injected `organizationCode`,  
THEN the system SHALL reject the request with a 403 status and error code `ORGANIZATION_MISMATCH`.

**R-WO-CR-08**

IF the user's role (from gateway-injected `userRoles`) is not authorized to create the specified `workOrderSubType`,  
THEN the system SHALL reject the request with a 403 status.

**R-WO-CR-09**

IF an operation's `actualStartDate` is not before its `actualCompletionDate`,  
THEN the system SHALL reject the request.

**R-WO-CR-10**

IF an operation's date fields are not valid ISO 8601 datetime strings,  
THEN the system SHALL reject the request.

**R-WO-CR-11**

IF an operation's `operationName` is less than 2 characters or exceeds 120 characters,  
THEN the system SHALL reject the request.

**R-WO-CR-12**

IF an operation's `operationDescription` exceeds 240 characters,  
THEN the system SHALL reject the request.

**R-WO-CR-13**

IF an operation's `createdBy` is not a valid UUID,  
THEN the system SHALL reject the request.

**R-WO-CR-14**

IF an operation's `operationType` is not "Internal" or "Supplier",  
THEN the system SHALL reject the request.

**R-WO-CR-15**

IF an operation's `operationStatus` is not a valid UPPER_SNAKE_CASE status,  
THEN the system SHALL reject the request.

**R-WO-CR-16**

IF an operation's `workOrderOperationResource` is missing or empty,  
THEN the system SHALL reject the request.

**R-WO-CR-17**

EACH resource in an operation MUST have `actualHours > 0`. IF any resource has `actualHours <= 0`,  
THEN the system SHALL reject the request.

**R-WO-CR-18**

IF a resource's `plannedHours` is not greater than 0,  
THEN the system SHALL reject the request.

**R-WO-CR-19**

IF a resource's `actualHours` is not greater than 0,  
THEN the system SHALL reject the request.

**R-WO-CR-20**

IF a resource's `resourceSequenceNumber` is not a non-negative integer,  
THEN the system SHALL reject the request.

**R-WO-CR-21**

IF two or more operations have the same `operationSeqNumber`,  
THEN the system SHALL reject the request.

**R-WO-CR-22**

IF a resource's `actualStartDate` is not before its `actualCompletionDate`,  
THEN the system SHALL reject the request.

**R-WO-CR-23**

IF the combination of Work Order `woStatusCode` and operation `operationStatus` values is not allowed,  
THEN the system SHALL reject the request.

#### Allowed Status/Activity Combinations

| woStatusCode     | Allowed operationStatus values  |
| ---------------- | ------------------------------- |
| UNRELEASED       | UNRELEASED                      |
| RELEASED         | RELEASED, COMPLETED, IN_PROCESS |
| ON_HOLD          | ON_HOLD                         |
| PENDING_APPROVAL | UNRELEASED                      |
| COMPLETED        | COMPLETED, NOT_DONE             |
| CLOSED           | COMPLETED, NOT_DONE             |
| CANCELED         | CANCELED                        |

**R-WO-CR-24**

IF an operation's `operationSubType` does not match the parent Work Order's `workOrderSubType` at creation time,  
THEN the system SHALL reject the request.

### Processing

**R-WO-CR-25**

WHEN `operations` is missing or empty AND the caller is an internal direct service call (not the gateway, not the work-request handler),  
the create service SHALL fall back to a default operation with:

- operationName: "DEFAULT_OPERATION"
- operationDescription: "Auto-generated default operation"
- operationSeqNumber: 1
- operationStatus: "UNRELEASED"
- operationType: "Internal"
- operationSubType: same as parent Work Order's workOrderSubType
- actualStartDate: current time (or provided actualStartDate)
- actualCompletionDate: start + 1 hour
- One default resource with principalFlag "N", actualHours > 0, actualStartDate < actualCompletionDate

This fallback is a defensive measure for internal callers. With the gateway, `operations` is REQUIRED and non-empty (see create request), so the public API never reaches this path. When creation originates from a Work Request, the work-request handler supplies its own default operation (operationStatus "RELEASED") as described in the work-request specification, so the fallback is not exercised there either.

**R-WO-CR-26**

WHEN a valid Work Order creation request is received,  
the system SHALL:

1. Validate all DTO-level constraints
2. Validate type/subtype combination
3. Validate `operationSubType` matches `workOrderSubType` for all operations
4. Validate each resource's `actualHours > 0` and `actualStartDate < actualCompletionDate`
5. Create WorkOperation entities from the operations array
6. Create all resource entities with `status = "ACTIVE"`
7. Calculate each operation's `actualHours` as the SUM of all its resources' `actualHours`
8. Calculate each operation's `actualStartDate` as the MIN of all its resources' `actualStartDate`
9. Calculate each operation's `actualCompletionDate` as the MAX of all its resources' `actualCompletionDate`
10. Calculate Work Order `actualHours` as the SUM of all operations' `actualHours`
11. Calculate Work Order `actualStartDate` as the MIN of all operations' `actualStartDate`
12. Calculate Work Order `actualCompletionDate` as the MAX of all operations' `actualCompletionDate`
13. Calculate `totalManHours` (sum of resources where operationType = "Internal") and `totalSupplierHours` (sum of resources where operationType = "Supplier")
14. Validate status/operationStatus compatibility
15. Infer `assetShortDescription`, `workCenterCode`, `workCenterDescription`, `centerCostCode`, `workAreaCode`, `workAreaDescription`, `sector`, `subsector`, `organizationName` from the `assetCode`
16. Persist the Work Order and all associated operations, resources, and materials
17. If `enableOracleWorkOrder = "Y"` and Oracle integration is enabled, publish a `WorkOrderCreatedEvent` to the outbox with the Oracle-mapped payload

**R-WO-CR-27**

The system SHALL assign a unique `workOrderCode` (BigInt) to the Work Order.

**R-WO-CR-28**

The system SHALL overwrite any `actualCompletionDate` provided by the client with the backend-calculated value based on resources.

**R-WO-CR-29**

The `assetCode` from the Work Order level SHALL be propagated to all operations, along with `assetShortDescription` inferred from the asset.

### Business Rules

**BR-WO-CR-01**

The Work Order's `actualHours` represents the SUM of work hours from all ACTIVE operations, NOT the calendar time difference between start and completion dates.

**BR-WO-CR-02**

Operations within a Work Order MAY have overlapping `actualStartDate` and `actualCompletionDate` ranges. Date overlap between operations is allowed.

**BR-WO-CR-03**

The backend is the single source of truth (SSOT) for all timing calculations at the Work Order and Operation levels. Frontend-provided dates for operations and resources are accepted as input but always recalculated and overwritten based on resource data. The Work Order's `actualStartDate` is the only date field that can be manually set via the reprogram endpoint, which propagates a delta to all child operations and resources.

**BR-WO-CR-04**

At creation time, each operation's `operationSubType` MUST match the parent Work Order's `workOrderSubType`. After creation, operations may progress independently and their `operationSubType` may differ as they complete.

**BR-WO-CR-05**

A Work Order MUST have at least one ACTIVE operation at all times. The system SHALL NOT allow canceling the last active operation.

**BR-WO-CR-06**

The `resourceSequenceNumber` field is used exclusively for Oracle Fusion integration to indicate parallel or sequential execution. It does NOT affect any calculation of `actualHours`, `actualStartDate`, or `actualCompletionDate` within this system.

### Status Transitions

#### Work Order Status Transitions

| From Status      | Allowed Transitions To       |
| ---------------- | ---------------------------- |
| UNRELEASED       | ON_HOLD, RELEASED, CANCELED  |
| RELEASED         | COMPLETED, ON_HOLD, CANCELED |
| ON_HOLD          | RELEASED, CANCELED           |
| COMPLETED        | CLOSED, RELEASED             |
| CLOSED           | [] (terminal)                |
| CANCELED         | [] (terminal)                |
| PENDING_APPROVAL | UNRELEASED                   |

### Response

**R-WO-CR-30**

WHEN the Work Order is created successfully,  
the system SHALL return a 201 status with the created Work Order wrapped in a `workOrder` object including:

- workOrderCode
- All Work Order fields with calculated values (actualHours, actualStartDate, actualCompletionDate)
- `woStatusCode` in UPPER_SNAKE_CASE and `woStatusLabel` in Title Case
- All operations with calculated actualHours and actualCompletionDate
- `operationStatus` in UPPER_SNAKE_CASE and `operationStatusLabel` in Title Case
- All resources and materials

#### Example Response

```json
{
  "workOrder": {
    "workOrderCode": "1001",
    "workOrderDescription": "Preventive maintenance on hydraulic pump",
    "assetCode": "AST-001",
    "assetShortDescription": "Hydraulic Pump Unit",
    "woStatusCode": "UNRELEASED",
    "woStatusLabel": "Unreleased",
    "workOrderType": "Planned",
    "workOrderSubType": "Preventive",
    "workOrderPriority": "2",
    "workCenterCode": "WC-001",
    "workCenterDescription": "Maintenance Department",
    "centerCostCode": 100,
    "workAreaCode": "WA-001",
    "workAreaDescription": "Production Area A",
    "sector": "Production",
    "subsector": "Assembly",
    "organizationCode": "ORG001",
    "organizationName": "Main Plant",
    "createdBy": "550e8400-e29b-41d4-a716-446655440001",
    "createdByName": "John Doe",
    "updatedBy": null,
    "updatedByName": null,
    "createdAt": "2025-11-21T08:00:00.000Z",
    "updatedAt": "2025-11-21T08:00:00.000Z",
    "actualStartDate": "2025-11-21T08:00:00.000Z",
    "actualCompletionDate": "2025-11-21T17:00:00.000Z",
    "actualHours": 12,
    "totalManHours": 10,
    "totalSupplierHours": 2,
    "plannedHours": null,
    "workRequestId": null,
    "enableOracleWorkOrder": "N",
    "oclWorkOrderId": null,
    "oclWorkOrderNumber": null,
    "releasedDate": null,
    "closedDate": null,
    "canceledDate": null,
    "canceledReason": null,
    "operations": [
      {
        "operationCode": 5001,
        "operationName": "Lubrication",
        "operationDescription": "Lubrication of all components",
        "operationSeqNumber": 10,
        "assetCode": "AST-001",
        "assetShortDescription": "Hydraulic Pump Unit",
        "operationStatus": "UNRELEASED",
        "operationStatusLabel": "Unreleased",
        "operationType": "Internal",
        "operationSubType": "Preventive",
        "actualStartDate": "2025-11-21T08:00:00.000Z",
        "actualCompletionDate": "2025-11-21T11:00:00.000Z",
        "actualHours": 3,
        "workCenterCode": "WC-001",
        "workCenterDescription": "Maintenance Department",
        "workAreaCode": "WA-001",
        "workAreaDescription": "Production Area A",
        "organizationCode": "ORG001",
        "organizationName": "Main Plant",
        "createdBy": "550e8400-e29b-41d4-a716-446655440001",
        "createdByName": "John Doe",
        "createdAt": "2025-11-21T08:00:00.000Z",
        "updatedAt": "2025-11-21T08:00:00.000Z",
        "workOrderOperationResource": [
          {
            "id": 10001,
            "resourceCode": "RES-001",
            "resourceSequenceNumber": 1,
            "plannedHours": 2,
            "actualHours": 2,
            "principalFlag": "Y",
            "actualStartDate": "2025-11-21T08:00:00.000Z",
            "actualCompletionDate": "2025-11-21T10:00:00.000Z",
            "status": "ACTIVE",
            "organizationCode": "ORG001",
            "createdBy": "550e8400-e29b-41d4-a716-446655440001",
            "createdByName": "John Doe",
            "createdAt": "2025-11-21T08:00:00.000Z",
            "updatedAt": "2025-11-21T08:00:00.000Z",
            "transactedInOracle": "N",
            "oclWoOperationResourceId": null,
            "syncedToOracleAt": null
          },
          {
            "id": 10002,
            "resourceCode": "RES-002",
            "resourceSequenceNumber": 1,
            "plannedHours": 3,
            "actualHours": 3,
            "principalFlag": "N",
            "actualStartDate": "2025-11-21T08:00:00.000Z",
            "actualCompletionDate": "2025-11-21T11:00:00.000Z",
            "status": "ACTIVE",
            "organizationCode": "ORG001",
            "createdBy": "550e8400-e29b-41d4-a716-446655440001",
            "createdByName": "John Doe",
            "createdAt": "2025-11-21T08:00:00.000Z",
            "updatedAt": "2025-11-21T08:00:00.000Z",
            "transactedInOracle": "N",
            "oclWoOperationResourceId": null,
            "syncedToOracleAt": null
          }
        ],
        "workOrderOperationMaterial": [
          {
            "id": 20001,
            "materialCode": "MAT-001",
            "materialName": "Hydraulic Oil",
            "materialSequenceNumber": 10,
            "quantity": 1,
            "supplyType": "1",
            "unitCost": 25.0,
            "totalCost": 25.0,
            "organizationCode": "ORG001",
            "createdBy": "550e8400-e29b-41d4-a716-446655440001",
            "createdByName": "John Doe",
            "createdAt": "2025-11-21T08:00:00.000Z",
            "updatedAt": "2025-11-21T08:00:00.000Z",
            "transactedInOracle": "N",
            "oclWoOperationMaterialId": null,
            "syncedToOracleAt": null
          }
        ]
      },
      {
        "operationCode": 5002,
        "operationName": "Inspection",
        "operationDescription": "Visual inspection of components",
        "operationSeqNumber": 20,
        "assetCode": "AST-001",
        "assetShortDescription": "Hydraulic Pump Unit",
        "operationStatus": "UNRELEASED",
        "operationStatusLabel": "Unreleased",
        "operationType": "Internal",
        "operationSubType": "Preventive",
        "actualStartDate": "2025-11-21T11:00:00.000Z",
        "actualCompletionDate": "2025-11-21T14:00:00.000Z",
        "actualHours": 3,
        "workCenterCode": "WC-001",
        "workCenterDescription": "Maintenance Department",
        "workAreaCode": "WA-001",
        "workAreaDescription": "Production Area A",
        "organizationCode": "ORG001",
        "organizationName": "Main Plant",
        "createdBy": "550e8400-e29b-41d4-a716-446655440001",
        "createdByName": "John Doe",
        "createdAt": "2025-11-21T08:00:00.000Z",
        "updatedAt": "2025-11-21T08:00:00.000Z",
        "workOrderOperationResource": [
          {
            "id": 10003,
            "resourceCode": "RES-001",
            "resourceSequenceNumber": 1,
            "plannedHours": 2,
            "actualHours": 2,
            "principalFlag": "Y",
            "actualStartDate": "2025-11-21T11:00:00.000Z",
            "actualCompletionDate": "2025-11-21T13:00:00.000Z",
            "status": "ACTIVE",
            "organizationCode": "ORG001",
            "createdBy": "550e8400-e29b-41d4-a716-446655440001",
            "createdByName": "John Doe",
            "createdAt": "2025-11-21T08:00:00.000Z",
            "updatedAt": "2025-11-21T08:00:00.000Z",
            "transactedInOracle": "N",
            "oclWoOperationResourceId": null,
            "syncedToOracleAt": null
          },
          {
            "id": 10004,
            "resourceCode": "RES-003",
            "resourceSequenceNumber": 2,
            "plannedHours": 1,
            "actualHours": 1,
            "principalFlag": "N",
            "actualStartDate": "2025-11-21T13:00:00.000Z",
            "actualCompletionDate": "2025-11-21T14:00:00.000Z",
            "status": "ACTIVE",
            "organizationCode": "ORG001",
            "createdBy": "550e8400-e29b-41d4-a716-446655440001",
            "createdByName": "John Doe",
            "createdAt": "2025-11-21T08:00:00.000Z",
            "updatedAt": "2025-11-21T08:00:00.000Z",
            "transactedInOracle": "N",
            "oclWoOperationResourceId": null,
            "syncedToOracleAt": null
          }
        ],
        "workOrderOperationMaterial": []
      }
    ]
  }
}
```

### Errors

**R-WO-CR-31**

IF the request contains validation errors,  
THEN the system SHALL return a 400 status with a `message` field containing an array of validation error strings (e.g., `["workOrderDescription should not be empty"]`). For nested DTO validation, messages include the field path (e.g., `["operations.0.operationName must be longer than or equal to 2 characters"]`).

**R-WO-CR-32**

IF `enableOracleWorkOrder = "Y"` and `ENABLE_ORACLE_WORK_ORDER_SYSTEM = "Y"` and the user lacks the Oracle permission (`oracle.mnt.work.orders.create`) or does not have an allowed role,  
THEN the system SHALL return a 403 status with error code `MISSING_ORACLE_PERMISSION`.

**R-WO-CR-33**

IF the user's role (from gateway-injected `userRoles`) is not authorized for the requested sub-type,  
THEN the system SHALL return a 403 status with error code `SUBTYPE_NOT_ALLOWED_FOR_ROLE`.

**R-WO-CR-33B**

IF the asset's `organizationCode` does not match the gateway-injected `organizationCode`,  
THEN the system SHALL return a 403 status with error code `ORGANIZATION_MISMATCH`.

**R-WO-CR-34**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Get Work Orders

### Communication

NATS Pattern: `work.order.find.all` (via gateway)

Gateway endpoint: GET /api/v1/work-orders

### Purpose

Retrieves Work Orders using dynamic filtering, sorting, and pagination.

### Authentication & Authorization

The endpoint requires:

- **Gateway Auth**: Valid authentication token delegated to the gateway.

#### Gateway-Injected Fields

The gateway MUST inject the following fields into the NATS payload:

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |
| userPermissions  | string[] | Permission codes for the user in the target organization          |

The microservice SHALL enforce tenant isolation, role presence, and read permission using the injected fields.

### Request

The query payload SHALL support:

- `filters`: array of filter objects `{ field, operator, value }`
- `order`: array of sort criteria `[field, ASC|DESC]`
- `limit`: maximum number of rows to return
- `offset`: number of rows to skip

No legacy top-level query fields are supported. Filtering by `assetCode`, `woStatusCode`, `workOrderType`, `workOrderSubType`, or `organizationCode` SHALL be done using the `filters` array.

#### Supported Operators

| Operator | Description                         |
| -------- | ----------------------------------- |
| `eq`     | Equals                              |
| `like`   | Contains / Partial match            |
| `gt`     | Greater than (for numbers or dates) |
| `lt`     | Less than (for numbers or dates)    |
| `in`     | Belongs to list                     |

#### Allowed Filter Fields

- `workOrderCode`
- `assetCode`
- `workOrderDescription`
- `woStatusCode`
- `workOrderType`
- `workOrderSubType`
- `organizationCode`
- `workCenterCode`
- `workAreaCode`
- `createdAt`
- `actualStartDate`
- `actualCompletionDate`
- `releasedDate`
- `closedDate`
- `canceledDate`

#### Example Request Payload

```json
{
  "organizationCode": "ORG-BOG-001",
  "userRoles": ["PLANNER_MAINTENANCE_01"],
  "userPermissions": ["mnt.work.orders.view"],
  "filters": [
    {
      "field": "woStatusCode",
      "operator": "eq",
      "value": "RELEASED"
    },
    {
      "field": "assetCode",
      "operator": "like",
      "value": "AST-"
    }
  ],
  "order": [["createdAt", "DESC"]],
  "limit": 10,
  "offset": 0
}
```

### Validations

**R-WO-GE-01**

IF `organizationCode` is missing, empty, or invalid in the query payload,  
THEN the system SHALL reject the request.

**R-WO-GE-02**

IF `filters`, `order`, `limit`, or `offset` have malformed structure or invalid values,  
THEN the system SHALL reject the request with a 400 status and message `Invalid filter data`.

**R-WO-GE-03**

IF any filter uses an unsupported `field` or `operator`,  
THEN the system SHALL reject the request with a 400 status and message `Invalid filter data`.

**R-WO-GE-04**

IF `limit` or `offset` is provided and is not a non-negative integer,  
THEN the system SHALL reject the request with a 400 status and message `Invalid filter data`.

**R-WO-GE-05**

IF `userPermissions` does not include `mnt.work.orders.view`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_PERMISSION`.

> Read access is governed ONLY by the `mnt.work.orders.view` permission. Any user with it can see all Work Orders of the target organization, regardless of role or Work Order sub-type. Sub-type restrictions apply only to create and update operations.

### Processing

**R-WO-GE-06**

WHEN a valid query is received,  
the system SHALL:

1. Enforce organization isolation using injected `organizationCode`
2. Enforce read permission using injected `userPermissions` (`mnt.work.orders.view`)
3. Build dynamic query conditions from `filters` using AND logic
4. Apply sort criteria from `order` (default: `createdAt DESC`, `workOrderCode DESC`)
5. Apply pagination from `limit` and `offset`
6. Return the list and total count of records matching the same WHERE condition

### Response

**R-WO-GE-07**

WHEN the query executes successfully,  
the system SHALL return:

- `workOrders`: array of Work Orders
- `total`: total number of records matching the query condition

Each Work Order in `workOrders` SHALL include full nested data:

- Work Order fields
- All ACTIVE operations (excludes operations with `status = "CANCELED"`)
- All ACTIVE resources within each operation (excludes resources with `status = "CANCELED"`)
- All operation materials
- `woStatusCode` and `woStatusLabel`
- `operationStatus` and `operationStatusLabel`

> To include canceled operations and resources, the query payload MAY include `includeCanceled: "Y"`.

### Errors

**R-WO-GE-08**

IF no Work Orders match the query,  
THEN the system SHALL return an empty array and `total = 0`.

**R-WO-GE-09**

IF the requester is not authorized for the organization context,  
THEN the system SHALL return a 403 status.

**R-WO-GE-10**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Get Work Order By Code

### Communication

NATS Pattern: `work.order.find.one` (via gateway)

Gateway endpoint: GET /api/v1/work-orders/:workOrderCode

### Purpose

Retrieves one Work Order by `workOrderCode` with full nested operational detail.

### Authentication & Authorization

The endpoint requires:

- **Gateway Auth**: Valid authentication token delegated to the gateway.

#### Gateway-Injected Fields

The gateway MUST inject the following fields into the NATS payload:

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |
| userPermissions  | string[] | Permission codes for the user in the target organization          |

### Request

Required payload fields:

- `workOrderCode`
- `organizationCode`
- `userRoles`
- `userPermissions`

### Validations

**R-WO-FO-01**

IF `workOrderCode` is missing or invalid,  
THEN the system SHALL reject the request.

**R-WO-FO-02**

IF `organizationCode` is missing, empty, or invalid,  
THEN the system SHALL reject the request.

**R-WO-FO-03**

IF `userPermissions` does not include `mnt.work.orders.view`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_PERMISSION`.

> Read access is governed ONLY by the `mnt.work.orders.view` permission. Any user with it can view the Work Order, regardless of role or sub-type. Sub-type restrictions apply only to create and update operations.

### Processing

**R-WO-FO-04**

WHEN a valid request is received,  
the system SHALL:

1. Find the Work Order by `workOrderCode`
2. Validate organization ownership against injected `organizationCode`
3. Validate read permission using injected `userPermissions` (`mnt.work.orders.view`)
4. Load all ACTIVE operations, ACTIVE resources, and materials
5. Return the mapped response including status labels and BigInt string serialization

> To include canceled operations and resources, the query payload MAY include `includeCanceled: "Y"`.

### Response

**R-WO-FO-05**

WHEN the Work Order is found and access is allowed,  
the system SHALL return a `workOrder` object including:

- All Work Order fields
- `woStatusCode` and `woStatusLabel`
- All ACTIVE operations with `operationStatus` and `operationStatusLabel`
- All ACTIVE resources and materials

### Errors

**R-WO-FO-06**

IF the Work Order does not exist,  
THEN the system SHALL return a 404 status with message `Work order not found`.

**R-WO-FO-07**

IF the Work Order exists but belongs to a different organization,  
THEN the system SHALL return a 403 status with error code `ORGANIZATION_MISMATCH`.

**R-WO-FO-08**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Update Work Order

### Communication

NATS Pattern: `work.order.update` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode`

### Purpose

Partially updates editable fields of an existing Work Order. Does not change status, operations, resources, or materials — those have dedicated endpoints.

### Authentication & Authorization

The endpoint requires:

- **Gateway Auth**: Valid authentication token delegated to the gateway.

#### Gateway-Injected Fields

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| actorId          | string   | User ID from JWT payload                                          |
| actorName        | string   | User name from JWT payload                                        |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userPermissions  | string[] | Permissions from the user's role(s) in the target organization    |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |

#### PolicyContext for Update

The system SHALL enforce two policy contexts for update operations:

**LocalUpdatePolicy**: When `enableOracleWorkOrder = "N"` or `ENABLE_ORACLE_WORK_ORDER_SYSTEM = "N"`:

- User must have permission `mnt.work.orders.update` in the target organization

**OracleUpdatePolicy**: When `enableOracleWorkOrder = "Y"` and `ENABLE_ORACLE_WORK_ORDER_SYSTEM = "Y"`:

- User must have permission `mnt.work.orders.update` in the target organization
- User must have permission `oracle.mnt.work.orders.update` in the target organization
- User must have one of the allowed roles (same as OracleWorkOrderPolicy)

Allowed roles for Oracle operations:

- MANUFACTURING_FACILITATOR, TECHNICIAN_MAINTENANCE_01, TECHNICIAN_MAINTENANCE_02, PLANNER_MAINTENANCE_01, PLANNER_MAINTENANCE_02, COORDINATOR_MAINTENANCE_01, COORDINATOR_MAINTENANCE_02, SUPERVISOR_MAINTENANCE_01, SUPERVISOR_MAINTENANCE_02, ADMIN

### Request

#### Required Fields

| Field                 | Type              | Max Length | Description                                        |
| --------------------- | ----------------- | ---------- | -------------------------------------------------- |
| enableOracleWorkOrder | string ("Y"\|"N") | 1          | Flag to enable Oracle integration for this update. |

#### Editable Fields (All Optional)

| Field                | Type                        | Max Length | Description                                               |
| -------------------- | --------------------------- | ---------- | --------------------------------------------------------- |
| workOrderDescription | string                      | 240        | Updated description of the work order.                    |
| workOrderType        | string                      | 30         | Updated work order type (e.g., "Planned", "Not Planned"). |
| workOrderSubType     | string                      | 30         | Updated work order sub-type.                              |
| workOrderPriority    | string ("1"\|"2"\|"3"\|"4") | -          | Updated priority level.                                   |

#### Example Request Payload

```json
{
  "workOrderCode": "1001",
  "organizationCode": "ORG-BOG-001",
  "userPermissions": ["mnt.work.orders.update"],
  "userRoles": ["PLANNER_MAINTENANCE_01"],
  "actorId": "550e8400-e29b-41d4-a716-446655440001",
  "actorName": "John Doe",
  "enableOracleWorkOrder": "N",
  "workOrderDescription": "Updated description"
}
```

### Validations

**R-WO-UP-01**

IF `workOrderCode` is missing or invalid,  
THEN the system SHALL reject the request.

**R-WO-UP-02**

IF `organizationCode` is missing, empty, or invalid,  
THEN the system SHALL reject the request.

**R-WO-UP-03**

IF `userPermissions` does not include `mnt.work.orders.update`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_PERMISSION`.

**R-WO-UP-04**

IF `enableOracleWorkOrder = "Y"` and `ENABLE_ORACLE_WORK_ORDER_SYSTEM = "Y"` and `userPermissions` does not include `oracle.mnt.work.orders.update`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_ORACLE_PERMISSION`.

**R-WO-UP-05**

IF the Work Order does not exist,  
THEN the system SHALL reject the request with a 404 status and message `Work order not found`.

**R-WO-UP-06**

IF the Work Order's `organizationCode` does not match the gateway-injected `organizationCode`,  
THEN the system SHALL reject the request with a 403 status and error code `ORGANIZATION_MISMATCH`.

**R-WO-UP-07**

IF `workOrderType` and/or `workOrderSubType` are provided and their combination is not allowed,  
THEN the system SHALL reject the request with a 400 status.

Allowed combinations (same as create):

```json
[
  { "workOrderType": "Planned", "workOrderSubType": "Preventive" },
  { "workOrderType": "Planned", "workOrderSubType": "Corrective" },
  { "workOrderType": "Planned", "workOrderSubType": "Inspection" },
  { "workOrderType": "Planned", "workOrderSubType": "TPM" },
  { "workOrderType": "Not Planned", "workOrderSubType": "Emergency" }
]
```

**R-WO-UP-08**

IF `workOrderSubType` is provided and the user's roles are not authorized to access the requested sub-type,  
THEN the system SHALL reject the request with a 403 status and error code `SUBTYPE_NOT_ALLOWED_FOR_ROLE`.

Role-based sub-type restrictions (same table as create):

| Role                       | Allowed Sub-Types                             |
| -------------------------- | --------------------------------------------- |
| MANUFACTURING_FACILITATOR  | Emergency                                     |
| TECHNICIAN_MAINTENANCE_01  | Corrective                                    |
| TECHNICIAN_MAINTENANCE_02  | Corrective, Emergency, Inspection             |
| PLANNER_MAINTENANCE_01     | Preventive, Corrective, Emergency, Inspection |
| PLANNER_MAINTENANCE_02     | Preventive, Corrective, Emergency, Inspection |
| COORDINATOR_MAINTENANCE_01 | Preventive, Corrective, Emergency             |
| COORDINATOR_MAINTENANCE_02 | Preventive, Corrective, Emergency             |
| SUPERVISOR_MAINTENANCE_01  | Emergency                                     |
| SUPERVISOR_MAINTENANCE_02  | Emergency                                     |
| ADMIN                      | All (no restrictions)                         |

**R-WO-UP-09**

IF `workOrderPriority` is provided and is not one of "1", "2", "3", "4",  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-WO-UP-10**

WHEN a valid update request is received,  
the system SHALL:

1. Validate all permissions and authorizations
2. Find the Work Order by `workOrderCode`
3. Validate organization ownership
4. Apply only the provided fields (partial update)
5. Set `updatedBy`, `updatedByName`, and `updatedAt` to the current actor and timestamp
6. Return the full updated Work Order with all nested operations, resources, and materials

### Response

**R-WO-UP-11**

WHEN the update is successful,  
the system SHALL return a 200 status with the updated Work Order wrapped in a `workOrder` object including all fields and nested data (same structure as `work.order.find.one` response).

### Errors

**R-WO-UP-12**

IF the request contains validation errors,  
THEN the system SHALL return a 400 status with a `message` field containing validation error strings.

**R-WO-UP-13**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Release Work Order

### Communication

NATS Pattern: `work.order.release` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode/release`

### Purpose

Transitions a Work Order from `UNRELEASED` or `ON_HOLD` to `RELEASED` status.

### Gateway-Injected Fields

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |
| actorId          | string   | User ID from JWT payload                                          |
| actorName        | string   | User name from JWT payload                                        |

### Validations

**R-WO-RL-01**

IF the Work Order does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-WO-RL-02**

IF the Work Order's current status does not allow transition to `RELEASED`,  
THEN the system SHALL reject the request with a 400 status.

Allowed transitions to `RELEASED`:

- `UNRELEASED` → `RELEASED`
- `ON_HOLD` → `RELEASED`

### Processing

**R-WO-RL-03**

WHEN a Work Order is released,  
the system SHALL set `releasedDate` to the current timestamp.

### Response

Returns the updated Work Order with `woStatusCode: "RELEASED"` and `releasedDate` set.

### Errors

**R-WO-RL-04**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Hold On Work Order

### Communication

NATS Pattern: `work.order.hold` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode/hold`

### Purpose

Transitions a Work Order from `UNRELEASED` or `RELEASED` to `ON_HOLD` status.

### Gateway-Injected Fields

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |
| actorId          | string   | User ID from JWT payload                                          |
| actorName        | string   | User name from JWT payload                                        |

### Validations

**R-WO-HO-01**

IF the Work Order does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-WO-HO-02**

IF the Work Order's current status does not allow transition to `ON_HOLD`,  
THEN the system SHALL reject the request with a 400 status.

Allowed transitions to `ON_HOLD`:

- `UNRELEASED` → `ON_HOLD`
- `RELEASED` → `ON_HOLD`

### Full Status Transition Reference

| From Status      | Allowed Transitions To       |
| ---------------- | ---------------------------- |
| UNRELEASED       | ON_HOLD, RELEASED, CANCELED  |
| RELEASED         | COMPLETED, ON_HOLD, CANCELED |
| ON_HOLD          | RELEASED, CANCELED           |
| COMPLETED        | CLOSED, RELEASED             |
| CLOSED           | [] (terminal)                |
| CANCELED         | [] (terminal)                |
| PENDING_APPROVAL | UNRELEASED                   |

### Response

Returns the updated Work Order with `woStatusCode: "ON_HOLD"`.

### Errors

**R-WO-HO-04**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Complete Work Order

### Communication

NATS Pattern: `work.order.complete` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode/complete`

### Purpose

Transitions a Work Order from `RELEASED` to `COMPLETED` status.

### Gateway-Injected Fields

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |
| actorId          | string   | User ID from JWT payload                                          |
| actorName        | string   | User name from JWT payload                                        |

### Validations

**R-WO-CM-01**

IF the Work Order does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-WO-CM-02**

IF the Work Order's current status is not `RELEASED`,  
THEN the system SHALL reject the request with a 400 status.

### Full Status Transition Reference

| From Status      | Allowed Transitions To       |
| ---------------- | ---------------------------- |
| UNRELEASED       | ON_HOLD, RELEASED, CANCELED  |
| RELEASED         | COMPLETED, ON_HOLD, CANCELED |
| ON_HOLD          | RELEASED, CANCELED           |
| COMPLETED        | CLOSED, RELEASED             |
| CLOSED           | [] (terminal)                |
| CANCELED         | [] (terminal)                |
| PENDING_APPROVAL | UNRELEASED                   |

### Response

Returns the updated Work Order with `woStatusCode: "COMPLETED"`.

### Errors

**R-WO-CM-03**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Close Work Order

### Communication

NATS Pattern: `work.order.close` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode/close`

### Purpose

Transitions a Work Order from `COMPLETED` to `CLOSED` status (terminal state).

### Gateway-Injected Fields

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |
| actorId          | string   | User ID from JWT payload                                          |
| actorName        | string   | User name from JWT payload                                        |

### Validations

**R-WO-CL-01**

IF the Work Order does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-WO-CL-02**

IF the Work Order's current status is not `COMPLETED`,  
THEN the system SHALL reject the request with a 400 status.

### Full Status Transition Reference

| From Status      | Allowed Transitions To       |
| ---------------- | ---------------------------- |
| UNRELEASED       | ON_HOLD, RELEASED, CANCELED  |
| RELEASED         | COMPLETED, ON_HOLD, CANCELED |
| ON_HOLD          | RELEASED, CANCELED           |
| COMPLETED        | CLOSED, RELEASED             |
| CLOSED           | [] (terminal)                |
| CANCELED         | [] (terminal)                |
| PENDING_APPROVAL | UNRELEASED                   |

### Processing

**R-WO-CL-03**

WHEN a Work Order is closed,  
the system SHALL set `closedDate` to the current timestamp.

### Response

Returns the updated Work Order with `woStatusCode: "CLOSED"` and `closedDate` set.

### Errors

**R-WO-CL-04**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Cancel Work Order

### Communication

NATS Pattern: `work.order.cancel` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode/cancel`

### Purpose

Cancels a Work Order and all its operations (terminal state).

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
| `mnt.work.orders.cancel`        | Required to cancel a Work Order                                             |
| `oracle.mnt.work.orders.cancel` | Required when Oracle integration is enabled and the WO was synced to Oracle |

### Request

| Field          | Type   | Required | Description                                   |
| -------------- | ------ | -------- | --------------------------------------------- |
| canceledReason | string | Yes      | Reason for cancellation (max 240 characters). |

### Validations

**R-WO-CN-01**

IF `userPermissions` does not include `mnt.work.orders.cancel`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_PERMISSION`.

**R-WO-CN-02**

IF `enableOracleWorkOrder = "Y"` and `ENABLE_ORACLE_WORK_ORDER_SYSTEM = "Y"` and `userPermissions` does not include `oracle.mnt.work.orders.cancel`,  
THEN the system SHALL reject the request with a 403 status and error code `MISSING_ORACLE_PERMISSION`.

**R-WO-CN-03**

IF the Work Order does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-WO-CN-04**

IF the Work Order's current status does not allow transition to `CANCELED`,  
THEN the system SHALL reject the request with a 400 status.

Allowed transitions to `CANCELED`:

- `UNRELEASED` → `CANCELED`
- `RELEASED` → `CANCELED`
- `ON_HOLD` → `CANCELED`

**R-WO-CN-04B**

IF the Work Order has only one ACTIVE operation,  
THEN the system SHALL allow the cancellation (the operation will be canceled along with the WO).

### Full Status Transition Reference

| From Status      | Allowed Transitions To       |
| ---------------- | ---------------------------- |
| UNRELEASED       | ON_HOLD, RELEASED, CANCELED  |
| RELEASED         | COMPLETED, ON_HOLD, CANCELED |
| ON_HOLD          | RELEASED, CANCELED           |
| COMPLETED        | CLOSED, RELEASED             |
| CLOSED           | [] (terminal)                |
| CANCELED         | [] (terminal)                |
| PENDING_APPROVAL | UNRELEASED                   |

**R-WO-CN-05**

IF `canceledReason` is missing or empty,  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-WO-CN-06**

WHEN a Work Order is canceled,  
the system SHALL:

1. Set `woStatusCode` to `CANCELED`
2. Set `canceledDate` to the current timestamp
3. Set `canceledReason` to the provided value
4. Set all operations' `operationStatus` to `CANCELED`
5. Set all resources' `status` to `CANCELED`
6. Persist all changes within a single transaction

### Response

Returns the updated Work Order with `woStatusCode: "CANCELED"`, `canceledDate` set, `canceledReason` set, and all operations with `operationStatus: "CANCELED"`.

### Errors

**R-WO-CN-07**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Reprogram Work Order

### Communication

NATS Pattern: `work.order.reprogram` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode/reprogram`

### Purpose

Reprograms the `actualStartDate` of a Work Order by applying a date delta to all associated operations and resources. This is the ONLY endpoint that allows manual modification of `actualStartDate` at the Work Order level.

### Gateway-Injected Fields

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| actorId          | string   | User ID from JWT payload                                          |
| actorName        | string   | User name from JWT payload                                        |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userPermissions  | string[] | Permissions from the user's role(s) in the target organization    |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |

### Request

| Field              | Type              | Required | Description                                   |
| ------------------ | ----------------- | -------- | --------------------------------------------- |
| newActualStartDate | string (ISO 8601) | Yes      | The new actual start date for the Work Order. |

### Validations

**R-WO-RP-01**

IF the Work Order does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-WO-RP-02**

IF `newActualStartDate` is missing or not a valid ISO 8601 datetime,  
THEN the system SHALL reject the request with a 400 status.

**R-WO-RP-03**

IF the Work Order's current status is `CANCELED` or `CLOSED`,  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-WO-RP-04**

WHEN a valid reprogram request is received,  
the system SHALL:

1. Calculate the delta: `delta = newActualStartDate - current actualStartDate`
2. Apply the delta to all ACTIVE operations:
   - Operation `actualStartDate` = current `actualStartDate` + delta
   - Operation `actualCompletionDate` = current `actualCompletionDate` + delta
3. Apply the delta to all ACTIVE resources within each ACTIVE operation:
   - Resource `actualStartDate` = current `actualStartDate` + delta
   - Resource `actualCompletionDate` = current `actualCompletionDate` + delta
4. Set the Work Order's `actualStartDate` to `newActualStartDate`
5. Recalculate the Work Order's `actualCompletionDate` as the MAX of all ACTIVE operations' (new) `actualCompletionDate`
6. Set `updatedBy`, `updatedByName`, and `updatedAt` on the Work Order, all affected operations, and all affected resources
7. Persist all changes within a single transaction

### Response

**R-WO-RP-05**

WHEN the reprogram is successful,  
the system SHALL return a 200 status with the updated Work Order including:

- The new `actualStartDate`
- The recalculated `actualCompletionDate`
- All operations with updated dates
- All resources with updated dates

### Errors

**R-WO-RP-06**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Pending Approval Work Order

### Communication

NATS Pattern: `work.order.pending-approval` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode/pending-approval`

### Purpose

Transitions a Work Order from `PENDING_APPROVAL` to `UNRELEASED` status.

### Gateway-Injected Fields

| Field            | Type     | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| organizationCode | string   | Target organization from `X-Organization-Code` header (validated) |
| userRoles        | string[] | Role codes from the user's assignments in the target organization |
| actorId          | string   | User ID from JWT payload                                          |
| actorName        | string   | User name from JWT payload                                        |

### Validations

**R-WO-PA-01**

IF the Work Order does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-WO-PA-02**

IF the Work Order's current status is not `PENDING_APPROVAL`,  
THEN the system SHALL reject the request with a 400 status.

Allowed transitions from `PENDING_APPROVAL`:

- `PENDING_APPROVAL` → `UNRELEASED`

### Full Status Transition Reference

| From Status      | Allowed Transitions To       |
| ---------------- | ---------------------------- |
| UNRELEASED       | ON_HOLD, RELEASED, CANCELED  |
| RELEASED         | COMPLETED, ON_HOLD, CANCELED |
| ON_HOLD          | RELEASED, CANCELED           |
| COMPLETED        | CLOSED, RELEASED             |
| CLOSED           | [] (terminal)                |
| CANCELED         | [] (terminal)                |
| PENDING_APPROVAL | UNRELEASED                   |

### Response

Returns the updated Work Order with `woStatusCode: "UNRELEASED"`.

### Errors

**R-WO-PA-04**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Status Transition Reference

### Work Order Status Transitions

| From Status      | Allowed Transitions To       |
| ---------------- | ---------------------------- |
| UNRELEASED       | ON_HOLD, RELEASED, CANCELED  |
| RELEASED         | COMPLETED, ON_HOLD, CANCELED |
| ON_HOLD          | RELEASED, CANCELED           |
| COMPLETED        | CLOSED, RELEASED             |
| CLOSED           | [] (terminal)                |
| CANCELED         | [] (terminal)                |
| PENDING_APPROVAL | UNRELEASED                   |

### Work Order Status / Operation Status Compatibility

| woStatusCode     | Allowed operationStatus values  |
| ---------------- | ------------------------------- |
| UNRELEASED       | UNRELEASED                      |
| RELEASED         | RELEASED, COMPLETED, IN_PROCESS |
| ON_HOLD          | ON_HOLD                         |
| PENDING_APPROVAL | UNRELEASED                      |
| COMPLETED        | COMPLETED, NOT_DONE             |
| CLOSED           | COMPLETED, NOT_DONE             |
| CANCELED         | CANCELED                        |
