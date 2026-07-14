import { describe, expect, it } from "vitest";
import {
  addStampToState,
  createInitialState,
  redeemFifthRewardInState,
  redeemTenthRewardInState,
} from "@/lib/loyalty/state-machine";
import { assertUsableQrToken } from "@/lib/loyalty/qr-validation";

const now = new Date("2026-07-11T12:00:00.000Z");

describe("loyalty operations", () => {
  it("adds the first stamp", () => {
    const state = createInitialState();
    addStampToState(state, {
      role: "staff",
      requestId: "request-1",
      now,
      cooldownSeconds: 0,
    });

    expect(state.currentStamps).toBe(1);
    expect(state.transactions).toHaveLength(1);
  });

  it("unlocks the 10% reward on the fifth stamp", () => {
    const state = createInitialState();
    for (let index = 1; index <= 5; index += 1) {
      addStampToState(state, {
        role: "staff",
        requestId: `request-${index}`,
        now: new Date(now.getTime() + index * 1000),
        cooldownSeconds: 0,
      });
    }

    expect(state.currentStamps).toBe(5);
    expect(state.fifthRewardStatus).toBe("available");
  });

  it("prevents duplicate fifth reward redemption", () => {
    const state = createInitialState({
      currentStamps: 5,
      fifthRewardStatus: "available",
    });
    redeemFifthRewardInState(state, {
      role: "staff",
      requestId: "redeem-10",
    });

    expect(() =>
      redeemFifthRewardInState(state, {
        role: "staff",
        requestId: "redeem-10-again",
      }),
    ).toThrow("not available");
  });

  it("redeems the fifth reward", () => {
    const state = createInitialState({
      currentStamps: 5,
      fifthRewardStatus: "available",
    });
    redeemFifthRewardInState(state, {
      role: "staff",
      requestId: "redeem-fifth",
    });

    expect(state.fifthRewardStatus).toBe("redeemed");
    expect(state.currentStamps).toBe(5);
  });

  it("unlocks the 50% reward on the tenth stamp", () => {
    const state = createInitialState();
    for (let index = 1; index <= 10; index += 1) {
      addStampToState(state, {
        role: "staff",
        requestId: `request-${index}`,
        now: new Date(now.getTime() + index * 1000),
        cooldownSeconds: 0,
      });
    }

    expect(state.currentStamps).toBe(10);
    expect(state.tenthRewardStatus).toBe("available");
  });

  it("rejects unauthorized redemption", () => {
    const state = createInitialState({
      currentStamps: 10,
      tenthRewardStatus: "available",
    });

    expect(() =>
      redeemTenthRewardInState(state, {
        role: "customer",
        requestId: "customer-redemption",
      }),
    ).toThrow("Only staff");
  });

  it("redeems the tenth reward", () => {
    const state = createInitialState({
      currentStamps: 10,
      tenthRewardStatus: "available",
    });
    redeemTenthRewardInState(state, {
      role: "staff",
      requestId: "redeem-tenth",
    });

    expect(state.transactions.at(-1)?.type).toBe("tenth_reward_redeemed");
  });

  it("resets the cycle after the tenth reward", () => {
    const state = createInitialState({
      currentStamps: 10,
      fifthRewardStatus: "redeemed",
      tenthRewardStatus: "available",
    });
    redeemTenthRewardInState(state, {
      role: "staff",
      requestId: "cycle-reset",
    });

    expect(state.currentStamps).toBe(0);
    expect(state.cycleNumber).toBe(2);
    expect(state.fifthRewardStatus).toBe("locked");
    expect(state.tenthRewardStatus).toBe("locked");
  });

  it("preserves transaction history after cycle reset", () => {
    const state = createInitialState({
      currentStamps: 10,
      tenthRewardStatus: "available",
      transactions: [
        {
          type: "stamp_added",
          before: 9,
          after: 10,
          cycleNumber: 1,
          requestId: "old-request",
        },
      ],
    });
    redeemTenthRewardInState(state, {
      role: "staff",
      requestId: "history-reset",
    });

    expect(state.transactions).toHaveLength(2);
    expect(state.transactions[0]?.requestId).toBe("old-request");
  });

  it("rejects duplicate request IDs", () => {
    const state = createInitialState();
    addStampToState(state, {
      role: "staff",
      requestId: "same-request",
      now,
      cooldownSeconds: 0,
    });

    expect(() =>
      addStampToState(state, {
        role: "staff",
        requestId: "same-request",
        now: new Date(now.getTime() + 1000),
        cooldownSeconds: 0,
      }),
    ).toThrow("Duplicate request ID");
  });

  it("enforces stamp cooldown", () => {
    const state = createInitialState();
    addStampToState(state, {
      role: "staff",
      requestId: "cooldown-1",
      now,
      cooldownSeconds: 300,
    });

    expect(() =>
      addStampToState(state, {
        role: "staff",
        requestId: "cooldown-2",
        now: new Date(now.getTime() + 60_000),
        cooldownSeconds: 300,
      }),
    ).toThrow("cooldown");
  });

  it("rejects expired QR codes", () => {
    expect(() =>
      assertUsableQrToken(
        {
          tokenHash: "abc",
          expiresAt: new Date(now.getTime() - 1000),
        },
        now,
      ),
    ).toThrow("Expired QR code");
  });

  it("rejects invalid QR codes", () => {
    expect(() => assertUsableQrToken(null, now)).toThrow("Invalid QR code");
  });

  it("rejects customers attempting to add a stamp", () => {
    const state = createInitialState();
    expect(() =>
      addStampToState(state, {
        role: "customer",
        requestId: "customer-add",
        now,
        cooldownSeconds: 0,
      }),
    ).toThrow("Only staff");
  });

  it("handles concurrent staff requests without exceeding ten stamps", () => {
    const state = createInitialState({ currentStamps: 9 });
    addStampToState(state, {
      role: "staff",
      requestId: "concurrent-1",
      now,
      cooldownSeconds: 0,
    });

    expect(() =>
      addStampToState(state, {
        role: "admin",
        requestId: "concurrent-2",
        now: new Date(now.getTime() + 1),
        cooldownSeconds: 0,
      }),
    ).toThrow("tenth reward");
    expect(state.currentStamps).toBe(10);
  });
});
