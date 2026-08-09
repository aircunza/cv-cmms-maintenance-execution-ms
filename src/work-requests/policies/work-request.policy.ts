export const WORK_REQUEST_CREATE_ROLES = ["MANUFACTURING_FACILITATOR"];

export const WORK_REQUEST_CANCEL_ROLES = ["MANUFACTURING_FACILITATOR"];

export const WORK_REQUEST_COMPLETE_ROLES = [
  "MANUFACTURING_FACILITATOR",
  "TECHNICIAN_MAINTENANCE_01",
  "TECHNICIAN_MAINTENANCE_02",
  "PLANNER_MAINTENANCE_01",
  "PLANNER_MAINTENANCE_02",
  "COORDINATOR_MAINTENANCE_01",
  "COORDINATOR_MAINTENANCE_02",
  "SUPERVISOR_MAINTENANCE_01",
  "SUPERVISOR_MAINTENANCE_02",
  "ADMIN",
];

export class WorkRequestPolicy {
  canCreate(userRoles: string[]): boolean {
    return userRoles.some((role) => WORK_REQUEST_CREATE_ROLES.includes(role));
  }

  canCancel(userRoles: string[]): boolean {
    return userRoles.some((role) => WORK_REQUEST_CANCEL_ROLES.includes(role));
  }

  canComplete(userRoles: string[]): boolean {
    return userRoles.some((role) => WORK_REQUEST_COMPLETE_ROLES.includes(role));
  }
}
