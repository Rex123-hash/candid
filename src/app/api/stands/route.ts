import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { assertSameOrigin, handleError, hashKey, json, ownerCookieName } from "@/lib/http";
import { createCatalogProduct } from "@/lib/paypal";
import { createStandRecord, getStandIdBySlug, updateStandRecord } from "@/lib/store";
import { CreateStandSchema, type Stand } from "@/lib/types";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = CreateStandSchema.parse(await request.json());
    const growerIds = new Set(input.growers.map((g) => g.id));
    const ownerKey = randomBytes(24).toString("base64url");
    const id = `s-${randomUUID().slice(0, 8)}`;

    const stand: Stand = {
      id,
      slug: await uniqueSlug(input.name),
      name: input.name,
      tagline: "Pay on your honour.",
      location: input.location,
      currency: "USD",
      isDemo: false,
      ownerKeyHash: hashKey(ownerKey),
      createdAt: new Date().toISOString(),
      growers: input.growers,
      items: input.items.map((item, index) => ({
        id: `${slugify(item.name).slice(0, 24) || "item"}-${index + 1}`,
        name: item.name,
        priceCents: item.priceCents,
        unit: item.unit || "each",
        lookFor: item.lookFor,
        growerId: item.growerId && growerIds.has(item.growerId) ? item.growerId : null,
      })),
    };
    await createStandRecord({ stand, sales: [], shelfCounts: [], payouts: [] });

    (await cookies()).set(ownerCookieName(id), ownerKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    // Register each item as a PayPal catalog product. The stand works without
    // this, so a PayPal hiccup here doesn't block setup.
    let catalogSynced = true;
    try {
      const productIds = await Promise.all(stand.items.map((item) => createCatalogProduct(stand, item)));
      await updateStandRecord(id, (record) => {
        record.stand.items.forEach((item, i) => (item.paypalProductId = productIds[i]));
      });
    } catch (error) {
      catalogSynced = false;
      console.error("[candid] catalog sync failed", error);
    }

    return json({ id, slug: stand.slug, catalogSynced }, 201);
  } catch (error) {
    return handleError(error);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name).slice(0, 40) || "stand";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    if (!(await getStandIdBySlug(candidate))) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}
