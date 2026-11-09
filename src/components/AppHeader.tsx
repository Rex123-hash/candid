import Link from "next/link";
import { Icon } from "./Icon";

type Props = {
  /** Where "Back" goes. Every inner page returns to a predictable parent. */
  backHref: string;
  backLabel: string;
  badge?: string;
  narrow?: boolean;
  className?: string;
};

/** Top bar for the app's inner pages: a Back link, the brand, and a status badge. */
export function AppHeader({ backHref, backLabel, badge = "Sandbox demo", narrow, className = "" }: Props) {
  return (
    <header className={`site-header app-header wrap${narrow ? " narrow" : ""} ${className}`}>
      <Link href={backHref} className="back-link">
        <span className="back-icon" aria-hidden="true">
          <Icon name="arrow" size={18} />
        </span>
        <span>
          <span className="sr-only">Back to </span>
          {backLabel}
        </span>
      </Link>
      <Link href="/" className="brand" aria-label="Candid home">
        Candid<span>.</span>
      </Link>
      <span className="pill sandbox app-badge">{badge}</span>
    </header>
  );
}
