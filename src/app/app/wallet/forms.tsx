'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { ActionButton } from '@/components/action-button';
import { submitDeposit, submitWithdrawal, topUpTestFunds } from '@/app/actions/account';

export function WalletForms({ testFunds, gamepass, minDeposit, minWithdrawal, balance }: { testFunds: boolean; gamepass: string; minDeposit: number; minWithdrawal: number; balance: number }) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  return (
    <section className="card mt-6 p-6">
      <div className="mb-5 inline-flex rounded-lg bg-paper-3 p-1 text-sm font-semibold" role="tablist">
        {(['deposit', 'withdraw'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx('rounded-md px-4 py-1.5 capitalize transition', tab === t ? 'bg-white shadow-card' : 'text-ink-3 hover:text-ink')}>{t === 'deposit' ? 'Add funds' : 'Withdraw'}</button>
        ))}
      </div>

      {tab === 'deposit' ? (
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <ol className="space-y-3 text-sm text-ink-2">
              <li><span className="font-semibold text-ink">1.</span> Buy the CreatorLink deposit gamepass on Roblox{gamepass ? <> — <a href={gamepass} target="_blank" rel="noopener noreferrer" className="font-semibold underline">open gamepass</a></> : ' (link provided by support)'} for the amount you want to add.</li>
              <li><span className="font-semibold text-ink">2.</span> Submit the amount and your Roblox username as a reference.</li>
              <li><span className="font-semibold text-ink">3.</span> We confirm the purchase and credit your balance, usually within a day.</li>
            </ol>
            {testFunds && (
              <div className="mt-5 rounded-xl border border-dashed border-amber/50 bg-amber-soft p-4 text-sm">
                <p className="font-semibold text-amber">Development mode</p>
                <p className="mb-3 mt-1 text-ink-2">Test funds are enabled on this server.</p>
                <ActionButton action={topUpTestFunds} className="btn btn-outline btn-sm">Add R$ 5,000 test funds</ActionButton>
              </div>
            )}
          </div>
          <ActionForm action={submitDeposit} resetOnSuccess className="space-y-4">
            {(s) => (
              <>
                <Field label="Amount (R$)" name="amount" error={s?.fields?.amount} hint={`Minimum R$ ${minDeposit}.`}><input id="amount" name="amount" type="number" min={minDeposit} inputMode="numeric" className="field" /></Field>
                <Field label="Reference" name="reference" error={s?.fields?.reference} hint="Your Roblox username and the purchase time."><input id="reference" name="reference" className="field" /></Field>
                <Notice state={s} />
                <SubmitButton pendingText="Submitting…">Submit deposit</SubmitButton>
              </>
            )}
          </ActionForm>
        </div>
      ) : (
        <ActionForm action={submitWithdrawal} resetOnSuccess className="grid max-w-xl gap-4">
          {(s) => (
            <>
              <p className="text-sm text-ink-2">Create a gamepass priced so you receive your requested amount, and paste the link. We buy it and the Robux lands in your Roblox account. The amount is held from your balance now and returned if the request is rejected.</p>
              <Field label="Amount (R$)" name="amount" error={s?.fields?.amount} hint={`Available: R$ ${balance.toLocaleString('en-US')} · minimum R$ ${minWithdrawal}.`}><input id="amount" name="amount" type="number" min={minWithdrawal} max={balance} inputMode="numeric" className="field" /></Field>
              <Field label="Gamepass link" name="gamepass" error={s?.fields?.gamepass}><input id="gamepass" name="gamepass" className="field" placeholder="https://www.roblox.com/game-pass/…" /></Field>
              <Notice state={s} />
              <div><SubmitButton pendingText="Requesting…">Request withdrawal</SubmitButton></div>
            </>
          )}
        </ActionForm>
      )}
    </section>
  );
}
