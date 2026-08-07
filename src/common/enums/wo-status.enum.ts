export const WO_STATUS = {
  UNRELEASED: 'UNRELEASED',
  RELEASED: 'RELEASED',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
  CANCELED: 'CANCELED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
} as const;

export type WorkOrderStatus = (typeof WO_STATUS)[keyof typeof WO_STATUS];

export const WO_STATUS_TRANSITIONS: Record<string, string[]> = {
  UNRELEASED: ['ON_HOLD', 'RELEASED', 'CANCELED'],
  RELEASED: ['COMPLETED', 'ON_HOLD', 'CANCELED'],
  ON_HOLD: ['RELEASED', 'CANCELED'],
  COMPLETED: ['CLOSED', 'RELEASED'],
  CLOSED: [],
  CANCELED: [],
  PENDING_APPROVAL: ['UNRELEASED'],
};

export function isValidWoTransition(from: string, to: string): boolean {
  const allowed = WO_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
