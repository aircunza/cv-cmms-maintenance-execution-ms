export const OP_STATUS = {
  UNRELEASED: 'UNRELEASED',
  RELEASED: 'RELEASED',
  IN_PROCESS: 'IN_PROCESS',
  COMPLETED: 'COMPLETED',
  NOT_DONE: 'NOT_DONE',
  CANCELED: 'CANCELED',
  ON_HOLD: 'ON_HOLD',
} as const;

export type OperationStatus = (typeof OP_STATUS)[keyof typeof OP_STATUS];

export const WO_STATUS_TO_OPERATION_STATUS: Record<string, string[]> = {
  CANCELED: ['CANCELED'],
  COMPLETED: ['COMPLETED', 'NOT_DONE'],
  CLOSED: ['COMPLETED', 'NOT_DONE'],
  ON_HOLD: ['ON_HOLD'],
  PENDING_APPROVAL: ['UNRELEASED'],
  RELEASED: ['RELEASED', 'COMPLETED', 'IN_PROCESS'],
  UNRELEASED: ['UNRELEASED'],
};

export function isOperationStatusCompatible(
  woStatus: string,
  opStatus: string,
): boolean {
  const allowed = WO_STATUS_TO_OPERATION_STATUS[woStatus];
  return allowed ? allowed.includes(opStatus) : false;
}
