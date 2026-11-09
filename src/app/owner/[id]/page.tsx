import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { OwnerDashboard } from "@/components/OwnerDashboard";
import { HttpError, requireOwner } from "@/lib/http";
import { summarise } from "@/lib/summary";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner view", robots: { index: false } };

export default async function OwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let record;
  try {
    record = await requireOwner(id);
  } catch (error) {
    const message = error instanceof HttpError ? error.message : "This owner page isn't available.";
    return (
      <>
        <AppHeader backHref="/app" backLabel="All demos" narrow />
        <main id="main" className="wrap narrow stack" style={{ paddingBlock: 32 }}>
          <h1>Owner view</h1>
          <p className="notice error">{message}</p>
          <Link href="/app" className="btn secondary">
            Back to all demos
          </Link>
        </main>
      </>
    );
  }
  const { stand } = record;

  return (
    <>
      <AppHeader backHref="/app" backLabel="All demos" badge={stand.isDemo ? "Demo stand · sandbox" : "Sandbox"} />
      <main id="main" className="wrap stack" style={{ "--gap": "24px", paddingBottom: 64 } as React.CSSProperties}>
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <p className="eyebrow">Owner view</p>
          <h1>{stand.name}</h1>
        </div>
        <OwnerDashboard
          stand={{
            id: stand.id,
            slug: stand.slug,
            name: stand.name,
            isDemo: stand.isDemo,
            items: stand.items.map(({ id: itemId, name, unit }) => ({ id: itemId, name, unit })),
          }}
          growers={stand.growers.map(({ id: growerId, name }) => ({ id: growerId, name }))}
          initial={summarise(record)}
        />
      </main>
    </>
  );
}
