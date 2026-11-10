import type { StandRecord } from "./types";

export const DEMO_STAND_ID = "demo-maple-lane";

/**
 * A fictional demo stand so judges can try Candid without setting anything up.
 * Grower emails are sandbox placeholders; replace them with your own sandbox
 * personal accounts to see Payouts land.
 */
export function demoStandRecord(): StandRecord {
  return {
    stand: {
      id: DEMO_STAND_ID,
      slug: "maple-lane",
      name: "Maple Lane Farm Stand",
      tagline: "Eggs, honey and flowers from three neighbours. Pay on your honour.",
      location: "Maple Lane, by the red gate",
      currency: "USD",
      isDemo: true,
      ownerKeyHash: "",
      createdAt: "2026-11-01T08:00:00.000Z",
      growers: [
        { id: "g-rosa", name: "Rosa (hens)", paypalEmail: process.env.DEMO_GROWER_1_EMAIL ?? "rosa-grower@example.com" },
        { id: "g-tom", name: "Tom (bees)", paypalEmail: process.env.DEMO_GROWER_2_EMAIL ?? "tom-grower@example.com" },
        { id: "g-ana", name: "Ana (flowers)", paypalEmail: process.env.DEMO_GROWER_3_EMAIL ?? "ana-grower@example.com" },
      ],
      items: [
        { id: "eggs", name: "Free-range eggs", priceCents: 600, unit: "dozen", growerId: "g-rosa", lookFor: "a cardboard egg carton holding a dozen brown eggs" },
        { id: "honey", name: "Wildflower honey", priceCents: 900, unit: "jar", growerId: "g-tom", lookFor: "a glass jar of golden honey with a lid" },
        { id: "sunflowers", name: "Sunflower bunch", priceCents: 500, unit: "bunch", growerId: "g-ana", lookFor: "a bunch of yellow sunflowers wrapped in paper" },
        { id: "tomatoes", name: "Heirloom tomatoes", priceCents: 400, unit: "basket", growerId: "g-ana", lookFor: "a small basket or punnet of mixed-colour tomatoes" },
      ],
    },
    sales: [],
    shelfCounts: [],
    payouts: [],
    stockMoves: [],
  };
}
