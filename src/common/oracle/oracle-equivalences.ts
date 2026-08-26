export const OracleEquivalences = {
  WorkOrderStatusCode: {
    UNRELEASED: "ORA_UNRELEASED",
    RELEASED: "ORA_RELEASED",
    ON_HOLD: "ORA_ON_HOLD",
    COMPLETED: "ORA_COMPLETED",
    CLOSED: "ORA_CLOSED",
    CANCELED: "ORA_CANCELED",
    PENDING_APPROVAL: "ORA_PENDING_APPROVAL",
  },
  WorkOrderTypeCode: {
    "Not Planned": "CORRECTIVE",
    Planned: "PREVENTIVE",
    fieldService: "FIELDSERVICE",
  },
  WorkOrderSubTypeCode: {
    Corrective: "CVJ_CORRECTIVE",
    Emergency: "ORA_EMERGENCY",
    Preventive: "ORA_PLANNED",
    Inspection: "ORA_PLANNED",
    TPM: "ORA_PLANNED",
  },
  WorkOrderOperation: {
    OperationType: {
      Internal: "IN_HOUSE",
      Supplier: "SUPPLIER",
    },
  },
  WorkCenterCode: {
    MaintenanceDepartment: "DEPARTAMENTO_DE_MANTENIMIENTO",
  },
} as const;
