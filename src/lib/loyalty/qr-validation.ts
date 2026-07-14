export type QrTokenRecord = {
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  revokedAt?: Date | null;
};

export function assertUsableQrToken(record: QrTokenRecord | null, now: Date) {
  if (!record) {
    throw new Error("Invalid QR code.");
  }

  if (record.revokedAt || record.usedAt) {
    throw new Error("Invalid QR code.");
  }

  if (record.expiresAt.getTime() <= now.getTime()) {
    throw new Error("Expired QR code.");
  }

  return true;
}
