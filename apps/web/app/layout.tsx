import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OutcomeGuard — bounded Event Contract protection",
  description: "Turn a downside concern into bounded, verifiable portfolio protection on Somnia Shannon."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
