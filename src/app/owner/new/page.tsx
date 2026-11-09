import type { Metadata } from "next";
import Link from "next/link";
import { SetupWizard } from "@/components/SetupWizard";

export const metadata: Metadata = { title: "Set up your stand" };

export default function NewStandPage() {
  return (
    <>
      <header className="site-header wrap narrow row" style={{ justifyContent: "space-between" }}>
        <Link href="/" className="brand">
          Candid<span>.</span>
        </Link>
        <span className="pill sandbox">Sandbox</span>
      </header>
      <main id="main" className="wrap narrow stack" style={{ "--gap": "20px", paddingBottom: 64 } as React.CSSProperties}>
        <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
          <p className="eyebrow">Two minutes, one photo</p>
          <h1>Set up your stand</h1>
        </div>
        <SetupWizard />
      </main>
    </>
  );
}
