"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExecutionBundle, ExecutionMandate, HedgeIntent, HedgePlan, OutcomeGuardReceipt, PolicyResult, EventMarketSnapshot } from "@outcome-guard/schemas";
import { parseIntentLocally } from "@outcome-guard/shared";

type PlanResponse = { mode: "fixture" | "live"; market: EventMarketSnapshot; plan: HedgePlan; policies: PolicyResult[]; receipt: OutcomeGuardReceipt; authorizationChallenge?: { mandate: ExecutionMandate; mandateDigest: string; message: string } };
type LiveSnapshot = {
  market: { marketId: string; venueId: string; asset: "ETH" | "BTC"; intervalSec: number; expiry: number; status: number; statusName: string; question: string; collateralDecimals: number };
  book: { capturedAt: string; blockNumber?: string; yesBids: { priceRaw: string; quantityRaw: string }[]; yesAsks: { priceRaw: string; quantityRaw: string }[] };
  parameters: { tickSize: string; lotSize: string; minQuantity: string };
};
type LiveResponse = { source: "live" | "unavailable"; snapshots?: LiveSnapshot[]; error?: string };
type SettledReplay = { label: "VERIFIED_REPLAY"; capturedAt: string; blockNumber: string; market: { marketId: string; asset: string; intervalSec: number; expiry: number; question: string; oracleQuestionId: string }; terminalState: { status: string; winningOutcome: "YES" | "NO"; portfolioMeaning: "UP" | "DOWN" }; positionEvidence: { status: string; reason: string }; redemptionEvidence: { status: string; reason: string }; integrity: { digest: string }; verification: { valid: true; computedDigest: string } };
type EthereumProvider = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
declare global { interface Window { ethereum?: EthereumProvider } }

const rawDecimal = (value: string | undefined, decimals = 6) => {
  if (!value) return "—";
  const padded = value.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
};

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;

export default function Home() {
  const [asset, setAsset] = useState<"ETH" | "BTC">("ETH");
  const [exposure, setExposure] = useState(1000);
  const [horizon, setHorizon] = useState<15 | 60>(60);
  const [maxPremium, setMaxPremium] = useState(15);
  const [slippage, setSlippage] = useState(2);
  const [adverseMove, setAdverseMove] = useState(2);
  const [protection, setProtection] = useState(75);
  const [data, setData] = useState<PlanResponse>();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<string>();
  const [signature, setSignature] = useState<string>();
  const [executionBundle, setExecutionBundle] = useState<ExecutionBundle>();
  const [error, setError] = useState<string>();
  const [liveRead, setLiveRead] = useState<LiveResponse>();
  const [liveLoading, setLiveLoading] = useState(false);
  const [livePlanMarketId, setLivePlanMarketId] = useState<string>();
  const [showAllPolicies, setShowAllPolicies] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [settledReplay, setSettledReplay] = useState<SettledReplay>();
  const [intentText, setIntentText] = useState("Protect my $1,000 ETH exposure for the next hour against a 2% downside. Spend no more than 15 and accept 2% slippage with 75% protection.");
  const [parserNote, setParserNote] = useState("Deterministic local parser · no model API");

  const refreshLive = async () => {
    setLiveLoading(true);
    try {
      const response = await fetch("/api/markets", { cache: "no-store" });
      setLiveRead(await response.json() as LiveResponse);
    } catch (reason) {
      setLiveRead({ source: "unavailable", error: reason instanceof Error ? reason.message : String(reason) });
    } finally { setLiveLoading(false); }
  };

  useEffect(() => { void refreshLive(); void fetch("/api/replay").then((response) => response.json()).then((value) => setSettledReplay(value as SettledReplay)); }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset, exposureUsd: exposure, horizonMinutes: horizon, adverseMovePct: adverseMove, maxPremium, maxSlippagePct: slippage, targetProtectionPct: protection, ...(livePlanMarketId ? { liveMarketId: livePlanMarketId } : {}) }), signal: controller.signal })
      .then(async (response) => { const json = await response.json() as PlanResponse & { error?: string }; if (!response.ok) throw new Error(json.error ?? "Plan failed"); return json; })
      .then((json) => { setData(json); setError(undefined); setSignature(undefined); setExecutionBundle(undefined); })
      .catch((reason: unknown) => { if ((reason as { name?: string }).name !== "AbortError") setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [asset, exposure, horizon, maxPremium, slippage, adverseMove, protection, livePlanMarketId]);

  const failures = useMemo(() => data?.policies.filter((p) => p.status === "FAIL") ?? [], [data]);
  const passes = useMemo(() => data?.policies.filter((p) => p.status === "PASS") ?? [], [data]);
  const authorizableFailures = useMemo(() => failures.filter((policy) => !["premium.total-risk", "wallet.gas", "authorization.human"].includes(policy.policyId)), [failures]);
  const liveMarket = useMemo(() => liveRead?.snapshots?.find(({ market }) => market.asset === asset && market.intervalSec === horizon * 60) ?? liveRead?.snapshots?.find(({ market }) => market.asset === asset), [liveRead, asset, horizon]);
  const connectWallet = async () => {
    if (!window.ethereum) { setError("No injected wallet found. Preview remains available; install a wallet to connect."); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts[0]) throw new Error("Wallet returned no account");
      setWallet(accounts[0]); setError(undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const authorize = async () => {
    if (!data) return;
    if (data.mode !== "live") { setError("Derive a fresh live plan before signing an exact execution mandate."); return; }
    if (!data.authorizationChallenge) { setError("The live preview has no configured execution signer. Set AGENT_SIGNER_ADDRESS and refresh before authorization."); return; }
    if (authorizableFailures.length) { setError(`${authorizableFailures.length} market or plan policies must pass before intent signing.`); return; }
    if (!window.ethereum) { setError("No injected wallet found. Preview remains available; install a wallet for authorization."); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const account = accounts[0];
      if (!account) throw new Error("Wallet returned no account");
      const chain = await window.ethereum.request({ method: "eth_chainId" }) as string;
      if (Number.parseInt(chain, 16) !== 50312) throw new Error("Switch the wallet to Somnia Shannon (chain 50312) before authorizing.");
      const { mandate, message } = data.authorizationChallenge;
      const signed = await window.ethereum.request({ method: "personal_sign", params: [message, account] }) as string;
      const response = await fetch("/api/authorize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ receipt: data.receipt, mandate, signature: signed, signer: account }) });
      const authorized = await response.json() as { authorizedReceipt?: OutcomeGuardReceipt; executionBundle?: ExecutionBundle; error?: string };
      if (!response.ok || !authorized.authorizedReceipt || !authorized.executionBundle) throw new Error(authorized.error ?? "Authorization verification failed");
      setData({ ...data, receipt: authorized.authorizedReceipt, policies: authorized.authorizedReceipt.policyEvaluation });
      setWallet(account); setSignature(signed); setExecutionBundle(authorized.executionBundle); setError(undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const downloadBundle = () => {
    if (!executionBundle) return;
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(executionBundle, null, 2)}\n`], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `outcomeguard-${executionBundle.authorizedReceipt.integrity.digest.slice(2, 14)}.json`; anchor.click(); URL.revokeObjectURL(url);
  };
  const downloadReceipt = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(data.receipt, null, 2)}\n`], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${data.receipt.integrity.digest}.json`; anchor.click(); URL.revokeObjectURL(url);
  };
  const copyDigest = async () => { if (data) await navigator.clipboard.writeText(data.receipt.integrity.digest); };
  const applyNaturalIntent = () => {
    try {
      const fallback: HedgeIntent = { asset, exposureUsd: exposure, horizonMinutes: horizon, adverseMovePct: adverseMove, maxPremium, maxSlippagePct: slippage, targetProtectionPct: protection };
      const parsed = parseIntentLocally(intentText, fallback);
      setAsset(parsed.intent.asset); setExposure(parsed.intent.exposureUsd); setHorizon(parsed.intent.horizonMinutes); setAdverseMove(parsed.intent.adverseMovePct); setMaxPremium(parsed.intent.maxPremium); setSlippage(parsed.intent.maxSlippagePct); setProtection(parsed.intent.targetProtectionPct);
      setLivePlanMarketId(undefined); setSignature(undefined); setExecutionBundle(undefined);
      setParserNote(parsed.extractedFields.length ? `${parsed.extractedFields.length} fields applied · schema validated · local fallback` : parsed.warnings[0] ?? "No supported values found");
      setError(undefined);
    } catch (reason) { setParserNote("Intent rejected"); setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const scenarioMax = Math.max(1, ...(data?.plan.scenarios.map((scenario) => Math.max(Math.abs(scenario.underlyingPnlUsd), Math.abs(scenario.hedgedPnlUsd))) ?? [1]));
  const selectedScenario = data?.plan.scenarios.find((scenario) => scenario.adverseMovePct === -adverseMove) ?? data?.plan.scenarios[0];
  const bookMax = Math.max(1, ...(data ? [...data.market.book.yesBids, ...data.market.book.yesAsks].map((level) => Number(level.size)) : [1]));

  return <main>
    <a className="skipLink" href="#command-center">Skip to protection command center</a>
    <nav><a className="brand" href="#top" aria-label="OutcomeGuard home"><span className="shield">◇</span> OutcomeGuard</a><div className="navMeta"><span className={`sourcePill ${data?.mode === "live" ? "isLive" : "isFixture"}`}><i />{data?.mode === "live" ? "LIVE-DERIVED" : "FIXTURE"}</span><span className="network">Shannon · 50312</span><button className="ghost" onClick={() => void connectWallet()}>{wallet ? short(wallet) : "Connect wallet"}</button></div></nav>
    <header id="top" className="hero">
      <div><p className="eyebrow">PORTFOLIO-AWARE ROLLING PROTECTION</p><h1>Turn a downside concern into <em>bounded, verifiable protection.</em></h1><p className="lede">OutcomeGuard derives a short-duration hedge from your existing exposure, applies one deterministic policy contract, and preserves a linked intent-to-settlement trail.</p></div>
      <div className={`mode ${data?.mode === "live" ? "modeLive" : "modeFixture"}`}><span>JUDGE DEMO · SOURCE STATE</span><strong>{data?.mode === "live" ? "Live-derived plan" : "Deterministic fallback"}</strong><small>{data?.mode === "live" ? "Indexer discovery + chain-reconciled status and parameters" : "Clearly labeled fixture · no transaction simulation"}</small></div>
    </header>

    <section id="command-center" className="workspace" aria-label="Protection command center">
      <aside className="composer card">
        <div className="step"><b>01</b><span>Exposure</span></div>
        <div className="segmented"><button aria-pressed={asset === "ETH"} className={asset === "ETH" ? "active" : ""} onClick={() => setAsset("ETH")}>ETH</button><button aria-pressed={asset === "BTC"} className={asset === "BTC" ? "active" : ""} onClick={() => setAsset("BTC")}>BTC</button></div>
        <label>Exposure value <span>Manual demo override</span><div className="input"><i>$</i><input aria-label="Exposure value" type="number" min="1" value={exposure} onChange={(e) => setExposure(Number(e.target.value))} /></div></label>
        <div className="step"><b>02</b><span>Protection intent</span></div>
        <label className="intentParser">Natural-language intent <span>Optional</span><textarea aria-label="Natural-language protection intent" maxLength={1000} value={intentText} onChange={(event) => setIntentText(event.target.value)} /><button type="button" onClick={applyNaturalIntent}>Apply to controls</button><small aria-live="polite">{parserNote}</small></label>
        <label>Horizon<div className="segmented"><button aria-pressed={horizon === 15} className={horizon === 15 ? "active" : ""} onClick={() => setHorizon(15)}>15 minutes</button><button aria-pressed={horizon === 60} className={horizon === 60 ? "active" : ""} onClick={() => setHorizon(60)}>1 hour</button></div></label>
        <label>Maximum premium <span>{data?.market.collateral.symbol ?? "collateral"}</span><input aria-label="Maximum premium" type="range" min="1" max="50" value={maxPremium} onChange={(e) => setMaxPremium(Number(e.target.value))} /><output>{money(maxPremium)}</output></label>
        <div className="twocol"><label>Scenario<input aria-label="Adverse move scenario" type="number" min="0.1" max="25" step="0.1" value={adverseMove} onChange={(e) => setAdverseMove(Number(e.target.value))} /><small>% down</small></label><label>Slippage<input aria-label="Slippage" type="number" min="0" max="3" step="0.1" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} /><small>% max</small></label><label>Protection<input aria-label="Protection target" type="number" min="1" max="100" value={protection} onChange={(e) => setProtection(Number(e.target.value))} /><small>% target</small></label></div>
        <div className="intent">Structured truth: protect {money(exposure)} of {asset} against a {adverseMove}% downside move for {horizon === 60 ? "one hour" : "15 minutes"}; premium ≤ {money(maxPremium)}, slippage ≤ {slippage}%, target {protection}%.</div>
      </aside>

      <div className="results">
        {error && <div role="alert" className="alert">{error}</div>}
        {loading && <div className="recomputeBanner" role="status">Recomputing the protection envelope… authorization is locked until the new snapshot is sealed.</div>}
        <section className={`summaryRail ${loading ? "isLoading" : ""}`} aria-live="polite" aria-busy={loading}>
          <div><small>Exposure</small><strong>{money(exposure)}</strong><span>{asset} · {horizon}m</span></div>
          <div><small>Scenario loss</small><strong>{selectedScenario ? money(selectedScenario.underlyingPnlUsd) : "—"}</strong><span>{adverseMove}% adverse move</span></div>
          <div><small>Premium at risk</small><strong>{data ? money(data.plan.premiumUsd) : "—"}</strong><span>capped at {money(maxPremium)}</span></div>
          <div className="protectedMetric"><small>Conditional net P&amp;L</small><strong>{selectedScenario ? money(selectedScenario.hedgedPnlUsd) : "—"}</strong><span>{selectedScenario?.protectionRatioPct.toFixed(0) ?? "—"}% scenario protection</span></div>
          <div className={`verdict ${!data || loading ? "pending" : failures.length ? "blocked" : "ready"}`}><small>Policy seal</small><strong>{!data || loading ? "COMPUTING" : failures.length ? "BLOCKED" : "READY"}</strong><span>{data ? `${passes.length} pass · ${failures.length} fail` : "Awaiting deterministic evaluation"}</span></div>
        </section>
        <div className="evidenceGrid">
        <section className="card liveEvidence">
          <div className="cardHead"><div><span>LIVE READ EVIDENCE · SEPARATE UNTIL SELECTED</span><h2>{liveMarket?.market.question ?? `${asset} DreamDEX market`}</h2></div><div className="liveActions"><button className="ghost" onClick={() => void refreshLive()} disabled={liveLoading}>{liveLoading ? "Reading…" : "Refresh live"}</button>{liveMarket && <button className="useLive" onClick={() => setLivePlanMarketId(livePlanMarketId ? undefined : liveMarket.market.marketId)}>{livePlanMarketId ? "Use fixture plan" : "Derive live plan"}</button>}</div></div>
          {liveMarket ? <>
            <div className="marketStats"><div><small>On-chain status</small><strong>{liveMarket.market.statusName} · {liveMarket.market.status}</strong></div><div><small>YES best bid</small><strong>{rawDecimal(liveMarket.book.yesBids[0]?.priceRaw, liveMarket.market.collateralDecimals)}</strong></div><div><small>YES best ask</small><strong>{rawDecimal(liveMarket.book.yesAsks[0]?.priceRaw, liveMarket.market.collateralDecimals)}</strong></div><div><small>Expires</small><strong>{new Date(liveMarket.market.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></div></div>
            <div className="liveFacts"><span><small>Market ID</small><code>{short(liveMarket.market.marketId)}</code></span><span><small>Venue</small><code>{short(liveMarket.market.venueId)}</code></span><span><small>Tick / lot / min</small><code>{rawDecimal(liveMarket.parameters.tickSize, liveMarket.market.collateralDecimals)} / {rawDecimal(liveMarket.parameters.lotSize, liveMarket.market.collateralDecimals)} / {rawDecimal(liveMarket.parameters.minQuantity, liveMarket.market.collateralDecimals)}</code></span><span><small>Block / freshness</small><code>{liveMarket.book.blockNumber ?? "unknown"} / {Math.max(0, Date.now() - Date.parse(liveMarket.book.capturedAt))} ms</code></span></div>
            <p className="modeDisclosure">Discovery and venue metadata come from the scoped DreamDEX indexer; status and book parameters are reconciled through the Shannon SDK. {livePlanMarketId ? "The plan below is recomputed server-side from a fresh read of this market ID." : "This read remains separate from the labeled fixture plan until “Derive live plan” is selected."}</p>
          </> : <p className="modeDisclosure">{liveLoading ? "Reading the explicit DreamDEX venue on Shannon…" : `Live read unavailable: ${liveRead?.error ?? "no matching market"}. The fixture fallback remains labeled and read-only.`}</p>}
        </section>
        <section className="card marketCard"><div className="cardHead"><div><span>{data?.mode === "live" ? "LIVE MARKET" : "FIXTURE MARKET"}</span><h2>{asset} closes below strike?</h2></div><div className="fresh"><span /> {data?.market.freshnessMs ?? "—"} ms</div></div>
          <div className="marketStats"><div><small>DOWN ask</small><strong>{data ? `${(data.plan.averageExecutablePrice * 100).toFixed(1)}¢` : "—"}</strong></div><div><small>Spread</small><strong>{data ? `${((Number(data.market.book.yesAsks[0]?.price) - Number(data.market.book.yesBids[0]?.price)) * 100).toFixed(1)}¢` : "—"}</strong></div><div><small>Visible depth</small><strong>{data ? `${data.market.book.yesBids.reduce((n, l) => n + Number(l.size), 0)} shares` : "—"}</strong></div><div><small>Expires</small><strong>{horizon} min</strong></div></div>
          <div className="book"><div><span>DOWN asks · synthetic from YES bids</span>{data?.market.book.yesBids.slice(0, 3).map((level) => <i key={level.price} style={{ width: `${Number(level.size) / bookMax * 100}%` }}>{(1 - Number(level.price)).toFixed(3)} · {level.size}</i>)}</div><div><span>UP asks · YES asks</span>{data?.market.book.yesAsks.slice(0, 3).map((level) => <i className="ask" key={level.price} style={{ width: `${Number(level.size) / bookMax * 100}%` }}>{level.price} · {level.size}</i>)}</div></div>
          <footer><span>Settlement</span>{data?.market.settlementReference}<code>{data ? short(data.market.marketId) : "—"}</code></footer>
        </section>
        </div>

        <section className="card scenarios"><div className="cardHead"><div><span>PROTECTION ENVELOPE · CONDITIONAL SCENARIOS</span><h2>Scenario loss reduced under the assumed contract outcome</h2></div><div className="premium"><small>Premium at risk</small><strong>{data ? money(data.plan.premiumUsd) : "—"}</strong></div></div>
          <div className="chart" aria-label="Diverging scenario profit and loss chart">{data?.plan.scenarios.map((scenario) => <div className={`scenario ${scenario.adverseMovePct === selectedScenario?.adverseMovePct ? "selected" : ""}`} key={scenario.adverseMovePct}><label>{scenario.adverseMovePct > 0 ? "+" : ""}{scenario.adverseMovePct}% <b>{scenario.contractOutcome}</b></label><div className="diverging"><span className="zero" /><i aria-label={`Unhedged ${money(scenario.underlyingPnlUsd)}`} className={`before ${scenario.underlyingPnlUsd < 0 ? "negative" : "positive"}`} style={{ width: `${Math.abs(scenario.underlyingPnlUsd) / scenarioMax * 50}%` }} /><i aria-label={`Protected ${money(scenario.hedgedPnlUsd)}`} className={`after ${scenario.hedgedPnlUsd < 0 ? "negative" : "positive"}`} style={{ width: `${Math.abs(scenario.hedgedPnlUsd) / scenarioMax * 50}%` }} /></div><strong>{money(scenario.hedgedPnlUsd)}</strong></div>)}</div>
          <div className="legend"><span><i className="before" /> Unhedged P&amp;L</span><span><i className="after" /> With protection</span></div>
          <div className="outcomeFacts"><div><small>Payout if DOWN</small><strong>{data ? money(data.plan.normalizedShares) : "—"}</strong></div><div><small>Net DOWN payout</small><strong>{data ? money(data.plan.expectedNetPayoutIfDownUsd) : "—"}</strong></div><div><small>Worst premium loss</small><strong>{data ? money(data.plan.premiumUsd) : "—"}</strong></div><div><small>Break-even</small><strong>Spot loss &gt; net hedge benefit</strong></div></div>
          <div className="riskNote"><b>Basis risk is real.</b> These are conditional scenarios, not forecasts. Binary Event Contracts pay by their settlement rule—not by your exact spot loss. Strike, timing, oracle, liquidity and fees can create mismatch.</div>
        </section>

        <section className="card gate"><div className="cardHead"><div><span>POLICY GATE</span><h2>{failures.length ? `${failures.length} checks block execution` : "Deterministic checks are clear"}</h2></div><b className={failures.length ? "fail" : "pass"}>{failures.length ? "BLOCKED" : "READY"}</b></div>
          <div className="policySummary"><span><b>{passes.length}</b> passed</span><span className={failures.length ? "hasFailures" : ""}><b>{failures.length}</b> blocking</span><button className="textButton" onClick={() => setShowAllPolicies((current) => !current)} aria-expanded={showAllPolicies}>{showAllPolicies ? "Collapse evidence" : `Inspect all ${data?.policies.length ?? 0} checks`}</button></div>
          <div className="policyGrid">{(showAllPolicies ? data?.policies : failures)?.map((policy) => <details key={policy.policyId} open={policy.status === "FAIL"}><summary><b className={policy.status.toLowerCase()}>{policy.status === "PASS" ? "✓ PASS" : policy.status === "WARN" ? "! WARN" : "× FAIL"}</b><span>{policy.policyId}</span></summary><small>{policy.reason}</small><dl><div><dt>Observed</dt><dd>{JSON.stringify(policy.observed)}</dd></div><div><dt>Limit</dt><dd>{JSON.stringify(policy.limit)}</dd></div></dl></details>)}</div>
        </section>

        <section className="authorize card"><div><span>EXACT EXECUTION MANDATE · NO TRANSACTION</span><h2>Buy {data?.plan.normalizedShares.toFixed(3) ?? "—"} DOWN shares · IOC</h2><div className="orderReview"><span><small>Chain</small>Shannon · 50312</span><span><small>Maximum premium</small>{data?.authorizationChallenge?.mandate.maximumPremiumRaw ?? "—"} raw</span><span><small>NO price / quantity</small>{data?.authorizationChallenge ? `${data.authorizationChallenge.mandate.outcomePriceRaw} / ${data.authorizationChallenge.mandate.quantityRaw}` : "—"}</span><span><small>Market</small>{data ? short(data.market.marketId) : "—"}</span><span><small>Order expiry</small>{data?.authorizationChallenge ? new Date(Number(BigInt(data.authorizationChallenge.mandate.orderExpiryNs) / 1_000_000n)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</span><span><small>Mandate seal</small>{data?.authorizationChallenge ? short(data.authorizationChallenge.mandateDigest) : "Not issued"}</span></div><p>Signing binds the exact raw IOC, live snapshot, dedicated execution signer, deadline and receipt. It does not submit a transaction. The worker must independently recover this signature and rerun fresh fail-closed checks.</p></div><div className="authorizationActions"><button onClick={authorize} disabled={loading || data?.mode !== "live" || !data?.authorizationChallenge || authorizableFailures.length > 0}>{signature ? "Exact mandate signed ✓" : data?.mode !== "live" ? "Derive live plan first" : !data?.authorizationChallenge ? "Worker signer not configured" : "Review & sign exact mandate"}</button>{executionBundle && <button className="secondaryAction" onClick={downloadBundle}>Download signed bundle</button>}</div></section>

        <section className="card receipt"><div className="cardHead"><div><span>VERIFIABLE RECEIPT · POLICY SEAL</span><h2>Intent → snapshot → math → policy → authorization → chain</h2></div><b>{signature ? "AUTHORIZED" : data ? "PRE-EXECUTION" : "SEALING"}</b></div><div className="timeline"><i className={data ? "done" : ""}>Intent</i><i className={data ? "done" : ""}>Plan</i><i className={data ? "done" : ""}>Policy</i><i className={signature ? "done" : ""}>Authorize</i><i>Execution</i><i>Settlement</i><i>Claim</i></div><div className="digestRow"><code className="digest">{data?.receipt.integrity.digest ?? "Computing deterministic receipt…"}</code><span className={`verifiedBadge ${data ? "" : "pending"}`}>{data ? "✓ Verified locally" : "Verification pending"}</span></div><div className="receiptActions"><button className="textButton" onClick={() => void copyDigest()} disabled={!data}>Copy digest</button><button className="textButton" onClick={downloadReceipt} disabled={!data}>Download JSON</button><button className="textButton" onClick={() => setShowReceipt((current) => !current)} aria-expanded={showReceipt} disabled={!data}>{showReceipt ? "Close raw view" : "Inspect raw JSON"}</button></div>{showReceipt && <pre className="rawReceipt">{JSON.stringify(data?.receipt, null, 2)}</pre>}<p>Verification recomputes canonical SHA-256. Any changed field breaks the seal. Later lifecycle records link to this digest instead of rewriting history.</p></section>
        <section className="card settledReplay"><div className="cardHead"><div><span>VERIFIED REPLAY · HISTORICAL VENUE LIFECYCLE</span><h2>{settledReplay?.market.question ?? "Loading finalized DreamDEX evidence…"}</h2></div><b>{settledReplay?.terminalState.status ?? "READING"}</b></div>{settledReplay && <><div className="replayFlow"><div><small>Finalized market</small><strong>{short(settledReplay.market.marketId)}</strong><span>{settledReplay.market.asset} · {settledReplay.market.intervalSec / 60}m</span></div><i>→</i><div><small>On-chain terminal state</small><strong>{settledReplay.terminalState.status}</strong><span>Block {settledReplay.blockNumber}</span></div><i>→</i><div className="replayOutcome"><small>Winning outcome</small><strong>{settledReplay.terminalState.winningOutcome} / {settledReplay.terminalState.portfolioMeaning}</strong><span>Oracle question {settledReplay.market.oracleQuestionId}</span></div><i>→</i><div className="notClaimed"><small>Position / claim</small><strong>NOT CLAIMED</strong><span>No fabricated ownership or redemption</span></div></div><div className="replaySeal"><span>✓ Evidence digest verified</span><code>{settledReplay.integrity.digest}</code></div><p><b>Replay boundary:</b> finalized discovery and terminal state are verified venue evidence. This is not the live preview above, not an OutcomeGuard execution, and not proof that the demo wallet owned or redeemed this position.</p></>}</section>
      </div>
    </section>
    <footer className="siteFooter"><span>OutcomeGuard · Shannon testnet prototype · not financial advice</span><span>Event Contracts are nonlinear protection, not a perfect hedge.</span></footer>
  </main>;
}
