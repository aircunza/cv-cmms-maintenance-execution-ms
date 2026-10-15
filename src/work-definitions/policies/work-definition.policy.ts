export const WORK_DEFINITION_WRITE_ROLES = [
  "PLANNER_MAINTENANCE_01",
  "PLANNER_MAINTENANCE_02",
];

export class WorkDefinitionPolicy {
  canCreate(userRoles: string[]): boolean {
    return userRoles.some((role) => WORK_DEFINITION_WRITE_ROLES.includes(role));
  }

  canUpdate(userRoles: string[]): boolean {
    return userRoles.some((role) => WORK_DEFINITION_WRITE_ROLES.includes(role));
  }
}
