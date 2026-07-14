/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffDashboard } from "@/components/staff-dashboard";

const customer = {
  id: "11111111-1111-4111-8111-111111111111",
  firstName: "Layla",
  memberCode: "ZB-ABC123",
  currentStamps: 6,
  cycleNumber: 1,
  fifthRewardStatus: "available",
  tenthRewardStatus: "locked",
};

describe("StaffDashboard component", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a Start camera button", () => {
    render(<StaffDashboard />);

    expect(
      screen.getByRole("button", { name: /start camera/i }),
    ).toBeInTheDocument();
  });

  it("renders customer data after manual lookup succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ customer })),
    );

    render(<StaffDashboard />);
    fireEvent.change(screen.getByLabelText(/member code/i), {
      target: { value: "ZB-ABC123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /look up member/i }));

    expect(await screen.findByText("Layla")).toBeInTheDocument();
    expect(screen.getByText("ZB-ABC123")).toBeInTheDocument();
    expect(screen.getByText("6 of 10")).toBeInTheDocument();
    expect(screen.getByText("available")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open customer loyalty details/i }),
    ).toHaveAttribute(
      "href",
      "/staff/customer/11111111-1111-4111-8111-111111111111",
    );
  });
});
