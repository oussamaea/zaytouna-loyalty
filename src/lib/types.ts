export type ProfileRole = "customer" | "staff" | "admin";
export type RewardStatus = "locked" | "available" | "redeemed";
export type TransactionType =
  "stamp_added" | "fifth_reward_redeemed" | "tenth_reward_redeemed";

export type Profile = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  birthday: string | null;
  role: ProfileRole;
  loyalty_member_code: string;
  created_at: string;
  updated_at: string;
};

export type LoyaltyAccount = {
  customer_id: string;
  current_stamps: number;
  cycle_number: number;
  fifth_reward_status: RewardStatus;
  tenth_reward_status: RewardStatus;
  version: number;
  updated_at: string;
};

export type LoyaltyTransaction = {
  id: string;
  customer_id: string;
  staff_id: string;
  transaction_type: TransactionType;
  stamp_count_before: number;
  stamp_count_after: number;
  cycle_number: number;
  request_id: string;
  note: string | null;
  created_at: string;
};

export type CustomerLoyaltyView = {
  profile: Pick<Profile, "id" | "first_name" | "loyalty_member_code">;
  account: LoyaltyAccount;
  transactions: LoyaltyTransaction[];
};
