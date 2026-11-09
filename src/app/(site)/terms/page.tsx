import type { Metadata } from 'next';
import { Doc } from '@/components/marketing/doc';
import { config } from '@/lib/config';

export const metadata: Metadata = { title: 'Terms of service' };

export default function Terms() {
  return (
    <Doc title="Terms of service" updated="1 November 2026">
      <p>These terms govern your use of CreatorLink. By creating an account you agree to them.</p>
      <h2>1. The service</h2>
      <p>CreatorLink is a marketplace that connects Roblox developers (“buyers”) with content creators (“creators”). CreatorLink is not a party to the agreement between buyer and creator, but provides escrow and dispute resolution as described in our <a href="/safety">Safety page</a>.</p>
      <h2>2. Accounts</h2>
      <p>You must be at least 13 years old, and if you are under the age of majority you confirm a parent or guardian permits your use. You are responsible for your account and for keeping your password secure. One person, one account.</p>
      <h2>3. Orders and payment</h2>
      <p>Prices are set by creators in Robux or US dollars. When you place an order the price is held in escrow and released to the creator on approval, auto-approval or a dispute decision in their favour. Creators pay a service fee of {config.feeBps / 100}% on completed orders. Fees are shown before you order or withdraw.</p>
      <h2>4. Deposits and withdrawals</h2>
      <p>US dollar deposits are charged by card through Stripe, and a card processing fee is shown before you pay. US dollar withdrawals are paid to a bank account you connect with Stripe, may be subject to a holding period after each sale (shown in your wallet) and can be paused while we investigate suspected fraud or a chargeback. Robux deposits and withdrawals are processed through Roblox gamepasses and are confirmed manually. They are subject to Roblox’s own terms, including its marketplace fees. Balances are a record of Robux held on your behalf and are not a bank account, e-money or interest-bearing.</p>
      <h2>5. Creator conduct</h2>
      <p>Creators must own the channels they list and prove it by verification. Creators must not impersonate another person or channel, use misleading names, report their audience dishonestly, deliver what the package describes, disclose paid promotion where required by law and platform rules, and not use bots or purchased views. We may suspend creators who break these rules.</p>
      <h2>6. Prohibited use</h2>
      <p>No fraud, chargeback abuse, impersonation, harassment, illegal or age-inappropriate content, attempts to move transactions off-platform to avoid fees or protections, or attempts to disrupt the service.</p>
      <h2>7. Suspension</h2>
      <p>We may suspend or close accounts that violate these terms. Funds held in escrow on open orders will be resolved under the dispute process.</p>
      <h2>8. Liability</h2>
      <p>The service is provided “as is”. To the extent allowed by law, CreatorLink isn’t liable for indirect losses, including lost players or revenue, and our total liability is limited to the fees we received from you in the preceding 12 months.</p>
      <h2>9. Not affiliated with Roblox</h2>
      <p>CreatorLink is independent and is not affiliated with, endorsed by or sponsored by Roblox Corporation, YouTube or TikTok. Trademarks belong to their owners.</p>
      <h2>10. Contact</h2>
      <p>Questions: <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>.</p>
    </Doc>
  );
}
