"use client";

import { formatCents } from "@/lib/client";
import { Icon } from "./Icon";

type Item = { id: string; name: string; priceCents: number; unit: string };

type Props = {
  items: Item[];
  quantities: Record<string, number>;
  onChange: (itemId: string, qty: number) => void;
  /** Items the AI wasn't sure about, highlighted for the customer to check. */
  unsure?: Set<string>;
  max?: number;
};

/** One row per catalog item with − / + steppers. Every control has a spoken name. */
export function QuantityList({ items, quantities, onChange, unsure, max = 50 }: Props) {
  return (
    <ul className="qty-list" role="list">
      {items.map((item) => {
        const qty = quantities[item.id] ?? 0;
        const isUnsure = unsure?.has(item.id) && qty > 0;
        return (
          <li key={item.id} className={`qty-row${qty > 0 ? " picked" : ""}`}>
            <div className="qty-name">
              <span className="qty-title">{item.name}</span>
              <span className="muted num">
                {formatCents(item.priceCents)} / {item.unit}
              </span>
              {isUnsure ? <span className="pill attention">Please check this one</span> : null}
            </div>
            <div className="qty-stepper">
              <button
                type="button"
                className="icon-btn"
                onClick={() => onChange(item.id, Math.max(0, qty - 1))}
                disabled={qty === 0}
                aria-label={`One less ${item.name}`}
              >
                <Icon name="minus" size={18} />
              </button>
              <output className="qty-value num" aria-label={`${item.name} quantity`}>
                {qty}
              </output>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onChange(item.id, Math.min(max, qty + 1))}
                disabled={qty >= max}
                aria-label={`One more ${item.name}`}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
