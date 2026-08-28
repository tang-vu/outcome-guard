import { verifyReceipt } from "@outcome-guard/receipt";
import preExecutionReceipt from "../../../../../docs/evidence/pre-execution-receipt.json";

const publishedReceipts: unknown[] = [preExecutionReceipt];

async function findReceipt(digest: string): Promise<unknown | undefined> {
  for (const value of publishedReceipts) {
    if (typeof value === "object" && value !== null && "integrity" in value) {
      const foundDigest = (value as { integrity?: { digest?: string } }).integrity?.digest;
      if (foundDigest?.toLowerCase() === digest.toLowerCase()) return value;
    }
  }
  return undefined;
}

export default async function ReceiptPage({ params }: { params: Promise<{ digest: string }> }) {
  const { digest } = await params;
  const receipt = await findReceipt(digest);
  const verification = receipt ? verifyReceipt(receipt) : { valid: false, errors: ["No published evidence receipt matches this digest."] };
  return <main style={{ maxWidth: 960, margin: "0 auto", padding: "50px 20px" }}>
    <a className="brand" href="/">◇ OutcomeGuard</a>
    <section className="card" style={{ padding: 30, marginTop: 35 }}>
      <p className="eyebrow">RECEIPT EXPLORER</p><h1 style={{ fontFamily: "Georgia,serif", fontSize: 42, marginBottom: 10 }}>Intent-to-settlement proof</h1>
      <p className={verification.valid ? "pass" : "fail"}>{verification.valid ? "✓ VERIFIED — canonical digest matches" : "✕ NOT VERIFIED"}</p>
      <code className="digest">{digest}</code>
      {!receipt && <p>This explorer only serves evidence artifacts shipped with this build. Unknown digests fail closed.</p>}
      {receipt !== undefined && <><h2>Human view</h2><div className="timeline"><i className="done">Intent</i><i className="done">Plan</i><i className="done">Policy</i><i>Authorization</i><i>Execution</i><i>Settlement</i><i>Claim</i></div><h2>Raw canonical input</h2><pre style={{ overflow: "auto", background: "#eef1eb", padding: 16, borderRadius: 8, fontSize: 11 }}>{JSON.stringify(receipt, null, 2)}</pre></>}
    </section>
  </main>;
}
