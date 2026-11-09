/** Central, typed access to configuration. Everything has a safe default for local dev. */
export const config = {
  appName: 'CreatorLink',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  /** Platform fee charged to the creator on completed orders, in basis points (1000 = 10%). */
  feeBps: Number(process.env.PLATFORM_FEE_BPS ?? 1000),
  /** Hours a creator has to accept an order before it is cancelled and refunded. */
  acceptWindowHours: 48,
  /** Hours a buyer has to review a delivery before funds auto-release. */
  reviewWindowHours: 72,
  minWithdrawal: 100,
  minDeposit: 100,
  /** Instant "test funds" button. Never enable in production. */
  testFunds: process.env.ENABLE_TEST_FUNDS === 'true',
  /** Gamepass users buy to deposit Robux (shown on the deposit instructions). */
  depositGamepassUrl: process.env.DEPOSIT_GAMEPASS_URL || '',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@creatorlink.example',
  isProd: process.env.NODE_ENV === 'production',
  // Kept under Vercel's 4.5 MB request limit for serverless functions.
  maxUploadBytes: 4 * 1024 * 1024,
} as const;

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
