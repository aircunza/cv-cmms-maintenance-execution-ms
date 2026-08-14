# Operation Human Resource Usage Module

## Create Human Resource Usage

### Communication

NATS Pattern: `operation.hr.create` (via gateway)

Gateway endpoint: POST /api/v1/operations/:operationCode/human-resources

### Purpose

Creates a new human resource usage record within an existing operation. Each resource MUST have `actualHours > 0` and `actualStartDate < actualCompletionDate`.

### Request

#### Required Fields

| Field                  | Type              | Description                                                  |
| ---------------------- | ----------------- | ------------------------------------------------------------ |
| operationCode          | BigInt            | Parent operation identifier.                                 |
| resourceCode           | string            | Resource identifier (references MntHumanResource).           |
| resourceSequenceNumber | integer (>= 0)    | Sequence number for Oracle integration (does not affect calculations). |
| actualHours            | number (> 0)      | Actual hours for the resource. Must be greater than 0.       |
| actualStartDate        | string (ISO 8601) | Actual start date for the resource. Must be before actualCompletionDate. |
| actualCompletionDate   | string (ISO 8601) | Actual completion date for the resource. Must be after actualStartDate. |

#### Optional Fields

| Field                 | Type              | Description                           |
| --------------------- | ----------------- | ------------------------------------- |
| hourlyCost            | number            | Hourly cost of the resource.          |
| principalFlag         | string ("Y"\|"N") | Principal flag indicator. Default "N".|

### Validations

**R-HR-CR-01**

IF `operationCode` is missing or invalid,  
THEN the system SHALL reject the request with a 400 status.

**R-HR-CR-02**

IF the parent operation does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-HR-CR-03**

IF the parent operation's `status = "CANCELED"`,  
THEN the system SHALL reject the request with a 400 status.

**R-HR-CR-04**

IF `actualHours <= 0`,  
THEN the system SHALL reject the request with a 400 status.

**R-HR-CR-05**

IF `actualStartDate` is not before `actualCompletionDate`,  
THEN the system SHALL reject the request with a 400 status.

**R-HR-CR-06**

IF `resourceSequenceNumber` is not a non-negative integer,  
THEN the system SHALL reject the request with a 400 status.

**R-HR-CR-07**

IF a resource with the same `resourceCode` and `resourceSequenceNumber` already exists within the same operation,  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-HR-CR-08**

WHEN a valid resource creation request is received,  
the system SHALL:

1. Validate all DTO-level constraints
2. Validate parent operation exists and is not canceled
3. Validate uniqueness of `resourceCode` + `resourceSequenceNumber` within the operation
4. Create the resource entity with `status = "ACTIVE"`
5. Recalculate the parent operation's values:
   - Operation `actualHours` = SUM of all ACTIVE resources' `actualHours`
   - Operation `actualStartDate` = MIN of all ACTIVE resources' `actualStartDate`
   - Operation `actualCompletionDate` = MAX of all ACTIVE resources' `actualCompletionDate`
6. Propagate the recalculation to the parent Work Order:
   - WO `actualHours` = SUM of all ACTIVE operations' `actualHours`
   - WO `actualStartDate` = MIN of all ACTIVE operations' `actualStartDate`
   - WO `actualCompletionDate` = MAX of all ACTIVE operations' `actualCompletionDate`
   - WO `totalManHours` and `totalSupplierHours` recalculated based on `operationType`
7. Set `updatedBy`, `updatedByName`, and `updatedAt` on the operation and Work Order
8. Persist all changes within a single transaction

### Response

**R-HR-CR-09**

WHEN the resource is created successfully,  
the system SHALL return a 201 status with the created resource wrapped in a `hrUsage` object including:

- All resource fields with `status = "ACTIVE"`
- The parent operation with recalculated values
- The parent Work Order with recalculated values

### Errors

**R-HR-CR-10**

IF the request contains validation errors,  
THEN the system SHALL return a 400 status with a `message` field containing validation error strings.

**R-HR-CR-11**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Update Human Resource Usage

### Communication

NATS Pattern: `operation.hr.update` (via gateway)

Gateway endpoint: `PATCH /api/v1/operations/:operationCode/human-resources/:id`

### Purpose

Partially updates editable fields of an existing human resource usage record. Changes to `actualHours`, `actualStartDate`, or `actualCompletionDate` trigger cascading recalculation up to the operation and Work Order levels.

### Request

#### Editable Fields (All Optional)

| Field                 | Type              | Description                           |
| --------------------- | ----------------- | ------------------------------------- |
| actualHours           | number (> 0)      | Updated actual hours. Must be > 0.    |
| hourlyCost            | number            | Updated hourly cost.                  |
| principalFlag         | string ("Y"\|"N") | Updated principal flag.               |
| actualStartDate       | string (ISO 8601) | Updated actual start date.            |
| actualCompletionDate  | string (ISO 8601) | Updated actual completion date.       |

### Validations

**R-HR-UP-01**

IF the resource does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-HR-UP-02**

IF the resource's `status = "CANCELED"`,  
THEN the system SHALL reject the request with a 400 status.

**R-HR-UP-03**

IF `actualHours` is provided and is `<= 0`,  
THEN the system SHALL reject the request with a 400 status.

**R-HR-UP-04**

IF both `actualStartDate` and `actualCompletionDate` are provided (or one is provided alongside the existing value) and `actualStartDate >= actualCompletionDate`,  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-HR-UP-05**

WHEN a valid update request is received,  
the system SHALL:

1. Validate all permissions and authorizations
2. Find the resource by `id`
3. Apply only the provided editable fields (partial update)
4. IF `actualHours`, `actualStartDate`, or `actualCompletionDate` was modified:
   a. Recalculate the parent operation's values:
      - Operation `actualHours` = SUM of all ACTIVE resources' `actualHours`
      - Operation `actualStartDate` = MIN of all ACTIVE resources' `actualStartDate`
      - Operation `actualCompletionDate` = MAX of all ACTIVE resources' `actualCompletionDate`
   b. Propagate the recalculation to the parent Work Order:
      - WO `actualHours` = SUM of all ACTIVE operations' `actualHours`
      - WO `actualStartDate` = MIN of all ACTIVE operations' `actualStartDate`
      - WO `actualCompletionDate` = MAX of all ACTIVE operations' `actualCompletionDate`
      - WO `totalManHours` and `totalSupplierHours` recalculated based on `operationType`
5. Set `updatedBy`, `updatedByName`, and `updatedAt` on the resource, operation, and Work Order
6. Persist all changes within a single transaction

### Response

**R-HR-UP-06**

WHEN the update is successful,  
the system SHALL return a 200 status with the updated resource wrapped in a `hrUsage` object including the parent operation and Work Order with recalculated values.

### Errors

**R-HR-UP-07**

IF the request contains validation errors,  
THEN the system SHALL return a 400 status.

**R-HR-UP-08**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Cancel Human Resource Usage (Soft Delete)

### Communication

NATS Pattern: `operation.hr.cancel` (via gateway)

Gateway endpoint: `PATCH /api/v1/operations/:operationCode/human-resources/:id/cancel`

### Purpose

Soft-deletes (cancels) a human resource usage record by setting its `status` to `CANCELED`. The resource is excluded from all subsequent calculations.

### Request

| Field          | Type   | Required | Description                                     |
| -------------- | ------ | -------- | ----------------------------------------------- |
| canceledReason | string | Yes      | Reason for cancellation (max 240 characters).   |

### Validations

**R-HR-CN-01**

IF the resource does not exist,  
THEN the system SHALL reject the request with a 404 status.

**R-HR-CN-02**

IF the resource's current status is already `CANCELED`,  
THEN the system SHALL reject the request with a 400 status.

**R-HR-CN-03**

IF canceling this resource would leave the parent operation with zero ACTIVE resources,  
THEN the system SHALL reject the request with a 400 status and message `Cannot cancel the last active resource`.

**R-HR-CN-04**

IF `canceledReason` is missing or empty,  
THEN the system SHALL reject the request with a 400 status.

**R-HR-CN-05**

IF `canceledReason` exceeds 240 characters,  
THEN the system SHALL reject the request with a 400 status.

### Processing

**R-HR-CN-06**

WHEN a resource is canceled,  
the system SHALL:

1. Set the resource's `status` to `CANCELED`
2. Recalculate the parent operation's values excluding the canceled resource:
   - Operation `actualHours` = SUM of remaining ACTIVE resources' `actualHours`
   - Operation `actualStartDate` = MIN of remaining ACTIVE resources' `actualStartDate`
   - Operation `actualCompletionDate` = MAX of remaining ACTIVE resources' `actualCompletionDate`
3. Propagate the recalculation to the parent Work Order:
   - WO `actualHours` = SUM of all ACTIVE operations' `actualHours`
   - WO `actualStartDate` = MIN of all ACTIVE operations' `actualStartDate`
   - WO `actualCompletionDate` = MAX of all ACTIVE operations' `actualCompletionDate`
   - WO `totalManHours` and `totalSupplierHours` recalculated based on `operationType`
4. Set `updatedBy`, `updatedByName`, and `updatedAt` on the resource, operation, and Work Order
5. Persist all changes within a single transaction

### Response

**R-HR-CN-07**

WHEN the resource is canceled successfully,  
the system SHALL return a 200 status with the updated resource (status `CANCELED`) and the parent operation and Work Order with recalculated values.

### Errors

**R-HR-CN-08**

IF an unexpected error occurs,  
THEN the system SHALL return an internal server error response.

---

## Find Human Resource Usages

### Communication

NATS Pattern: `operation.hr.find.all` (via gateway)

Gateway endpoint: GET /api/v1/operations/:operationCode/human-resources

### Purpose

Retrieves human resource usage records. By default, only ACTIVE resources are returned.

### Request

| Field         | Type              | Required | Description                                      |
| ------------- | ----------------- | -------- | ------------------------------------------------ |
| operationCode | BigInt            | No       | Filter by parent operation.                      |
| includeCanceled | string ("Y"\|"N") | No     | If "Y", include CANCELED resources. Default "N". |

### Processing

**R-HR-GE-01**

WHEN a valid query is received,  
the system SHALL:

1. Filter by `operationCode` if provided
2. Exclude resources with `status = "CANCELED"` unless `includeCanceled = "Y"`
3. Return the list ordered by `resourceSequenceNumber ASC`

### Response

**R-HR-GE-02**

WHEN the query executes successfully,  
the system SHALL return:

- `hrUsages`: array of human resource usage records
- `total`: total number of records matching the query condition

### Errors

**R-HR-GE-03**

IF no resources match the query,  
THEN the system SHALL return an empty array and `total = 0`.

---

## System Generated / Calculated Fields (Resource Level)

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
| status                   | string            | "ACTIVE" or "CANCELED". Default "ACTIVE". |
| canceledReason           | string            | Reason for cancellation (set when status = CANCELED). |

---

## Business Rules

**BR-HR-01**

A human resource usage record's `actualHours`, `actualStartDate`, and `actualCompletionDate` are manually set by the user. These are the ONLY fields in the hierarchy that accept manual input for timing and hours.

**BR-HR-02**

When a resource is created, its `status` SHALL be set to `"ACTIVE"`.

**BR-HR-03**

A resource with `status = "CANCELED"` SHALL be excluded from all calculations of parent operation and Work Order values (`actualHours`, `actualStartDate`, `actualCompletionDate`, `totalManHours`, `totalSupplierHours`).

**BR-HR-04**

A resource with `status = "CANCELED"` SHALL be excluded from GET responses by default, unless explicitly requested with `includeCanceled = "Y"`.

**BR-HR-05**

An operation MUST have at least one resource with `status = "ACTIVE"` at all times. The system SHALL NOT allow canceling the last active resource of an operation.

**BR-HR-06**

The `resourceSequenceNumber` field is used exclusively for Oracle Fusion integration to indicate whether resources execute in parallel or sequence. It does NOT affect any calculation within this system.

**BR-HR-07**

Every `actualHours` value MUST be greater than 0. The system SHALL NOT accept or store `actualHours <= 0` for any resource.

---

## Status Transitions

### Resource Status Transitions

| From Status | Allowed Transitions To |
| ----------- | ---------------------- |
| ACTIVE      | CANCELED               |
| CANCELED    | [] (terminal)          |
