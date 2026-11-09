import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { StandCheckout } from "@/components/StandCheckout";
import { toPublicStand } from "@/lib/public";
import { getStandIdBySlug, getStandRecord } from "@/lib/store";

export const dynamic = "force-dynamic";

async function loadStand(slug: string) {
  const id = await getStandIdBySlug(slug);
  const record = id ? await getStandRecord(id) : null;
  return record ? toPublicStand(record.stand) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const stand = await loadStand((await params).slug);
  return { title: stand ? stand.name : "Stand not found" };
}

export default async function StandPage({ params }: { params: Promise<{ slug: string }> }) {
  const stand = await loadStand((await params).slug);
  if (!stand) notFound();

  return (
    <>
      <AppHeader backHref="/app" backLabel="All demos" narrow />
      <main id="main" className="wrap narrow stack" style={{ "--gap": "20px", paddingBottom: 48 } as React.CSSProperties}>
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <p className="eyebrow">Honesty checkout · {stand.location}</p>
          <h1 className="stand-title">{stand.name}</h1>
          <p className="muted">{stand.tagline}</p>
        </div>
        <StandCheckout stand={stand} />
      </main>
    </>
  );
}
