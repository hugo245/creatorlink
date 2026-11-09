'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ShieldCheck } from 'lucide-react';
import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { ActionButton } from '@/components/action-button';
import { setupPayouts, startUsdDeposit, submitDeposit, submitUsdWithdrawal, submitWithdrawal, topUpTestFunds } from '@/app/actions/wallet';
import { fmtMoney } from '@/lib/money';

type Props = {
  cards: boolean; testFunds: boolean; gamepass: string; feePercent: number; feeFixedCents: number; holdDays: number;
  hasPayoutAccount: boolean; payoutsEnabled: boolean; withdrawableUsd: number; robuxBalance: number; blocker: string | null; emailVerified: boolean;
};

export function WalletForms(p: Props) {
  const [cur, setCur] = useState<'USD' | 'ROBUX'>('USD');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const tab = (active: boolean) => clsx('rounded-md px-4 py-1.5 transition', active ? 'bg-white shadow-card' : 'text-ink-3 hover:text-ink');
  return (
    <section className="card mt-6 p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-paper-3 p-1 text-sm font-semibold" role="tablist" aria-label="Currency">
          <button role="tab" aria-selected={cur === 'USD'} onClick={() => setCur('USD')} className={tab(cur === 'USD')}>US dollars</button>
          <button role="tab" aria-selected={cur === 'ROBUX'} onClick={() => setCur('ROBUX')} className={tab(cur === 'ROBUX')}>Robux</button>
        </div>
        <div className="inline-flex rounded-lg bg-paper-3 p-1 text-sm font-semibold" role="tablist" aria-label="Action">
          <button role="tab" aria-selected={mode === 'deposit'} onClick={() => setMode('deposit')} className={tab(mode === 'deposit')}>Add funds</button>
          <button role="tab" aria-selected={mode === 'withdraw'} onClick={() => setMode('withdraw')} className={tab(mode === 'withdraw')}>Withdraw</button>
        </div>
      </div>

      {p.testFunds && (
        <div className="mb-6 rounded-xl border border-dashed border-amber/50 bg-amber-soft p-4 text-sm">
          <p className="font-semibold text-amber">Development mode</p>
          <p className="mb-3 mt-1 text-ink-2">Test funds are enabled on this server.</p>
          <ActionButton action={topUpTestFunds} className="btn btn-outline btn-sm">Add R$ 5,000 and $50 test funds</ActionButton>
        </div>
      )}

      {cur === 'USD' && mode === 'deposit' && <UsdDeposit {...p} />}
      {cur === 'USD' && mode === 'withdraw' && <UsdWithdraw {...p} />}
      {cur === 'ROBUX' && mode === 'deposit' && <RobuxDeposit {...p} />}
      {cur === 'ROBUX' && mode === 'withdraw' && <RobuxWithdraw {...p} />}
    </section>
  );
}

function UsdDeposit(p: Props) {
  const [amount, setAmount] = useState('');
  const credit = Math.round(Number(amount) * 100);
  const valid = credit >= 500 && credit <= 100_000;
  const gross = valid ? Math.ceil((credit + p.feeFixedCents) / (1 - p.feePercent / 100)) : 0;
  if (!p.cards) {
    return <p className="max-w-lg text-sm text-ink-2">Card payments aren’t enabled on this server yet. You can still deposit Robux, or the site owner can enable USD by adding Stripe keys.</p>;
  }
  return (
    <ActionForm action={startUsdDeposit} className="grid gap-8 md:grid-cols-2">
      {(s) => (
        <>
          <div className="space-y-3 text-sm text-ink-2">
            <p className="flex items-center gap-2 font-semibold text-ink"><ShieldCheck size={17} className="text-moss" /> Secure card payment by Stripe</p>
            <p>Add US dollars to your wallet and use them to book creators who price in USD. We never see or store your card.</p>
            <p>A card processing fee ({p.feePercent}% + {fmtMoney(p.feeFixedCents, 'USD')}) is added at checkout so the amount you choose lands in your wallet in full.</p>
          </div>
          <div className="space-y-4">
            <Field label="Amount to add (USD)" name="amount" error={s?.fields?.amount} hint="Between $5 and $1,000.">
              <input id="amount" name="amount" type="number" min={5} max={1000} step="0.01" inputMode="decimal" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            {valid && (
              <dl className="rounded-lg bg-paper-2 p-3 text-sm">
                <div className="flex justify-between"><dt className="text-ink-3">Credited to wallet</dt><dd className="font-semibold tnum">{fmtMoney(credit, 'USD')}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Card processing fee</dt><dd className="tnum">{fmtMoney(gross - credit, 'USD')}</dd></div>
                <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold"><dt>You pay</dt><dd className="tnum">{fmtMoney(gross, 'USD')}</dd></div>
              </dl>
            )}
            <Notice state={s} />
            <SubmitButton className="btn btn-signal" pendingText="Opening checkout…">Continue to payment</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

function UsdWithdraw(p: Props) {
  if (!p.cards) return <p className="max-w-lg text-sm text-ink-2">USD payouts aren’t enabled on this server yet.</p>;
  if (p.blocker) return <p className="max-w-lg rounded-lg bg-amber-soft px-4 py-3 text-sm text-amber">{p.blocker}</p>;
  if (!p.payoutsEnabled) {
    return (
      <div className="max-w-xl space-y-4 text-sm text-ink-2">
        <p>To receive dollars you connect a bank account with Stripe. It takes a few minutes, and Stripe handles identity checks so we never store your bank details.</p>
        <ActionButton action={setupPayouts} className="btn btn-primary">{p.hasPayoutAccount ? 'Continue payout setup' : 'Set up payouts'}</ActionButton>
      </div>
    );
  }
  return (
    <ActionForm action={submitUsdWithdrawal} resetOnSuccess className="grid max-w-xl gap-4">
      {(s) => (
        <>
          <p className="text-sm text-ink-2">Withdrawals go to your connected bank account. Earnings become withdrawable {p.holdDays} days after each sale, which protects everyone from card chargebacks.</p>
          <Field label="Amount (USD)" name="amount" error={s?.fields?.amount} hint={`Withdrawable now: ${fmtMoney(p.withdrawableUsd, 'USD')} · minimum $10.`}>
            <input id="amount" name="amount" type="number" min={10} max={p.withdrawableUsd / 100} step="0.01" inputMode="decimal" className="field" />
          </Field>
          <Notice state={s} />
          <div><SubmitButton pendingText="Sending…">Withdraw</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

function RobuxDeposit(p: Props) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <ol className="space-y-3 text-sm text-ink-2">
        <li><span className="font-semibold text-ink">1.</span> Buy the CreatorLink deposit gamepass on Roblox{p.gamepass ? <> (<a href={p.gamepass} target="_blank" rel="noopener noreferrer" className="font-semibold underline">open gamepass</a>)</> : ' (link provided by support)'} for the amount you want to add.</li>
        <li><span className="font-semibold text-ink">2.</span> Submit the amount and your Roblox username as a reference.</li>
        <li><span className="font-semibold text-ink">3.</span> We confirm the purchase and credit your balance, usually within a day.</li>
      </ol>
      <ActionForm action={submitDeposit} resetOnSuccess className="space-y-4">
        {(s) => (
          <>
            <Field label="Amount (R$)" name="amount" error={s?.fields?.amount} hint="Minimum R$ 100."><input id="amount" name="amount" type="number" min={100} inputMode="numeric" className="field" /></Field>
            <Field label="Reference" name="reference" error={s?.fields?.reference} hint="Your Roblox username and the purchase time."><input id="reference" name="reference" className="field" /></Field>
            <Notice state={s} />
            <SubmitButton pendingText="Submitting…">Submit deposit</SubmitButton>
          </>
        )}
      </ActionForm>
    </div>
  );
}

function RobuxWithdraw(p: Props) {
  if (p.blocker) return <p className="max-w-lg rounded-lg bg-amber-soft px-4 py-3 text-sm text-amber">{p.blocker}</p>;
  return (
    <ActionForm action={submitWithdrawal} resetOnSuccess className="grid max-w-xl gap-4">
      {(s) => (
        <>
          <p className="text-sm text-ink-2">Create a gamepass priced so you receive your requested amount, and paste the link. We buy it and the Robux lands in your Roblox account. The amount is held from your balance now and returned if the request is rejected.</p>
          <Field label="Amount (R$)" name="amount" error={s?.fields?.amount} hint={`Available: ${fmtMoney(p.robuxBalance, 'ROBUX')} · minimum R$ 100.`}><input id="amount" name="amount" type="number" min={100} max={p.robuxBalance} inputMode="numeric" className="field" /></Field>
          <Field label="Gamepass link" name="gamepass" error={s?.fields?.gamepass}><input id="gamepass" name="gamepass" className="field" placeholder="https://www.roblox.com/game-pass/…" /></Field>
          <Notice state={s} />
          <div><SubmitButton pendingText="Requesting…">Request withdrawal</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}
