import type { Metadata } from 'next';
import { Doc } from '@/components/marketing/doc';
import { config } from '@/lib/config';

export const metadata: Metadata = { title: 'Safety & disputes' };

export default function Safety() {
  return (
    <Doc title="Safety & disputes">
      <p>CreatorLink exists so developers and creators can work together without trusting a stranger’s promise. This page explains exactly how your Robux is protected.</p>
      <h2>Escrow</h2>
      <p>When you place an order, the package price is deducted from your balance and locked to that order. It is not available to the creator until the work is approved. Every movement is recorded on your wallet ledger.</p>
      <h2>When you get a full refund</h2>
      <ul>
        <li>The creator declines the order.</li>
        <li>The creator doesn’t respond within {config.acceptWindowHours} hours.</li>
        <li>You cancel before the creator responds.</li>
        <li>The creator misses the delivery deadline and you cancel.</li>
        <li>Support rules in your favour after a dispute.</li>
      </ul>
      <h2>Reviewing a delivery</h2>
      <p>When a creator delivers, you have {config.reviewWindowHours} hours to approve, request a revision (up to the number included in the package), or open a dispute. If you don’t act, the funds are released automatically so creators aren’t left waiting indefinitely.</p>
      <h2>Disputes</h2>
      <p>Either party can open a dispute on an order in production or delivered. Support reads the full conversation and the delivery, may ask for more information, and then releases the funds to the creator or refunds the buyer. Decisions are recorded on the order.</p>
      <h2>Staying safe</h2>
      <ul>
        <li>Keep conversations and payments on CreatorLink — we can only protect orders we can see.</li>
        <li>Never share your Roblox password or .ROBLOSECURITY cookie with anyone. CreatorLink will never ask for it.</li>
        <li>Report suspicious behaviour to <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>.</li>
      </ul>
    </Doc>
  );
}
