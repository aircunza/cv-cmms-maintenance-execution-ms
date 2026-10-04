export const WR_STATUS = {
  ON_HOLD: "ON_HOLD",
  RELEASED: "RELEASED",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
} as const;

export type WorkRequestStatus = (typeof WR_STATUS)[keyof typeof WR_STATUS];

export const WR_STATUS_TRANSITIONS: Record<string, string[]> = {
  ON_HOLD: ["RELEASED"],
  RELEASED: ["COMPLETED", "CANCELED"],
  COMPLETED: ["CANCELED"],
  CANCELED: [],
};

export function isValidWrTransition(from: string, to: string): boolean {
  const allowed = WR_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
