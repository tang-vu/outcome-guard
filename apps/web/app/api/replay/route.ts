import replay from "../../../../../docs/evidence/verified-settled-replay.json";
import { canonicalize, sha256 } from "@outcome-guard/receipt";

export async function GET() {
  const { integrity, ...payload } = replay;
  const computedDigest = sha256(canonicalize(payload));
  if (computedDigest.toLowerCase() !== integrity.digest.toLowerCase()) return Response.json({ error: "Verified replay integrity check failed" }, { status: 500 });
  return Response.json({ ...replay, verification: { valid: true, computedDigest } }, { headers: { "cache-control": "public, max-age=300, immutable" } });
}
