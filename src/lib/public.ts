import type { Stand } from "./types";

/** What a customer's browser may see about a stand: no owner key, no grower emails. */
export type PublicStand = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  location: string;
  currency: "USD";
  isDemo: boolean;
  items: { id: string; name: string; priceCents: number; unit: string }[];
};

export function toPublicStand(stand: Stand): PublicStand {
  return {
    id: stand.id,
    slug: stand.slug,
    name: stand.name,
    tagline: stand.tagline,
    location: stand.location,
    currency: stand.currency,
    isDemo: stand.isDemo,
    items: stand.items.map(({ id, name, priceCents, unit }) => ({ id, name, priceCents, unit })),
  };
}
