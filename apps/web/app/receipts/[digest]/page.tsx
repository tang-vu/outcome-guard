import { verifyReceipt } from "@outcome-guard/receipt";
import { findPublishedReceipt } from "../../../lib/published-receipts";

const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-8)}`;
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);

export default async function ReceiptPage({ params }: { params: Promise<{ digest: string }> }) {
  const { digest } = await params;
  const receipt = findPublishedReceipt(digest);
  const verification = receipt ? verifyReceipt(receipt) : { valid: false, errors: ["No packaged evidence receipt matches this digest."] };

  if (!receipt) return <main className="explorerShell">
    <nav><a className="brand" href="/"><span className="shield">◇</span>OutcomeGuard</a><span className="sourcePill isFixture"><i />FAIL CLOSED</span></nav>
    <section className="explorerHero explorerMissing"><p className="eyebrow">RECEIPT EXPLORER</p><h1>Receipt not found.</h1><p>This build only resolves cryptographically verified evidence artifacts packaged with the release. Unknown digests are never guessed or treated as valid.</p><code className="digest">{digest}</code><a className="explorerBack" href="/">← Return to protection cockpit</a></section>
  </main>;

  const intent = receipt.intent.normalized;
  const plan = receipt.hedgePlan;
  const adverse = plan.scenarios.find((scenario) => scenario.adverseMovePct === -intent.adverseMovePct) ?? plan.scenarios[0];
  const policyCounts = receipt.policyEvaluation.reduce((counts, policy) => ({ ...counts, [policy.status]: counts[policy.status] + 1 }), { PASS: 0, WARN: 0, FAIL: 0 });
  const authorized = Boolean(receipt.authorization.approvedAt);
  const executed = receipt.execution.status !== "NOT_SUBMITTED";
  const settled = Boolean(receipt.settlement?.outcome);
  const redeemed = Boolean(receipt.redemption?.txHash);

  return <main className="explorerShell">
    <nav><a className="brand" href="/"><span className="shield">◇</span>OutcomeGuard</a><div className="navMeta"><span className="network"><span className="liveDot" /> Shannon · 50312</span><a className="ghost explorerNavLink" href="/">Protection cockpit</a></div></nav>

    <header className="explorerHero">
      <div><p className="eyebrow">INTENT-TO-SETTLEMENT RECEIPT</p><h1>Proof you can inspect,<br /><em>not a promise.</em></h1><p>This view independently parses the versioned schema and recomputes the RFC 8785 canonical SHA-256 digest shipped with the evidence artifact.</p></div>
      <div className={`verificationSeal ${verification.valid ? "isValid" : "isInvalid"}`}><span>{verification.valid ? "✓" : "×"}</span><div><small>INTEGRITY VERDICT</small><strong>{verification.valid ? "VERIFIED" : "TAMPERED"}</strong><p>{verification.valid ? "Schema valid · digest matches" : verification.errors.join(" · ")}</p></div></div>
    </header>

    <div className="explorerGrid">
      <section className="card explorerSummary">
        <div className="cardHead"><div><span>ORIGINAL INTENT</span><h2>Protection objective</h2></div><b className="stageBadge">{receipt.lifecycleStage.replace("_", " ")}</b></div>
        <blockquote>“{receipt.intent.originalText ?? "Structured intent only"}”</blockquote>
        <div className="receiptFacts"><div><small>Exposure</small><strong>{usd(intent.exposureUsd)} {intent.asset}</strong></div><div><small>Horizon</small><strong>{intent.horizonMinutes} minutes</strong></div><div><small>Adverse case</small><strong>−{intent.adverseMovePct}%</strong></div><div><small>Premium ceiling</small><strong>{usd(intent.maxPremium)}</strong></div></div>
      </section>

      <section className="card integrityCard">
        <p className="eyebrow">CANONICAL SEAL</p><code className="digest">{receipt.integrity.digest}</code>
        <dl><div><dt>Canonicalization</dt><dd>{receipt.integrity.canonicalization}</dd></div><div><dt>Digest</dt><dd>{receipt.integrity.digestAlgorithm.toUpperCase()}</dd></div><div><dt>Schema</dt><dd>{receipt.schemaVersion}</dd></div><div><dt>Receipt ID</dt><dd>{short(receipt.receiptId)}</dd></div></dl>
        <div className="explorerActions"><a href={`/api/receipts/${encodeURIComponent(receipt.integrity.digest)}?download=1`}>Download JSON</a><a href={`/api/receipts/${encodeURIComponent(receipt.integrity.digest)}`}>Open raw artifact</a></div>
      </section>

      <section className="card lifecycleCard">
        <div className="cardHead"><div><span>IMMUTABLE LINEAGE</span><h2>Lifecycle truth, at a glance</h2></div><small>Created {new Date(receipt.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</small></div>
        <div className="timeline explorerTimeline"><i className="done">Intent</i><i className="done">Plan</i><i className="done">Policy</i><i className={authorized ? "done" : ""}>Authorize</i><i className={executed ? "done" : ""}>Execution</i><i className={settled ? "done" : ""}>Settlement</i><i className={redeemed ? "done" : ""}>Claim</i></div>
        <p className="truthDisclosure"><strong>{receipt.execution.status.replace("_", " ")}</strong> — This artifact proves planning and policy evaluation only. It does not claim wallet authorization, a submitted transaction, a fill, settlement, or redemption.</p>
      </section>

      <section className="card mathCard">
        <div className="cardHead"><div><span>DETERMINISTIC HEDGE MATH</span><h2>What the protection changes</h2></div><b>{plan.normalizedShares.toFixed(3)} DOWN</b></div>
        <div className="mathEquation"><span>{usd(intent.exposureUsd)} exposure</span><i>→</i><span>{usd(plan.premiumUsd)} premium</span><i>→</i><span>{usd(plan.expectedNetPayoutIfDownUsd)} net protection</span></div>
        <div className="receiptFacts mathFacts"><div><small>Unhedged adverse P&amp;L</small><strong>{adverse ? usd(adverse.underlyingPnlUsd) : "—"}</strong></div><div><small>Hedged adverse P&amp;L</small><strong>{adverse ? usd(adverse.hedgedPnlUsd) : "—"}</strong></div><div><small>Protection ratio</small><strong>{adverse ? `${adverse.protectionRatioPct.toFixed(1)}%` : "—"}</strong></div><div><small>Worst executable price</small><strong>{plan.worstPrice.toFixed(3)}</strong></div></div>
        <p className="basisDisclosure">{plan.basisRiskWarning}</p>
      </section>

      <section className="card provenanceCard">
        <div className="cardHead"><div><span>MARKET PROVENANCE</span><h2>Bound to a specific Shannon snapshot</h2></div><span className={`sourcePill ${receipt.marketSnapshot.source === "live" ? "isLive" : "isFixture"}`}><i />{receipt.marketSnapshot.source.toUpperCase()}</span></div>
        <dl className="provenanceList"><div><dt>Market ID</dt><dd title={receipt.marketSnapshot.marketId}>{short(receipt.marketSnapshot.marketId)}</dd></div><div><dt>Pool</dt><dd title={receipt.marketSnapshot.poolAddress}>{short(receipt.marketSnapshot.poolAddress)}</dd></div><div><dt>Venue</dt><dd title={receipt.marketSnapshot.venueId}>{short(receipt.marketSnapshot.venueId)}</dd></div><div><dt>Onchain block</dt><dd>{receipt.marketSnapshot.blockNumber ?? "Unknown"}</dd></div><div><dt>Status</dt><dd>{receipt.marketSnapshot.status} · code {receipt.marketSnapshot.statusCode}</dd></div><div><dt>SDK</dt><dd>@somnia-chain/markets-sdk {receipt.marketSnapshot.sdkVersion}</dd></div><div><dt>Expiry</dt><dd>{new Date(receipt.marketSnapshot.expiry).toISOString()}</dd></div><div><dt>Settlement</dt><dd>{receipt.marketSnapshot.settlementReference}</dd></div></dl>
      </section>

      <section className="card policyEvidence">
        <div className="cardHead"><div><span>FAIL-CLOSED POLICY GATE</span><h2>{receipt.policyEvaluation.length} reproducible checks</h2></div><div className="policyTally"><b className="pass">{policyCounts.PASS} PASS</b><b className="warn">{policyCounts.WARN} WARN</b><b className="fail">{policyCounts.FAIL} FAIL</b></div></div>
        <p>Failures are evidence that execution remained blocked—not checks hidden from the judge.</p>
        <div className="explorerPolicies">{receipt.policyEvaluation.map((policy) => <details key={policy.policyId} open={policy.status === "FAIL"}><summary><b className={policy.status.toLowerCase()}>{policy.status}</b><span>{policy.policyId}</span></summary><p>{policy.reason}</p><code>observed: {JSON.stringify(policy.observed)} · limit: {JSON.stringify(policy.limit)}</code></details>)}</div>
      </section>

      <section className="card rawArtifact"><details><summary><span><small>RAW CANONICAL INPUT</small><strong>Inspect every sealed field</strong></span><b>Expand JSON +</b></summary><pre>{JSON.stringify(receipt, null, 2)}</pre></details></section>
    </div>
    <footer className="siteFooter"><span>OutcomeGuard · Testnet research software · Not financial advice</span><span>Any field change invalidates the digest.</span></footer>
  </main>;
}
