import type { Metadata } from 'next';
import { Doc } from '@/components/marketing/doc';
import { config } from '@/lib/config';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function Privacy() {
  return (
    <Doc title="Privacy policy" updated="1 November 2026">
      <p>We collect only what we need to run the marketplace and keep it safe.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> username, email, hashed password, optional Roblox username and avatar.</li>
        <li><strong>Marketplace data:</strong> orders, messages and files you share in them, reviews, wallet transactions, and creator profile details.</li>
        <li><strong>Technical data:</strong> IP address and browser type for security, rate limiting and abuse prevention.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To provide the service, process escrow and payouts, resolve disputes, prevent fraud, and send service notifications. We don’t sell your data and don’t run third-party advertising trackers.</p>
      <h2>Who can see what</h2>
      <p>Creator profiles and reviews are public. Order details and messages are visible only to the two parties and to support staff when needed to resolve a dispute or abuse report.</p>
      <h2>Cookies</h2>
      <p>We use one essential cookie to keep you logged in. There are no analytics or advertising cookies.</p>
      <h2>Retention and deletion</h2>
      <p>We keep transaction records as long as needed for accounting and dispute purposes. To request deletion of your account, email us; we’ll remove personal data we are not required to keep.</p>
      <h2>Children</h2>
      <p>Many Roblox users are young. CreatorLink is for users 13 and older; accounts found to belong to younger children will be removed.</p>
      <h2>Contact</h2>
      <p><a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a></p>
    </Doc>
  );
}
