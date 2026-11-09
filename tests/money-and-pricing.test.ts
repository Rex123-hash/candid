import { describe, expect, it } from "vitest";
import { demoStandRecord } from "@/lib/demo";
import { centsToValue, parsePriceToCents, valueToCents } from "@/lib/money";
import { priceCart, PricingError } from "@/lib/pricing";

const stand = demoStandRecord().stand;

describe("money", () => {
  it("round-trips cents and PayPal decimal strings exactly", () => {
    for (const cents of [1, 10, 99, 100, 600, 1999, 123456]) {
      expect(valueToCents(centsToValue(cents))).toBe(cents);
    }
    expect(centsToValue(900)).toBe("9.00");
    expect(valueToCents("12.5")).toBe(1250);
  });

  it("rejects invalid amounts", () => {
    expect(() => centsToValue(-1)).toThrow(RangeError);
    expect(() => centsToValue(1.5)).toThrow(RangeError);
    expect(() => valueToCents("1.234")).toThrow(RangeError);
    expect(() => valueToCents("abc")).toThrow(RangeError);
  });

  it("parses prices written on signs", () => {
    expect(parsePriceToCents("$6")).toBe(600);
    expect(parsePriceToCents("4.5")).toBe(450);
    expect(parsePriceToCents(" 9.99 ")).toBe(999);
    expect(parsePriceToCents("six")).toBeNull();
    expect(parsePriceToCents("-2")).toBeNull();
  });
});

describe("priceCart", () => {
  it("prices from the catalog, never from the client", () => {
    const { lines, totalCents } = priceCart(stand, [
      { itemId: "eggs", qty: 1 },
      { itemId: "honey", qty: 2 },
    ]);
    expect(totalCents).toBe(600 + 2 * 900);
    expect(lines.find((l) => l.itemId === "honey")).toMatchObject({ unitCents: 900, qty: 2 });
  });

  it("merges duplicate lines", () => {
    const { lines, totalCents } = priceCart(stand, [
      { itemId: "eggs", qty: 1 },
      { itemId: "eggs", qty: 2 },
    ]);
    expect(lines).toHaveLength(1);
    expect(totalCents).toBe(1800);
  });

  it("refuses items the stand doesn't sell and non-positive quantities", () => {
    expect(() => priceCart(stand, [{ itemId: "caviar", qty: 1 }])).toThrow(PricingError);
    expect(() => priceCart(stand, [{ itemId: "eggs", qty: 0 }])).toThrow(PricingError);
    expect(() => priceCart(stand, [{ itemId: "eggs", qty: 1.5 }])).toThrow(PricingError);
    expect(() => priceCart(stand, [])).toThrow(PricingError);
  });
});
