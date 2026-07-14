export type AppleWalletAdapter = {
  isEnabled: () => boolean;
  createPass: () => Promise<never>;
};

export const appleWalletAdapter: AppleWalletAdapter = {
  isEnabled() {
    return false;
  },
  async createPass() {
    throw new Error(
      "Apple Wallet is disabled until signed certificate credentials are configured.",
    );
  },
};
