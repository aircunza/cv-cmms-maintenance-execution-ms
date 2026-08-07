import { envs } from 'src/config';

const ORACLE_ALLOWED_ROLES = [
  'MANUFACTURING_FACILITATOR',
  'TECHNICIAN_MAINTENANCE_01',
  'TECHNICIAN_MAINTENANCE_02',
  'PLANNER_MAINTENANCE_01',
  'PLANNER_MAINTENANCE_02',
  'COORDINATOR_MAINTENANCE_01',
  'COORDINATOR_MAINTENANCE_02',
  'SUPERVISOR_MAINTENANCE_01',
  'SUPERVISOR_MAINTENANCE_02',
  'ADMIN',
];

export class OracleWorkOrderPolicy {
  isOracleEnabled(): boolean {
    return envs.enableOracleWorkOrderSystem === 'Y';
  }

  hasOraclePermission(userPermissions: string[]): boolean {
    return userPermissions.includes('oracle.mnt.work.orders.create');
  }

  hasAllowedRole(userRoles: string[]): boolean {
    return userRoles.some((role) => ORACLE_ALLOWED_ROLES.includes(role));
  }

  validate(userPermissions: string[], userRoles: string[]): { valid: boolean; error?: string } {
    if (!this.isOracleEnabled()) {
      return { valid: true };
    }

    if (!this.hasOraclePermission(userPermissions)) {
      return { valid: false, error: 'MISSING_ORACLE_PERMISSION' };
    }

    if (!this.hasAllowedRole(userRoles)) {
      return { valid: false, error: 'MISSING_ORACLE_PERMISSION' };
    }

    return { valid: true };
  }
}
