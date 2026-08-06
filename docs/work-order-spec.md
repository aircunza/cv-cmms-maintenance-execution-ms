# Work Order Module

## Create Work Order

### Endpoint

POST /mnt-work-order

### Purpose

Creates a new Work Order with one or more operations, each containing resources and optional materials.

### Authentication & Authorization

The endpoint requires:

- **AuthGuard**: Valid authentication token.
- **OrganizationContextPolicy**: User must belong to the organization specified in `organizationId`
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

When `enableOracleWorkOrder = "Y"`:

- User must have permission `oracle.mnt.work.orders.create`
- User must have one of the allowed roles in the specified organization
- Allowed roles: MANUFACTURING_FACILITATOR. TECHNICIAN_MAINTENANCE_01, TECHNICIAN_MAINTENANCE_02, PLANNER_MAINTENANCE_01, PLANNER_MAINTENANCE_02, COORDINATOR_MAINTENANCE_01, COORDINATOR_MAINTENANCE_02, SUPERVISOR_MAINTENANCE_01, SUPERVISOR_MAINTENANCE_02, ADMIN

### Request

#### Required Fields (Work Order Level)

| Field                | Type                        | Max Length | Description                                                          |
| -------------------- | --------------------------- | ---------- | -------------------------------------------------------------------- |
| workOrderDescription | string                      | 240        | Description of the work order.                                       |
| woStatusCode         | string                      | 30         | Status code (e.g., "Unreleased", "Released", "Completed").           |
| assetCode            | string                      | 80         | Asset identifier.                                                    |
| workOrderType        | string                      | -          | Work order type (e.g., "Planned", "Not Planned").                    |
| workOrderSubType     | string                      | -          | Work order sub-type (e.g., "Preventive", "Corrective", "Emergency"). |
| operations           | array                       | -          | Array of operations (at least one required).                         |
| workOrderPriority    | string ("1"\|"2"\|"3"\|"4") | "1"        | Priority level (1=highest, 4=lowest).                                |

#### Optional Fields (Work Order Level)

| Field                 | Type                 | Default | Description                        |
| --------------------- | -------------------- | ------- | ---------------------------------- |
| workRequestId         | string\|number\|null | null    | Associated work                    |
| enableOracleWorkOrder | string ("Y"\|"N")    | "N"     | Flag to enable Oracle integration. |

#### Operation Object Structure

Each operation in the `operations` array must contain:

##### Required Fields (Operation Level)

| Field                      | Type                   | Description                                                                                     |
| -------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| operationName              | string (min 2 chars)   | Name of the operation.                                                                          |
| operationDescription       | string (max 240 chars) | Description of the operation.                                                                   |
| operationSeqNumber         | integer (> 0)          | Sequence number for ordering operations. Must be unique within the Work Order.                  |
| createdBy                  | string (UUID)          | User identifier who creates the operation.                                                      |
| activityStatus             | string                 | One of: "Unreleased", "Released", "In Process", "Completed", "Not Done", "Canceled", "On Hold". |
| activityType               | string                 | One of: "Internal", "Supplier".                                                                 |
| actualStartDate            | string (ISO 8601)      | Operation start date. Must be before actualCompletionDate.                                      |
| actualCompletionDate       | string (ISO 8601)      | Operation completion date. Must be after actualStartDate.                                       |
| workOrderOperationResource | array (non-empty)      | Array of resource objects (at least one required).                                              |

##### Optional Fields (Operation Level)

| Field                      | Type  | Description                |
| -------------------------- | ----- | -------------------------- |
| workOrderOperationMaterial | array | Array of material objects. |

#### Resource Object Structure

Each resource in `workOrderOperationResource` must contain:

| Field                  | Type              | Description                                                                                |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------------------ |
| resourceCode           | string            | Resource identifier.                                                                       |
| resourceSequenceNumber | integer (>= 0)    | Sequence number for grouping resources. Resources with the same sequence work in parallel. |
| plannedHours           | number (> 0)      | Planned hours for the resource.                                                            |
| actualHours            | number (> 0)      | Actual hours for the resource. Must be greater than 0.                                     |
| principalFlag          | string ("Y"\|"N") | Principal flag indicator.                                                                  |

#### Material Object Structure (Optional)

Each material in `workOrderOperationMaterial` must contain:

| Field                  | Type         | Description               |
| ---------------------- | ------------ | ------------------------- |
| materialSequenceNumber | integer      | Material sequence number. |
| quantity               | number (> 0) | Quantity of material.     |
| supplyType             | string       | Supply type code.         |
| materialCode           | string       | Material identifier.      |

#### System Generated / Calculated Fields

These fields are calculated or managed by the system and SHALL NOT be provided when creating a Work Order.

| Field                | Type              | Description                                                     |
| -------------------- | ----------------- | --------------------------------------------------------------- |
| workOrderCode        | number            | Auto-generated unique identifier.                               |
| actualHours          | number            | Sum of all operations' actualHours (calculated from resources). |
| createdAt            | Date              | Record creation timestamp.                                      |
| updatedAt            | Date              | Last update timestamp.                                          |
| updatedBy            | string\|null      | Last updated by user.                                           |
| updatedByUsername    | string            | Last updated by user name.                                      |
| createdByUsername    | string            | Creator user name.                                              |
| totalManHours        | number            | Total man hours from operations.                                |
| totalSupplierHours   | number            | Total supplier hours from operations.                           |
| oclWorkOrderId       | number\|null      | Oracle Cloud work order ID.                                     |
| oclWorkOrderNumber   | string\|null      | Oracle Cloud work order number.                                 |
| actualStartDate      | string (ISO 8601) | -                                                               | Work order actual start date.               |
| actualCompletionDate | string (ISO 8601) | -                                                               | Work order actual completion date.          |
| workCenterId         | string            | -                                                               | Work center identifier.                     |
| workAreaId           | string            | -                                                               | Work area identifier.                       |
| organizationId       | string (UUID)     | -                                                               | Organization identifier.                    |
| organizationCode     | string            | -                                                               | Organization code.                          |
| createdBy            | string (UUID)     | -                                                               | User identifier who creates the work order. |

#### Example Request

```json
{
  "enableOracleWorkOrder": "N",
  "workOrderDescription": "Preventive maintenance on hydraulic pump",
  "woStatusCode": "Unreleased",
  "assetCode": "AST-001",
  "workCenterId": "WC-001",
  "workAreaId": "WA-001",
  "organizationId": "550e8400-e29b-41d4-a716-446655440000",
  "organizationCode": "ORG001",
  "createdBy": "550e8400-e29b-41d4-a716-446655440001",
  "workOrderType": "Planned",
  "workOrderSubType": "Preventive",
  "workOrderPriority": "2",
  "operations": [
    {
      "operationName": "Lubrication",
      "operationDescription": "Lubrication of all components",
      "operationSeqNumber": 10,
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "activityStatus": "Unreleased",
      "activityType": "Internal",
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
      "activityStatus": "Unreleased",
      "activityType": "Internal",
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

IF `enableOracleWorkOrder` is provided and is not "Y" or "N",  
THEN the system SHALL reject the request.

**R-WO-CR-04**

IF `workOrderPriority` is provided and is not one of "1", "2", "3", "4",  
THEN the system SHALL reject the request.

**R-WO-CR-05**

IF `woStatusCode` is not a valid status code,  
THEN the system SHALL reject the request.

**R-WO-CR-06**

IF the combination of `workOrderType` and `workOrderSubType` is not allowed.
THEN the system SHALL reject the request.

```json
[
  {
    "workOrderType": "Planned",
    "workOrderSubType": "Preventive"
  },
  {
    "workOrderType": "Planned",
    "workOrderSubType": "Corrective"
  },
  {
    "workOrderType": "Planned",
    "workOrderSubType": "Inspection"
  },
  {
    "workOrderType": "Planned",
    "workOrderSubType": "TPM"
  },
  {
    "workOrderType": "Not Planned",
    "workOrderSubType": "Emergency"
  }
]
```

**R-WO-CR-07**

IF `enableOracleWorkOrder = "Y"` and the user lacks the required Oracle permission or role,  
THEN the system SHALL reject the request with a 403 status.

**R-WO-CR-08**

IF the user's role is not authorized to create the specified `workOrderSubType`,  
THEN the system SHALL reject the request with a 403 status.

**R-WO-CR-09**

IF an operation's `actualStartDate` is not before its `actualCompletionDate`,  
THEN the system SHALL reject the request.

**R-WO-CR-10**

IF an operation's date fields are not valid ISO 8601 datetime strings,  
THEN the system SHALL reject the request.

**R-WO-CR-11**

IF an operation's `operationName` is less than 2 characters,  
THEN the system SHALL reject the request.

**R-WO-CR-12**

IF an operation's `operationDescription` exceeds 240 characters,  
THEN the system SHALL reject the request.

**R-WO-CR-13**

IF an operation's `createdBy` is not a valid UUID,  
THEN the system SHALL reject the request.

**R-WO-CR-14**

IF an operation's `activityType` is not "Internal" or "Supplier",  
THEN the system SHALL reject the request.

**R-WO-CR-15**

IF an operation's `activityStatus` is not a valid status,  
THEN the system SHALL reject the request.

**R-WO-CR-16**

IF an operation's `workOrderOperationResource` is missing or empty,  
THEN the system SHALL reject the request.

**R-WO-CR-17**

IF no resource in an operation has `actualHours > 0`,  
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

IF the combination of Work Order `woStatusCode` and operation `activityStatus` values is not allowed,  
THEN the system SHALL reject the request.

#### Allowed Status/Activity Combinations

| Work Order Status | Allowed Operation Activity Status |
| ----------------- | --------------------------------- |
| Unreleased        | Unreleased                        |
| Released          | Released, Completed, In Process   |
| On Hold           | On Hold                           |
| Pending Approval  | Unreleased                        |
| Completed         | Completed, Not Done               |
| Closed            | Completed, Not Done               |
| Canceled          | Canceled                          |

### Processing

**R-WO-CR-24**

WHEN no `operations` array is provided or it is empty,  
the system SHALL create a default operation with:

- operationName: "DEFAULT_OPERATION"
- operationDescription: "Auto-generated default operation"
- operationSeqNumber: 1
- activityStatus: "Unreleased"
- activityType: "Internal"
- actualStartDate: current time (or provided actualStartDate)
- actualCompletionDate: start + 1 hour
- One default resource with principalFlag "N"

**R-WO-CR-25**

WHEN a valid Work Order creation request is received,  
the system SHALL:

1. Validate all DTO-level constraints
2. Validate type/subtype combination.
3. Create WorkOperation entities from the operations array
4. Calculate each operation's `actualHours` from its resources:
   - Resources with the same `resourceSequenceNumber` work in PARALLEL → take MAX(actualHours)
   - Resources with different `resourceSequenceNumber` work SEQUENTIALLY → SUM the MAX of each group
5. Recalculate each operation's `actualCompletionDate` as `actualStartDate + calculated actualHours`
6. Validate operations sequential order (unique seqNumbers, chronological start dates)
7. Calculate Work Order `actualHours` as the sum of all operations' actualHours
8. Calculate Work Order `actualStartDate` as the earliest among all operations
9. Calculate Work Order `actualCompletionDate` as the latest among all operations
10. Validate status/activityStatus compatibility
11. Persist the Work Order and all associated operations, resources, and materials
12. If `enableOracleWorkOrder = "Y"` and Oracle integration is enabled, publish a `WorkOrderCreatedEvent` to the outbox with the Oracle-mapped payload

**R-WO-CR-26**

The system SHALL assign a unique `workOrderCode` to the Work Order.

**R-WO-CR-27**

The system SHALL overwrite any `actualCompletionDate` provided by the client with the backend-calculated value based on resources.

**R-WO-CR-28**

The `assetCode` from the Work Order level SHALL be propagated to all operations.

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

### Response

**R-WO-CR-29**

WHEN the Work Order is created successfully,  
the system SHALL return a 201 status with the created Work Order including:

- workOrderCode
- All Work Order fields with calculated values (actualHours, actualStartDate, actualCompletionDate)
- All operations with calculated actualHours and actualCompletionDate
- All resources and materials

#### Example Response

```json
{
  "workOrderCode": 1001,
  "assetCode": "AST-001",
  "woStatusCode": "Unreleased",
  "workCenterId": "WC-001",
  "workAreaId": "WA-001",
  "organizationId": "550e8400-e29b-41d4-a716-446655440000",
  "organizationCode": "ORG001",
  "createdBy": "550e8400-e29b-41d4-a716-446655440001",
  "createdByUsername": "John Doe",
  "updatedBy": null,
  "updatedByUsername": null,
  "createdAt": "2025-11-21T08:00:00.000Z",
  "updatedAt": "2025-11-21T08:00:00.000Z",
  "workOrderType": "Planned",
  "workOrderSubType": "Preventive",
  "workOrderDescription": "Preventive maintenance on hydraulic pump",
  "workOrderPriority": "2",
  "actualStartDate": "2025-11-21T08:00:00.000Z",
  "actualCompletionDate": "2025-11-21T17:00:00.000Z",
  "actualHours": 12,
  "totalManHours": 10,
  "totalSupplierHours": 2,
  "workRequestId": null,
  "oclWorkOrderId": null,
  "oclWorkOrderNumber": null,
  "operations": [
    {
      "operationCode": 5001,
      "assetCode": "AST-001",
      "operationName": "Lubrication",
      "operationSeqNumber": 10,
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "activityStatus": "Unreleased",
      "activityType": "Internal",
      "actualStartDate": "2025-11-21T08:00:00.000Z",
      "actualCompletionDate": "2025-11-21T11:00:00.000Z",
      "operationDescription": "Lubrication of all components",
      "actualHours": 3,
      "workOrderOperationResource": [...],
      "workOrderOperationMaterial": [...]
    },
    {
      "operationCode": 5002,
      "assetCode": "AST-001",
      "operationName": "Inspection",
      "operationSeqNumber": 20,
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "activityStatus": "Unreleased",
      "activityType": "Internal",
      "actualStartDate": "2025-11-21T11:00:00.000Z",
      "actualCompletionDate": "2025-11-21T14:00:00.000Z",
      "operationDescription": "Visual inspection of components",
      "actualHours": 3,
      "workOrderOperationResource": [...],
      "workOrderOperationMaterial": []
    }
  ]
}
```

### Errors

**R-WO-CR-30**

IF the request contains validation errors,  
THEN the system SHALL return a 400 status with an `errors` array containing field-specific error messages.

**R-WO-CR-31**

IF the user lacks Oracle permission when `enableOracleWorkOrder = "Y"`,  
THEN the system SHALL return a 403 status with error code `MISSING_ORACLE_PERMISSION`.

**R-WO-CR-32**

IF the user's role is not authorized for the requested sub-type,  
THEN the system SHALL return a 403 status with error code `SUBTYPE_NOT_ALLOWED_FOR_ROLE`.

**R-WO-CR-33**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.
