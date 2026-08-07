const ROLE_SUBTYPE_MAP: Record<string, string[]> = {
  MANUFACTURING_FACILITATOR: ['Emergency'],
  TECHNICIAN_MAINTENANCE_01: ['Corrective'],
  TECHNICIAN_MAINTENANCE_02: ['Corrective', 'Emergency', 'Inspection'],
  PLANNER_MAINTENANCE_01: ['Preventive', 'Corrective', 'Emergency', 'Inspection'],
  PLANNER_MAINTENANCE_02: ['Preventive', 'Corrective', 'Emergency', 'Inspection'],
  COORDINATOR_MAINTENANCE_01: ['Preventive', 'Corrective', 'Emergency'],
  COORDINATOR_MAINTENANCE_02: ['Preventive', 'Corrective', 'Emergency'],
  SUPERVISOR_MAINTENANCE_01: ['Emergency'],
  SUPERVISOR_MAINTENANCE_02: ['Emergency'],
  ADMIN: ['Preventive', 'Corrective', 'Emergency', 'Inspection', 'TPM'],
};

export class WorkOrderSubTypePolicy {
  canCreateSubType(userRoles: string[], subType: string): boolean {
    for (const role of userRoles) {
      const allowed = ROLE_SUBTYPE_MAP[role];
      if (allowed && allowed.includes(subType)) {
        return true;
      }
    }
    return false;
  }
}
