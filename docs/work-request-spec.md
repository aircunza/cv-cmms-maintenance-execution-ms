# Work Request Module

## Create Work Request

### Endpoint

POST /wo-request

### Purpose

Creates a new Work Request.

### Request

#### Required Fields

| Field            | Type          | Max Length | Description                              |
| ---------------- | ------------- | ---------- | ---------------------------------------- |
| assetCode        | string        | 80         | Asset identifier.                        |
| issueDescription | string        | 240        | Description of the reported issue.       |
| createdBy        | string (UUID) | -          | User identifier who creates the request. |

#### Optional Fields

| Field                 | Type   | Max Length | Description                        |
| --------------------- | ------ | ---------- | ---------------------------------- |
| assetShortDescription | string | 200        | Asset short description.           |
| createdByName         | string | 70         | User name who creates the request. |

#### System Generated Fields

These fields are generated or managed by the system and SHALL NOT be provided when creating a Work Request.

| Field                 | Type    | Length | Description                                            |
| --------------------- | ------- | ------ | ------------------------------------------------------ |
| requestId             | -       | -      | Auto-generated identifier.                             |
| requestedAt           | -       | -      | Creation timestamp.                                    |
| createdAt             | -       | -      | Record creation timestamp.                             |
| completedAt           | -       | -      | Completion timestamp.                                  |
| releasedAt            | -       | -      | Release timestamp.                                     |
| canceledAt            | -       | -      | Cancellation timestamp.                                |
| updatedAt             | -       | -      | Last update timestamp.                                 |
| updatedBy             | -       | -      | Last updated by user.                                  |
| updatedByName         | -       | -      | Last updated by user name.                             |
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

#### Example Request

```json
{
  "assetCode": "AST-001",
  "issueDescription": "Oil leak detected on the hydraulic pump.",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Validations

**R-WR-CR-01**

The system SHALL require all mandatory fields.

**R-WR-CR-02**

IF any required field is missing,  
THEN the system SHALL reject the request.

**R-WR-CR-03**

IF any required field exceeds the specified maximum number of characters,  
THEN the system SHALL reject the request.

### Processing

**R-WR-CR-04**

WHEN a valid Work Request creation request is received,  
the system SHALL create a new Work Request.

**R-WR-CR-05**

The system SHALL assign a unique requestId to the Work Request.

**R-WR-CR-06**

WHEN a Work Request is successfully created,  
the system SHALL create an associated Work Order linked to the Work Request through the requestId.

**R-WR-CR-07**

The system SHALL persist the Work Request and the associated Work Order.

### Business Rules

**BR-WR-CR-01**

A Work Request SHALL have an associated Work Order.

### Response

**R-WR-CR-08**

WHEN the Work Request is created successfully,  
the system SHALL return the created Work Request including its requestId.

### Errors

**R-WR-CR-09**

IF the request contains validation errors,  
THEN the system SHALL return the validation errors in an errors array.

**R-WR-CR-10**

IF an unexpected error occurs,  
THEN the system SHALL return an internal error response.

---

## Get Work Requests

### Endpoint

GET /wo-request

### Processing

**R-WR-GE-01**

WHEN work requests exist matching the query criteria,  
the system SHALL return the matching work requests.

### Validations

**R-WR-GE-02**

The system SHALL support filtering by individual fields using the operators:

| Operator | Description                         | Example                          |
| -------- | ----------------------------------- | -------------------------------- |
| `eq`     | Equals                              | `{"organizationCode": "ORG001"}` |
| `like`   | Contains / Partial match            | `{"issueDescription": "Tech"}`   |
| `gt`     | Greater than (for numbers or dates) | `{"createdAt": "2024-01-01"}`    |
| `lt`     | Less than (for numbers or dates)    | `{"createdAt": "2025-01-01"}`    |
| `in`     | Belongs to list                     | `{"requestId": ["id1", "id2"]}`  |

**R-WR-GE-03**

The system SHALL support the following query parameters:

- filters: array of filter objects with field, operator, and value
- order: array of sort criteria (e.g., [field, ASC|DESC])
- limit: maximum number of results
- offset: number of results to skip

```json
{
  "filters": [
    {
      "field": "issueDescription",
      "operator": "eq",
      "value": "Problem - w344-345-244"
    },
    {
      "field": "statusCode",
      "operator": "eq",
      "value": "RELEASED"
    },
    {
      "field": "requestId",
      "operator": "in",
      "value": ["org-id-1", "org-id-2"]
    }
  ],
  "order": [["createdAt", "DESC"]],
  "limit": 10,
  "offset": 0
}
```

**R-WR-GE-04**

IF the requester is not authenticated,  
THEN the system SHALL reject the request.

**R-WR-GE-05**

IF the queryParams format is malformed or invalid,  
THEN the system SHALL return a 400 response with error message "Invalid filter data".

### Errors

**R-WR-GE-06**

IF no work requests match the criteria,  
THEN the system SHALL return an empty result set.

---

## Update Work Request

### Endpoint

PUT /wo-request

### Purpose

Updates one or more work requests matching the specified conditions.

### Request

**R-WR-UP-01**

The update request SHALL consist of:

- `data`: object containing the fields to update
- `condition`: object specifying which records to update using operators

#### Condition Operators

**R-WR-UP-02**

The system SHALL support the `eq` (equals) operator on conditions.

**R-WR-UP-03**

The system SHALL support the `in` (in array) operator on conditions.

**R-WR-UP-04**

WHEN `in` operator is provided,  
the value SHALL be an array.

**R-WR-UP-05**

Multiple conditions SHALL be combined using AND logic (composite condition).

### Validations

**R-WR-UP-06**

The system SHALL allow updates to:

- issueDescription
- statusCode

**R-WR-UP-07**

IF the data object contains unknown or non-updatable fields,  
THEN the system SHALL reject the request.

**R-WR-UP-08**

IF the condition uses an unsupported operator,  
THEN the system SHALL reject the request.

### Processing

**R-WR-UP-09**

WHEN a valid update request is received matching one or more records,  
the system SHALL update the requested fields on all matching work requests.

**R-WR-UP-10**

The system SHALL return the number of affected rows and the full updated instances.

### Business Rules

**BR-WR-UP-02**

WHEN the Work Request status is changed to "CANCELED",  
the system SHALL automatically change the associated Work Order status to "CANCELED".

**BR-WR-UP-03**

Allowed status transitions:

```text
RELEASED
  ├──▶ COMPLETED
  └──▶ CANCELED
```

### Response

**R-WR-UP-11**

WHEN the update is successful,  
the system SHALL return:

- affectedRows: the number of records updated
- updatedInstances: array of the fully updated work request objects

### Errors

**R-WR-UP-12**

IF the request contains validation errors,  
THEN the system SHALL return the validation errors in an errors array with a 400 status.
