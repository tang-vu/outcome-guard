import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "OutcomeGuard — policy-bound portfolio protection", template: "%s · OutcomeGuard" },
  description: "Turn BTC or ETH downside concern into transparent, policy-bound short-duration protection using DreamDEX Event Contracts on Somnia Shannon.",
  applicationName: "OutcomeGuard",
  keywords: ["Somnia", "DreamDEX", "Event Contracts", "portfolio protection", "hedging", "Shannon testnet"],
  authors: [{ name: "OutcomeGuard contributors" }],
  openGraph: { type: "website", title: "OutcomeGuard — intent to verifiable protection", description: "Portfolio-aware Event Contract protection with deterministic policy and linked receipts.", siteName: "OutcomeGuard" },
  twitter: { card: "summary_large_image", title: "OutcomeGuard", description: "Turn a downside concern into policy-bound, verifiable protection." },
  robots: { index: false, follow: false },
  category: "technology"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
