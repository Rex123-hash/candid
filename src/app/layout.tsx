import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { Cursor } from "@/components/fx/Cursor";
import "./globals.css";
import "./story.css";

// Atkinson Hyperlegible was designed by the Braille Institute for low-vision readers.
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body" });
const display = Schibsted_Grotesk({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Candid — snap what you take, pay, go", template: "%s · Candid" },
  description: "Checkout for farm stands and honesty boxes with nobody at the till. Built on PayPal and Venmo.",
};

export const viewport: Viewport = { themeColor: "#f7f5f0", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <Cursor />
      </body>
    </html>
  );
}
