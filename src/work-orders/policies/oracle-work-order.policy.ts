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

  hasOracleCreatePermission(userPermissions: string[]): boolean {
    return userPermissions.includes('oracle.mnt.work.orders.create');
  }

  hasOracleUpdatePermission(userPermissions: string[]): boolean {
    return userPermissions.includes('oracle.mnt.work.orders.update');
  }

  hasAllowedRole(userRoles: string[]): boolean {
    return userRoles.some((role) => ORACLE_ALLOWED_ROLES.includes(role));
  }

  validateCreate(userPermissions: string[], userRoles: string[]): { valid: boolean; error?: string } {
    if (!this.isOracleEnabled()) {
      return { valid: true };
    }

    if (!this.hasOracleCreatePermission(userPermissions)) {
      return { valid: false, error: 'MISSING_ORACLE_PERMISSION' };
    }

    if (!this.hasAllowedRole(userRoles)) {
      return { valid: false, error: 'MISSING_ORACLE_PERMISSION' };
    }

    return { valid: true };
  }

  validateUpdate(userPermissions: string[], userRoles: string[]): { valid: boolean; error?: string } {
    if (!this.isOracleEnabled()) {
      return { valid: true };
    }

    if (!this.hasOracleUpdatePermission(userPermissions)) {
      return { valid: false, error: 'MISSING_ORACLE_PERMISSION' };
    }

    if (!this.hasAllowedRole(userRoles)) {
      return { valid: false, error: 'MISSING_ORACLE_PERMISSION' };
    }

    return { valid: true };
  }
}
