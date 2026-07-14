import type { RewardStatus, TransactionType } from "@/lib/types";

export type LoyaltyState = {
  currentStamps: number;
  cycleNumber: number;
  fifthRewardStatus: RewardStatus;
  tenthRewardStatus: RewardStatus;
  lastStampAt?: Date;
  requestIds: Set<string>;
  transactions: Array<{
    type: TransactionType;
    before: number;
    after: number;
    cycleNumber: number;
    requestId: string;
  }>;
};

export function createInitialState(overrides: Partial<LoyaltyState> = {}) {
  return {
    currentStamps: 0,
    cycleNumber: 1,
    fifthRewardStatus: "locked" as const,
    tenthRewardStatus: "locked" as const,
    requestIds: new Set<string>(),
    transactions: [],
    ...overrides,
  };
}

function assertStaff(role: string) {
  if (!["staff", "admin"].includes(role)) {
    throw new Error("Only staff or admins can perform this loyalty action.");
  }
}

function assertFreshRequest(state: LoyaltyState, requestId: string) {
  if (state.requestIds.has(requestId)) {
    throw new Error("Duplicate request ID.");
  }
}

function record(
  state: LoyaltyState,
  type: TransactionType,
  before: number,
  after: number,
  requestId: string,
) {
  state.requestIds.add(requestId);
  state.transactions.push({
    type,
    before,
    after,
    cycleNumber: state.cycleNumber,
    requestId,
  });
}

export function addStampToState(
  state: LoyaltyState,
  input: {
    role: string;
    requestId: string;
    now: Date;
    cooldownSeconds?: number;
  },
) {
  assertStaff(input.role);
  assertFreshRequest(state, input.requestId);

  const cooldownSeconds = input.cooldownSeconds ?? 300;
  if (state.lastStampAt) {
    const elapsedSeconds =
      (input.now.getTime() - state.lastStampAt.getTime()) / 1000;
    if (elapsedSeconds < cooldownSeconds) {
      throw new Error("Stamp cooldown is still active.");
    }
  }

  if (state.currentStamps >= 10) {
    throw new Error("The tenth reward must be redeemed before adding stamps.");
  }

  const before = state.currentStamps;
  state.currentStamps += 1;
  state.lastStampAt = input.now;

  if (state.currentStamps === 5 && state.fifthRewardStatus === "locked") {
    state.fifthRewardStatus = "available";
  }

  if (state.currentStamps === 10 && state.tenthRewardStatus === "locked") {
    state.tenthRewardStatus = "available";
  }

  record(state, "stamp_added", before, state.currentStamps, input.requestId);
  return state;
}

export function redeemFifthRewardInState(
  state: LoyaltyState,
  input: { role: string; requestId: string },
) {
  assertStaff(input.role);
  assertFreshRequest(state, input.requestId);

  if (state.fifthRewardStatus !== "available") {
    throw new Error("The 10% reward is not available.");
  }

  state.fifthRewardStatus = "redeemed";
  record(
    state,
    "fifth_reward_redeemed",
    state.currentStamps,
    state.currentStamps,
    input.requestId,
  );
  return state;
}

export function redeemTenthRewardInState(
  state: LoyaltyState,
  input: { role: string; requestId: string },
) {
  assertStaff(input.role);
  assertFreshRequest(state, input.requestId);

  if (state.tenthRewardStatus !== "available") {
    throw new Error("The 50% reward is not available.");
  }

  const before = state.currentStamps;
  record(state, "tenth_reward_redeemed", before, 0, input.requestId);
  state.currentStamps = 0;
  state.cycleNumber += 1;
  state.fifthRewardStatus = "locked";
  state.tenthRewardStatus = "locked";
  state.lastStampAt = undefined;
  return state;
}
