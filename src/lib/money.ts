/** All money is held as integer cents. These helpers are the only place cents become strings. */

export function centsToValue(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError(`Invalid amount in cents: ${cents}`);
  }
  return (cents / 100).toFixed(2);
}

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/** Parses "6", "6.5", "$6.50" into cents. Returns null for anything else. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Converts a PayPal decimal string ("12.50") to cents without floating point error. */
export function valueToCents(value: string): number {
  const [whole, fraction = ""] = value.split(".");
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) {
    throw new RangeError(`Invalid PayPal amount: ${value}`);
  }
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
