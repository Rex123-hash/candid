import type { Item, SaleLine, Stand } from "./types";

export class PricingError extends Error {}

/**
 * Turns a customer's cart into priced lines using only the stand's own catalog.
 * The browser sends item ids and quantities; it never sends prices.
 */
export function priceCart(stand: Stand, cart: { itemId: string; qty: number }[]): { lines: SaleLine[]; totalCents: number } {
  const byId = new Map<string, Item>(stand.items.map((item) => [item.id, item]));
  const merged = new Map<string, number>();

  for (const { itemId, qty } of cart) {
    if (!byId.has(itemId)) throw new PricingError(`This stand doesn't sell item ${itemId}.`);
    if (!Number.isInteger(qty) || qty < 1) throw new PricingError("Quantities must be whole numbers above zero.");
    merged.set(itemId, (merged.get(itemId) ?? 0) + qty);
  }

  const lines: SaleLine[] = [...merged].map(([itemId, qty]) => {
    const item = byId.get(itemId)!;
    return { itemId, name: item.name, qty, unitCents: item.priceCents };
  });
  const totalCents = lines.reduce((sum, line) => sum + line.qty * line.unitCents, 0);
  if (totalCents <= 0) throw new PricingError("The basket is empty.");
  return { lines, totalCents };
}
