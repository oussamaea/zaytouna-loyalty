/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StaffCustomerDetails } from "@/components/staff-customer-details";
import type { CustomerLoyaltyView } from "@/lib/types";

const customer = {
  profile: {
    id: "11111111-1111-4111-8111-111111111111",
    first_name: "Layla",
    loyalty_member_code: "ZB-ABC123",
  },
  account: {
    customer_id: "11111111-1111-4111-8111-111111111111",
    current_stamps: 10,
    cycle_number: 1,
    fifth_reward_status: "available",
    tenth_reward_status: "available",
    version: 1,
    updated_at: "2026-07-12T12:00:00.000Z",
  },
  transactions: [
    {
      id: "txn-1",
      customer_id: "11111111-1111-4111-8111-111111111111",
      staff_id: "22222222-2222-4222-8222-222222222222",
      transaction_type: "stamp_added",
      stamp_count_before: 9,
      stamp_count_after: 10,
      cycle_number: 1,
      request_id: "33333333-3333-4333-8333-333333333333",
      note: null,
      created_at: "2026-07-12T12:00:00.000Z",
    },
  ],
} satisfies CustomerLoyaltyView;

describe("StaffCustomerDetails", () => {
  it("renders stamp and reward controls", () => {
    render(<StaffCustomerDetails initialCustomer={customer} />);

    expect(screen.getByText("Layla")).toBeInTheDocument();
    expect(screen.getByText("ZB-ABC123")).toBeInTheDocument();
    expect(screen.getByText("10 of 10 stamps, cycle 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add one stamp/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /redeem 10%/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /redeem 50%/i }),
    ).toBeEnabled();
    expect(screen.getByText("stamp_added")).toBeInTheDocument();
  });
});
