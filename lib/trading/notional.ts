import Decimal from 'decimal.js';

Decimal.set({ precision: 50, rounding: Decimal.ROUND_DOWN });

export function roundDownToIncrement(value: string, increment: string): string {
  const amount = new Decimal(value);
  const step = new Decimal(increment);
  if (!amount.isFinite() || amount.isNegative() || !step.isPositive()) {
    throw new Error('Amount and increment must be valid positive decimals.');
  }
  return amount.div(step).floor().mul(step).toFixed(step.decimalPlaces());
}

export function notionalToBaseAmount(
  notionalUsd: string,
  price: string,
  sizeIncrement: string,
): string {
  const notional = new Decimal(notionalUsd);
  const marketPrice = new Decimal(price);
  if (!notional.isPositive() || !marketPrice.isPositive()) {
    throw new Error('Notional and price must be greater than zero.');
  }
  return roundDownToIncrement(
    notional.div(marketPrice).toString(),
    sizeIncrement,
  );
}

export function calculateNotional(baseAmount: string, price: string): string {
  return new Decimal(baseAmount)
    .abs()
    .mul(price)
    .toFixed(2, Decimal.ROUND_DOWN);
}

export function validateNotional(input: {
  notionalUsd: string;
  minimumUsd: string;
  availableUsd?: string;
}): string[] {
  const errors: string[] = [];
  const value = new Decimal(input.notionalUsd || 0);
  if (!value.isFinite() || !value.isPositive())
    errors.push('Enter a positive USD amount.');
  if (value.lt(input.minimumUsd))
    errors.push(`Minimum executable size is $${input.minimumUsd}.`);
  if (input.availableUsd && value.gt(input.availableUsd))
    errors.push(`Available position size is up to $${input.availableUsd}.`);
  return errors;
}

export function isPriceStale(
  timestamp: string | number | Date,
  maxAgeMs = 30_000,
  now = Date.now(),
): boolean {
  return now - new Date(timestamp).getTime() > maxAgeMs;
}

export function bpsToPercent(bps: number): string {
  return new Decimal(bps).div(100).toString();
}
