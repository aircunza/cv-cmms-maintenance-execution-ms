# Work Order Operation Module

## Create Operation

### Communication

NATS Pattern: `wo.operation.create` (via gateway)

Gateway endpoint: POST /api/v1/work-orders/:workOrderCode/operations

### Purpose

Creates a new operation within an existing Work Order. Each operation MUST contain at least one human resource usage.

### Request

#### Required Fields

| Field                | Type                    | Description                                                                                  |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| workOrderCode        | BigInt                  | Parent Work Order identifier.                                                                |
| operationName        | string (min 2, max 120) | Name of the operation.                                                                       |
| operationDescription | string (max 240 chars)  | Description of the operation.                                                                |
| operationSeqNumber   | integer (> 0)           | Sequence number for ordering. Must be unique within the Work Order.                          |
| operationType        | string                  | One of: "Internal", "Supplier".                                                              |
| operationStatus      | string                  | One of: "UNRELEASED", "RELEASED", "IN_PROCESS", "COMPLETED", "NOT_DONE", "CANCELED", "ON_HOLD". |
| resources            | array (non-empty)       | Array of human resource usage objects (at least one required).                               |

#### Optional Fields

| Field                | Type              | Description                                                                                 |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| unit                 | string            | Unit of measure.                                                                            |
| subunit              | string            | Subunit of measure.                                                                         |
| maintainableItem     | string            | Maintainable item identifier.                                                               |
| operationCategory    | string            | Operation category.                                                                         |
| materials            | array             | Array of material objects.                                                                  |
| actualStartDate      | string (ISO 8601) | Operation start date. Validated if provided; the stored value is derived from resources.    |
| actualCompletionDate | string (ISO 8601) | Operation completion date. Validated if provided; the stored value is derived from resources. |

#### Resource Object Structure (within operation creation)

Each resource in the `resources` array must contain:

| Field                  | Type              | Description                                                  |
| ---------------------- | ----------------- | ------------------------------------------------------------ |
| resourceCode           | string            | Resource identifier.                                         |
| resourceSequenceNumber | integer (>= 0)    | Sequence number for Oracle integration (does not affect calculations). |
| actualHours            | number (> 0)      | Actual hours for the resource. Must be greater than 0.       |
| principalFlag          | string ("Y"\|"N") | Principal flag indicator.                                    |
| actualStartDate        | string (ISO 8601) | Actual start date for the resource. Must be before actualCompletionDate. |
| actualCompletionDate   | string (ISO 8601) | Actual completion date for the resource. Must be after actualStartDate. |

##### Optional Fields (Resource Level)

| Field                 | Type   | Description                           |
| --------------------- | ------ | ------------------------------------- |
| hourlyCost            | number | Hourly cost of the resource.          |

### Validations

**R-OP-CR-01**

IF `workOrderCode` is missing or invalid,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-CR-02**

IF the parent Work Order does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-OP-CR-03**

IF `operationSeqNumber` already exists within the same Work Order,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-CR-04**

IF `operationStatus` is not compatible with the parent Work Order's `woStatusCode`,  
THEN the system SHALL reject the request with a 400 status.

#### Allowed Status Combinations

| woStatusCode     | Allowed operationStatus values  |
| ---------------- | ------------------------------- |
| UNRELEASED       | UNRELEASED                      |
| RELEASED         | RELEASED, COMPLETED, IN_PROCESS |
| ON_HOLD          | ON_HOLD                         |
| PENDING_APPROVAL | UNRELEASED                      |
| COMPLETED        | COMPLETED, NOT_DONE             |
| CLOSED           | COMPLETED, NOT_DONE             |
| CANCELED         | CANCELED                        |

**R-OP-CR-05**

IF `resources` is missing or empty,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-CR-06**

EACH resource in the operation MUST have `actualHours > 0`. IF any resource has `actualHours <= 0`,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-CR-07**

IF a resource's `actualStartDate` is not before its `actualCompletionDate`,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-CR-08**

IF `operationName` is less than 2 characters or exceeds 120 characters,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-CR-09**

IF `operationDescription` exceeds 240 characters,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-CR-10**

IF `operationType` is not "Internal" or "Supplier",  
THEN the system SHALL reject the request with a 400 status.

**R-OP-CR-11**

IF `operationStatus` is not a valid UPPER_SNAKE_CASE status,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-CR-12**

IF `resourceSequenceNumber` is not a non-negative integer,  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-OP-CR-13**

WHEN a valid operation creation request is received,  
the system SHALL:

1. Validate all DTO-level constraints
2. Validate `operationSeqNumber` uniqueness within the Work Order
3. Validate `operationStatus` compatibility with parent WO status
4. Validate each resource's `actualHours > 0` and `actualStartDate < actualCompletionDate`
5. Create the operation entity
6. Create all resource entities with `status = "ACTIVE"`
7. Calculate the operation's `actualHours` as the SUM of all resources' `actualHours` (only resources with `status = "ACTIVE"`)
8. Calculate the operation's `actualStartDate` as the MIN of all resources' `actualStartDate` (only ACTIVE resources)
9. Calculate the operation's `actualCompletionDate` as the MAX of all resources' `actualCompletionDate` (only ACTIVE resources)
10. Propagate the new operation's impact to the parent Work Order:
    - Recalculate WO `actualHours` = SUM of all ACTIVE operations' `actualHours`
    - Recalculate WO `actualStartDate` = MIN of all ACTIVE operations' `actualStartDate`
    - Recalculate WO `actualCompletionDate` = MAX of all ACTIVE operations' `actualCompletionDate`
    - Recalculate WO `totalManHours` and `totalSupplierHours` based on `operationType`
11. Set `updatedBy`, `updatedByName`, and `updatedAt` on the Work Order
12. Persist all entities within a single transaction

### Response

**R-OP-CR-14**

WHEN the operation is created successfully,  
the system SHALL return a 201 status with the created operation wrapped in an `operation` object including:

- All operation fields with calculated values (actualHours, actualStartDate, actualCompletionDate)
- `operationStatus` in UPPER_SNAKE_CASE and `operationStatusLabel` in Title Case
- All resources and materials
- The parent Work Order with recalculated values

### Errors

**R-OP-CR-15**

IF the request contains validation errors,  
THEN the system SHALL return a 400 status with a `message` field containing an array of validation error strings.

**R-OP-CR-16**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Update Operation

### Communication

NATS Pattern: `wo.operation.update` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode/operations/:operationCode`

### Purpose

Partially updates editable fields of an existing operation. Does NOT allow manual modification of calculated fields (`actualHours`, `actualStartDate`, `actualCompletionDate`) — those are derived from resources.

### Request

#### Editable Fields (All Optional)

| Field                | Type                    | Description                   |
| -------------------- | ----------------------- | ----------------------------- |
| operationName        | string (min 2, max 120) | Updated operation name.       |
| operationDescription | string (max 240 chars)  | Updated description.          |
| operationType        | string                  | Updated type ("Internal", "Supplier"). |
| operationStatus      | string                  | Updated status. Must be compatible with the parent Work Order's `woStatusCode`. |

#### Non-Editable Fields

The following fields SHALL NOT be accepted in the update payload. They are calculated from resources:

- `actualHours`
- `actualStartDate`
- `actualCompletionDate`

### Validations

**R-OP-UP-01**

IF `operationCode` is missing or invalid,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-UP-02**

IF the operation does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-OP-UP-03**

IF the operation's `status = "CANCELED"`,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-UP-04**

IF any field in the payload is a calculated field (`actualHours`, `actualStartDate`, `actualCompletionDate`),  
THEN the system SHALL reject the request with a 400 status.

**R-OP-UP-05**

IF `operationStatus` is provided and is not compatible with the parent Work Order's `woStatusCode`,  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-OP-UP-06**

WHEN a valid update request is received,  
the system SHALL:

1. Validate all permissions and authorizations
2. Find the operation by `operationCode`
3. Apply only the provided editable fields (partial update)
4. Set `updatedBy`, `updatedByName`, and `updatedAt`
5. Return the full updated operation with all nested resources and materials

### Response

**R-OP-UP-07**

WHEN the update is successful,  
the system SHALL return a 200 status with the updated operation wrapped in an `operation` object.

### Errors

**R-OP-UP-08**

IF the request contains validation errors,  
THEN the system SHALL return a 400 status.

**R-OP-UP-09**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Cancel Operation

### Communication

NATS Pattern: `wo.operation.cancel` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode/operations/:operationCode/cancel`

### Purpose

Soft-deletes (cancels) an operation and all its associated resources. The operation's `status` is set to `CANCELED` and all its resources' `status` are set to `CANCELED`.

### Request

| Field          | Type   | Required | Description                                     |
| -------------- | ------ | -------- | ----------------------------------------------- |
| canceledReason | string | Yes      | Reason for cancellation (max 240 characters).   |

### Validations

**R-OP-CN-01**

IF the operation does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-OP-CN-02**

IF the operation's current status does not allow transition to `CANCELED`,  
THEN the system SHALL reject the request with a 400 status.

Allowed transitions to `CANCELED`:

- `UNRELEASED` → `CANCELED`
- `RELEASED` → `CANCELED`
- `ON_HOLD` → `CANCELED`

**R-OP-CN-03**

IF canceling this operation would leave the parent Work Order with zero ACTIVE operations,  
THEN the system SHALL reject the request with a 400 status and message `Cannot cancel the last active operation`.

**R-OP-CN-04**

IF `canceledReason` is missing or empty,  
THEN the system SHALL reject the request with a 400 status.

**R-OP-CN-05**

IF `canceledReason` exceeds 240 characters,  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-OP-CN-06**

WHEN an operation is canceled,  
the system SHALL:

1. Set the operation's `status` to `CANCELED`
2. Set all associated resources' `status` to `CANCELED`
3. Recalculate the parent Work Order's values excluding the canceled operation:
   - WO `actualHours` = SUM of all remaining ACTIVE operations' `actualHours`
   - WO `actualStartDate` = MIN of all remaining ACTIVE operations' `actualStartDate`
   - WO `actualCompletionDate` = MAX of all remaining ACTIVE operations' `actualCompletionDate`
   - WO `totalManHours` and `totalSupplierHours` recalculated based on remaining ACTIVE operations
4. Set `updatedBy`, `updatedByName`, and `updatedAt` on the Work Order
5. Persist all changes within a single transaction

### Response

**R-OP-CN-07**

WHEN the operation is canceled successfully,  
the system SHALL return a 200 status with the updated operation (status `CANCELED`) and the parent Work Order with recalculated values.

### Errors

**R-OP-CN-08**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Review Operation

### Communication

NATS Pattern: `wo.operation.review` (via gateway)

Gateway endpoint: `PATCH /api/v1/work-orders/:workOrderCode/operations/:operationCode/review`

### Purpose

Marks an operation as reviewed by a user.

### Processing

**R-OP-RV-01**

WHEN an operation is reviewed,  
the system SHALL set `reviewedBy`, `reviewedByName`, and `reviewedAt` to the current actor and timestamp.

### Response

Returns the updated operation with review fields set.

---

## System Generated / Calculated Fields (Operation Level)

| Field                 | Type     | Description                                                |
| --------------------- | -------- | ---------------------------------------------------------- |
| operationCode         | BigInt   | Auto-generated unique identifier.                          |
| actualHours           | Float    | Calculated: SUM of all ACTIVE resources' actualHours.      |
| actualStartDate       | DateTime | Calculated: MIN of all ACTIVE resources' actualStartDate.  |
| actualCompletionDate  | DateTime | Calculated: MAX of all ACTIVE resources' actualCompletionDate. |
| operationStatusLabel  | string   | Title Case label for operationStatus.                      |
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
| reviewedBy            | string   | Reviewed by user.                                          |
| reviewedByName        | string   | Reviewed by user name.                                     |
| reviewedAt            | DateTime | Review timestamp.                                          |
| canceledReason        | string   | Reason for cancellation (set when status = CANCELED).      |

---

## Business Rules

**BR-OP-01**

An operation's `actualHours` is the SUM of all its resources' `actualHours` where `status = "ACTIVE"`. Resources with `status = "CANCELED"` are excluded from the calculation.

**BR-OP-02**

An operation's `actualStartDate` is the MINIMUM `actualStartDate` among all its resources where `status = "ACTIVE"`.

**BR-OP-03**

An operation's `actualCompletionDate` is the MAXIMUM `actualCompletionDate` among all its resources where `status = "ACTIVE"`.

**BR-OP-04**

An operation MUST have at least one resource with `status = "ACTIVE"` at all times. The system SHALL NOT allow canceling the last active resource.

**BR-OP-05**

An operation MUST belong to a Work Order. An operation cannot exist without a parent Work Order.

**BR-OP-06**

The `operationSeqNumber` MUST be unique within a Work Order. Two operations within the same Work Order cannot share the same `operationSeqNumber`.

**BR-OP-07**

Operations within a Work Order MAY have overlapping `actualStartDate` and `actualCompletionDate` ranges. Date overlap between operations is allowed.

**BR-OP-08**

The `resourceSequenceNumber` field is used exclusively for Oracle Fusion integration to indicate parallel or sequential execution. It does NOT affect any calculation of `actualHours`, `actualStartDate`, or `actualCompletionDate` within this system.

---

## Status Transitions

### Operation Status Transitions

| From Status      | Allowed Transitions To       |
| ---------------- | ---------------------------- |
| UNRELEASED       | ON_HOLD, RELEASED, CANCELED  |
| RELEASED         | COMPLETED, ON_HOLD, CANCELED |
| ON_HOLD          | RELEASED, CANCELED           |
| COMPLETED        | CLOSED, RELEASED             |
| CLOSED           | [] (terminal)                |
| CANCELED         | [] (terminal)                |
| IN_PROCESS       | COMPLETED, ON_HOLD, CANCELED |
| NOT_DONE         | CANCELED                     |
| PENDING_APPROVAL | UNRELEASED                   |
