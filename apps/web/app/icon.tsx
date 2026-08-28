import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#0b7959" }}><div style={{ width: 13, height: 13, display: "flex", border: "2px solid #f4f1e9", transform: "rotate(45deg)" }} /></div>, size);
}
