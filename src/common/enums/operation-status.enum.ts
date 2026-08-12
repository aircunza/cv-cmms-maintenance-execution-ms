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

export const OP_STATUS_TRANSITIONS: Record<string, string[]> = {
  UNRELEASED: ['ON_HOLD', 'RELEASED', 'CANCELED'],
  RELEASED: ['COMPLETED', 'ON_HOLD', 'CANCELED'],
  ON_HOLD: ['RELEASED', 'CANCELED'],
  IN_PROCESS: ['COMPLETED', 'ON_HOLD', 'CANCELED'],
  COMPLETED: ['CLOSED', 'RELEASED'],
  NOT_DONE: ['CANCELED'],
  CANCELED: [],
};

export function isValidOpTransition(from: string, to: string): boolean {
  const allowed = OP_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

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
