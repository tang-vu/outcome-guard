import { ImageResponse } from "next/og";

export const alt = "OutcomeGuard — turn downside concern into policy-bound, verifiable protection";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", background: "#f4f1e9", color: "#101d1a" }}><div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 700 }}><span style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0b7959", borderRadius: "50%" }}><i style={{ width: 15, height: 15, display: "flex", border: "2px solid #0b7959", transform: "rotate(45deg)" }} /></span>OutcomeGuard</div><div style={{ display: "flex", flexDirection: "column", gap: 18 }}><span style={{ color: "#0b7959", fontSize: 20, fontWeight: 700, letterSpacing: 3 }}>PORTFOLIO-AWARE EVENT CONTRACT PROTECTION</span><strong style={{ maxWidth: 980, fontFamily: "serif", fontSize: 76, lineHeight: 1.02, letterSpacing: -3 }}>Turn a downside concern into policy-bound, verifiable protection.</strong></div><div style={{ display: "flex", justifyContent: "space-between", color: "#52635d", fontSize: 20 }}><span>DreamDEX · Somnia Shannon 50312</span><span>Intent → Policy → Receipt → Chain</span></div></div>, size);
}
