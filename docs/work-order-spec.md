# Work Order Module

## Create Work Order

### Communication

NATS Pattern: `work.order.create` (via gateway)

Gateway endpoint: POST /mnt-work-order

### Purpose

Creates a new Work Order with one or more operations, each containing resources and optional materials.

### Authentication & Authorization

The endpoint requires:

- **Gateway Auth**: Valid authentication token delegated to the gateway. The gateway resolves the user's permissions and roles from the auth service and injects them into the NATS payload.

#### Gateway-Injected Fields

The gateway MUST inject the following fields into the NATS payload after validating the JWT token and resolving the target organization from the `X-Organization-Code` header:

| Field             | Type       | Source                                                                 |
| ----------------- | ---------- | ---------------------------------------------------------------------- |
| actorId           | string     | User ID from JWT payload                                               |
| actorName         | string     | User name from JWT payload                                             |
| organizationCode  | string     | Target organization from `X-Organization-Code` header (validated)      |
| userPermissions   | string[]   | Permissions from the user's role(s) in the target organization         |
| userRoles         | string[]   | Role codes from the user's assignments in the target organization      |

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

| Field                | Type                        | Max Length | Description                                                          |
| -------------------- | --------------------------- | ---------- | -------------------------------------------------------------------- |
| workOrderDescription | string                      | 240        | Description of the work order.                                       |
| woStatusCode         | string                      | 30         | Status code in UPPER_SNAKE_CASE (e.g., "UNRELEASED", "RELEASED").    |
| assetCode            | string                      | 80         | Asset identifier.                                                    |
| workOrderType        | string                      | 30         | Work order type (e.g., "Planned", "Not Planned").                    |
| workOrderSubType     | string                      | 30         | Work order sub-type (e.g., "Preventive", "Corrective", "Emergency"). |
| workOrderPriority    | string ("1"\|"2"\|"3"\|"4") | -          | Priority level (1=highest, 4=lowest).                                |
| enableOracleWorkOrder| string ("Y"\|"N")           | 1          | Flag to enable Oracle integration.                                   |
| operations           | array                       | -          | Array of operations. If empty or missing, a default operation is created. |

#### Gateway-Injected Fields (Work Order Level)

These fields are injected by the gateway and SHALL NOT be provided by the client:

| Field             | Type       | Description                                                        |
| ----------------- | ---------- | ------------------------------------------------------------------ |
| actorId           | string     | User ID from JWT payload.                                          |
| actorName         | string     | User name from JWT payload.                                        |
| userPermissions   | string[]   | Flattened array of permission codes from all user roles.           |
| userRoles         | string[]   | Array of role codes from the user's organization assignments.      |

#### Optional Fields (Work Order Level)

| Field                 | Type              | Default | Description                                         |
| --------------------- | ----------------- | ------- | --------------------------------------------------- |
| workRequestId         | BigInt            | null    | Associated work request identifier.                 |
| workDefinitionCode    | string            | -       | Work definition code.                               |
| schedulingMethod      | string            | -       | Scheduling method.                                  |
| needByDate            | Date (ISO 8601)   | -       | Date by which the work order needs to be completed. |
| plannedStartDate      | Date (ISO 8601)   | -       | Planned start date (for advanced scheduling).       |
| plannedCompletionDate | Date (ISO 8601)   | -       | Planned completion date (for advanced scheduling).  |

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

| Field                  | Type              | Description                                                                                |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------------------ |
| resourceCode           | string            | Resource identifier.                                                                       |
| resourceSequenceNumber | integer (>= 0)    | Sequence number for grouping resources. Resources with the same sequence work in parallel. |
| plannedHours           | number (> 0)      | Planned hours for the resource.                                                            |
| actualHours            | number (> 0)      | Actual hours for the resource. Must be greater than 0.                                     |
| principalFlag          | string ("Y"\|"N") | Principal flag indicator.                                                                  |

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

| Field                 | Type          | Description                                                     |
| --------------------- | ------------- | --------------------------------------------------------------- |
| workOrderCode         | BigInt        | Auto-generated unique identifier.                               |
| actualHours           | Float         | Sum of all operations' actualHours (calculated from resources). |
| totalManHours         | Float         | Total man hours from operations.                                |
| totalSupplierHours    | Float         | Total supplier hours from operations.                           |
| createdAt             | DateTime      | Record creation timestamp.                                      |
| updatedAt             | DateTime      | Last update timestamp.                                          |
| updatedBy             | string        | Last updated by user.                                           |
| updatedByName         | string        | Last updated by user name.                                      |
| createdBy             | string (UUID) | User identifier who creates the work order.                     |
| createdByName         | string        | Creator user name.                                              |
| woStatusLabel         | string        | Title Case label for woStatusCode (e.g., "Unreleased").         |
| actualStartDate       | DateTime      | Work order actual start date (calculated).                      |
| actualCompletionDate  | DateTime      | Work order actual completion date (calculated).                 |
| workCenterCode        | string        | Work center code (inferred from asset).                         |
| workCenterDescription | string        | Work center description (inferred from asset).                  |
| centerCostCode        | integer       | Cost center code (inferred from asset).                         |
| workAreaCode          | string        | Work area code (inferred from asset).                           |
| workAreaDescription   | string        | Work area description (inferred from asset).                    |
| sector                | string        | Sector (inferred from asset).                                   |
| subsector             | string        | Subsector (inferred from asset).                                |
| organizationCode      | string        | Organization code.                                              |
| organizationName      | string        | Organization name (inferred from asset).                        |
| assetShortDescription | string        | Asset short description (inferred from asset).                  |
| plannedHours          | Float         | Planned hours (aggregated).                                     |
| releasedDate          | DateTime      | Release timestamp.                                              |
| closedDate            | DateTime      | Close timestamp.                                                |
| canceledDate          | DateTime      | Cancellation timestamp.                                         |
| canceledReason        | string        | Reason for cancellation (required when canceling).              |
| oclWorkOrderId        | BigInt        | Oracle Cloud work order ID.                                     |
| oclWorkOrderNumber    | string        | Oracle Cloud work order number.                                 |

#### System Generated / Calculated Fields (Operation Level)

| Field                 | Type     | Description                                                |
| --------------------- | -------- | ---------------------------------------------------------- |
| operationCode         | BigInt   | Auto-generated unique identifier.                          |
| actualHours           | Float    | Calculated from resources.                                 |
| operationStatusLabel  | string   | Title Case label for operationStatus (e.g., "Unreleased"). |
| createdAt             | DateTime | Record creation timestamp.                                 |
| updatedAt             | DateTime | Last update timestamp.                                     |
| updatedBy             | string   | Last updated by user.                                      |
| updatedByName         | string   | Last updated by user name.                                 |
| createdByName         | string   | Creator user name.                                         |
| assetCode             | string   | Asset code (propagated from Work Order).                   |
| assetShortDescription | string   | Asset short description (propagated from Work Order).      |
| workCenterCode        | string   | Work center code.                                          |
| workCenterDescription | string   | Work center description.                                   |
| centerCostCode        | integer  | Cost center code.                                          |
| workAreaCode          | string   | Work area code.                                            |
| workAreaDescription   | string   | Work area description.                                     |
| sector                | string   | Sector.                                                    |
| subsector             | string   | Subsector.                                                 |
| organizationCode      | string   | Organization code.                                         |
| organizationName      | string   | Organization name.                                         |
| oclWorkOrderId        | BigInt   | Oracle Cloud work order ID.                                |
| oclWorkOrderNumber    | string   | Oracle Cloud work order number.                            |
| plannedStartDate      | DateTime | Planned start date.                                        |
| plannedCompletionDate | DateTime | Planned completion date.                                   |
| plannedHours          | Float    | Planned hours.                                             |
| reviewedBy            | string   | Reviewed by user.                                          |
| reviewedByName        | string   | Reviewed by user name.                                     |
| reviewedAt            | DateTime | Review timestamp.                                          |

#### System Generated / Calculated Fields (Resource Level)

| Field                    | Type              | Description                       |
| ------------------------ | ----------------- | --------------------------------- |
| id                       | BigInt            | Auto-generated unique identifier. |
| operationCode            | BigInt            | Parent operation identifier.      |
| organizationCode         | string            | Organization code.                |
| transactedInOracle       | string ("Y"\|"N") | Oracle transaction flag.          |
| oclWoOperationResourceId | BigInt            | Oracle Cloud resource ID.         |
| syncedToOracleAt         | DateTime          | Oracle sync timestamp.            |
| createdBy                | string            | Creator user identifier.          |
| createdByName            | string            | Creator user name.                |
| updatedBy                | string            | Last updated by user.             |
| updatedByName            | string            | Last updated by user name.        |
| createdAt                | DateTime          | Record creation timestamp.        |
| updatedAt                | DateTime          | Last update timestamp.            |

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
  "userPermissions": ["mnt.work.orders.create", "oracle.mnt.work.orders.create"],
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
          "actualHours": 2
        },
        {
          "principalFlag": "N",
          "resourceCode": "RES-002",
          "resourceSequenceNumber": 1,
          "plannedHours": 3,
          "actualHours": 3
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
          "actualHours": 2
        },
        {
          "principalFlag": "N",
          "resourceCode": "RES-003",
          "resourceSequenceNumber": 2,
          "plannedHours": 1,
          "actualHours": 1
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

IF an operation with a lower `operationSeqNumber` has an `actualStartDate` later than an operation with a higher `operationSeqNumber`,  
THEN the system SHALL reject the request (operations must follow sequential order).

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

WHEN no `operations` array is provided or it is empty,  
the system SHALL create a default operation with:

- operationName: "DEFAULT_OPERATION"
- operationDescription: "Auto-generated default operation"
- operationSeqNumber: 1
- operationStatus: "UNRELEASED"
- operationType: "Internal"
- operationSubType: same as parent Work Order's workOrderSubType
- actualStartDate: current time (or provided actualStartDate)
- actualCompletionDate: start + 1 hour
- One default resource with principalFlag "N"

**R-WO-CR-26**

WHEN a valid Work Order creation request is received,  
the system SHALL:

1. Validate all DTO-level constraints
2. Validate type/subtype combination
3. Validate `operationSubType` matches `workOrderSubType` for all operations
4. Create WorkOperation entities from the operations array
5. Calculate each operation's `actualHours` from its resources:
   - Resources with the same `resourceSequenceNumber` work in PARALLEL → take MAX(actualHours)
   - Resources with different `resourceSequenceNumber` work SEQUENTIALLY → SUM the MAX of each group
6. Recalculate each operation's `actualCompletionDate` as `actualStartDate + calculated actualHours`
7. Validate operations sequential order (unique seqNumbers, chronological start dates)
8. Calculate Work Order `actualHours` as the sum of all operations' actualHours
9. Calculate Work Order `actualStartDate` as the earliest among all operations
10. Calculate Work Order `actualCompletionDate` as the latest among all operations
11. Validate status/operationStatus compatibility
12. Infer `assetShortDescription`, `workCenterCode`, `workCenterDescription`, `centerCostCode`, `workAreaCode`, `workAreaDescription`, `sector`, `subsector`, `organizationName` from the `assetCode`
13. Persist the Work Order and all associated operations, resources, and materials
14. If `enableOracleWorkOrder = "Y"` and Oracle integration is enabled, publish a `WorkOrderCreatedEvent` to the outbox with the Oracle-mapped payload

**R-WO-CR-27**

The system SHALL assign a unique `workOrderCode` (BigInt) to the Work Order.

**R-WO-CR-28**

The system SHALL overwrite any `actualCompletionDate` provided by the client with the backend-calculated value based on resources.

**R-WO-CR-29**

The `assetCode` from the Work Order level SHALL be propagated to all operations, along with `assetShortDescription` inferred from the asset.

### Business Rules

**BR-WO-CR-01**

Resources with the same `resourceSequenceNumber` within an operation work in PARALLEL. The operation's actualHours for that sequence group equals the MAXIMUM actualHours among those resources.

**BR-WO-CR-02**

Resources with different `resourceSequenceNumber` values within an operation work SEQUENTIALLY. The operation's total actualHours equals the SUM of the MAX actualHours of each sequence group.

**BR-WO-CR-03**

The Work Order's `actualHours` represents the sum of work hours from all operations, NOT the calendar time difference between start and completion dates.

**BR-WO-CR-04**

Operations can run in parallel (same `actualStartDate`) but must respect sequence order — an operation with a higher `operationSeqNumber` cannot start before one with a lower `operationSeqNumber`.

**BR-WO-CR-05**

The backend is the single source of truth (SSOT) for all timing calculations. Frontend-provided dates are accepted as input but always recalculated and overwritten based on resource data.

**BR-WO-CR-06**

At creation time, each operation's `operationSubType` MUST match the parent Work Order's `workOrderSubType`. After creation, operations may progress independently and their `operationSubType` may differ as they complete.

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

## Corregir el código ya existente

> ~~Esta sección documenta las discrepancias entre el spec y el código/schema actual del microservicio. Una vez que se apliquen las correcciones, esta sección puede ser eliminada.~~
>
> **Todos los cambios listados en esta sección han sido implementados.**

### Schema (Prisma) - Implementado

1. **Campos agregados a `MntWorkOrder`:**
   - `enableOracleWorkOrder` (String, @db.Char(1), obligatorio)
   - `totalManHours` (Float, optional)
   - `totalSupplierHours` (Float, optional)

2. **Campos eliminados de `MntWoOperation`:**
   - `clientOperationId` (eliminado)

3. **Campos eliminados de `MntOperationHumanResourceUsage`:**
   - `usageRate` (eliminado)

4. **Campo agregado a `MntWoOperation`:**
   - `operationSubType` (String, @db.NVarChar(30))

### DTOs - Implementado

5. **`CreateWorkOrderDto`:** reescrito con campos obligatorios, validación de combinaciones type/subtype, y `operations` como array anidado opcional.

6. **`CreateWoOperationDto`:** nuevo DTO con campos requeridos y arrays anidados de resources y materials.

7. **`CreateWoOperationResourceDto`:** nuevo DTO para recursos dentro de operaciones.

8. **`CreateWoOperationMaterialDto`:** nuevo DTO para materiales dentro de operaciones.

9. **`CreateOperationHrDto`:** actualizado - `operationCode` eliminado del DTO (se pasa en el payload del controller), campos requeridos validados.

10. **`CreateOperationMaterialDto`:** actualizado - `operationCode` eliminado del DTO (se pasa en el payload del controller), campos requeridos validados.

### Service - Implementado

11. **`WorkOrdersService.create()`:** reescrito con validación completa, transacción, cálculos y creación anidada. Incluye validación de que `asset.organizationCode` coincida con el `organizationCode` inyectado por el gateway.

### Status Transitions - Implementado

12. **Transiciones actualizadas:**
    ```
    UNRELEASED → ON_HOLD, RELEASED, CANCELED
    RELEASED → COMPLETED, ON_HOLD, CANCELED
    ON_HOLD → RELEASED, CANCELED
    COMPLETED → CLOSED, RELEASED
    CLOSED → []
    CANCELED → []
    PENDING_APPROVAL → UNRELEASED
    ```

### Policies - Implementado

13. **`WorkOrderSubTypePolicy`:** validación de role → subType.

14. **`OracleWorkOrderPolicy`:** validación de feature flag `ENABLE_ORACLE_WORK_ORDER_SYSTEM` + permisos Oracle + roles permitidos.

### Architecture

15. **NATS Communication:**
    - El gateway lee el header `X-Organization-Code` del request HTTP y valida que el usuario tenga acceso a esa organización
    - El gateway inyecta `actorId`, `actorName`, `organizationCode`, `userPermissions` (string[]), y `userRoles` (string[]) en el payload NATS
    - El microservicio valida que el asset pertenezca a la misma organización
    - La respuesta incluye tanto UPPER_SNAKE_CASE como Title Case para status
