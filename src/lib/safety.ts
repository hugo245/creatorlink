/**
 * Heuristics that flag chat messages trying to move a deal off the platform, where escrow can't protect anyone.
 * Messages are still delivered; they are marked so both sides see a warning and admins can review them.
 */
const PATTERNS: RegExp[] = [
  /discord\.(gg|com\/invite)\/\S+/i,
  /\b(paypal|cash\s?app|cashapp|venmo|zelle|wise\.com|western union|crypto|bitcoin|btc|usdt|gift\s?card)\b/i,
  /\b(pay|send|dm|message)\b.{0,20}\b(outside|off\s?(the\s?)?(site|platform)|directly|privately)\b/i,
  /\b(whatsapp|telegram|signal|snapchat)\b/i,
  /\bt\.me\/\S+/i,
  /\b(roblox\s?)?(password|cookie|\.roblosecurity|2fa code|verification code)\b/i,
];

export function flagMessage(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}
