export type Currency = 'ROBUX' | 'USD';
export const CURRENCIES: Currency[] = ['ROBUX', 'USD'];

/** Robux are whole units; USD is stored as integer cents. */
export function fmtMoney(amount: number, currency: Currency): string {
  if (currency === 'USD') {
    const dollars = amount / 100;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: amount % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  }
  return `R$ ${Math.round(amount).toLocaleString('en-US')}`;
}

export const currencyLabel = (c: Currency) => (c === 'USD' ? 'US dollars' : 'Robux');

/** Convert a user-typed number (dollars or Robux) into stored units. */
export const toUnits = (value: number, c: Currency) => (c === 'USD' ? Math.round(value * 100) : Math.round(value));
export const fromUnits = (units: number, c: Currency) => (c === 'USD' ? units / 100 : units);

/** Minimum amounts in stored units (Robux, or USD cents). */
export const MIN_PRICE: Record<Currency, number> = { ROBUX: 50, USD: 300 };
export const MIN_DEPOSIT: Record<Currency, number> = { ROBUX: 100, USD: 500 };
export const MIN_WITHDRAWAL: Record<Currency, number> = { ROBUX: 100, USD: 1000 };
export const MAX_USD_DEPOSIT = 100_000; // $1,000 per deposit

export const balanceColumn = (c: Currency) => (c === 'USD' ? 'balance_usd' : 'balance');
