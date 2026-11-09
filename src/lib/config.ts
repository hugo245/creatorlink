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
  /** Approximate USD value of 1 Robux. Used ONLY to sort and filter prices across currencies. */
  robuxUsdRate: Number(process.env.ROBUX_USD_RATE ?? 0.0035),
  /** Days before USD earnings from a sale become withdrawable (covers the card chargeback window). */
  usdPayoutHoldDays: Number(process.env.USD_PAYOUT_HOLD_DAYS ?? 7),
  /** Minimum account age (days) before any withdrawal. */
  minAccountAgeDaysForPayout: Number(process.env.MIN_ACCOUNT_AGE_DAYS_FOR_PAYOUT ?? 3),
  /** Card processing fee passed through to the buyer on USD deposits (Stripe's standard rate by default). */
  stripeFeePercent: Number(process.env.STRIPE_FEE_PERCENT ?? 2.9),
  stripeFeeFixedCents: Number(process.env.STRIPE_FEE_FIXED_CENTS ?? 30),
  /** If true, creators whose channel ownership is verified are approved automatically. */
  autoApproveVerifiedCreators: process.env.AUTO_APPROVE_VERIFIED_CREATORS === 'true',
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
