import { verifyReceipt } from "@outcome-guard/receipt";
import { findPublishedReceipt } from "../../../../lib/published-receipts";

export async function GET(request: Request, { params }: { params: Promise<{ digest: string }> }) {
  const { digest } = await params;
  const receipt = findPublishedReceipt(digest);
  if (!receipt) return Response.json({ error: "No packaged evidence receipt matches this digest." }, { status: 404 });

  const verification = verifyReceipt(receipt);
  if (!verification.valid) {
    return Response.json({ error: "Packaged receipt failed independent verification.", verification }, { status: 500 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(`${JSON.stringify(receipt, null, 2)}\n`, {
    headers: {
      "cache-control": "public, max-age=300, immutable",
      "content-type": "application/json; charset=utf-8",
      ...(download ? { "content-disposition": `attachment; filename="outcomeguard-${receipt.integrity.digest.slice(2, 14)}.json"` } : {})
    }
  });
}
