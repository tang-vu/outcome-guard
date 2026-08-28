"use client";

import { useEffect, useMemo, useState } from "react";
import type { HedgePlan, OutcomeGuardReceipt, PolicyResult, EventMarketSnapshot } from "@outcome-guard/schemas";
import { authorizationMessage } from "@outcome-guard/shared";

type PlanResponse = { mode: "fixture" | "live"; market: EventMarketSnapshot; plan: HedgePlan; policies: PolicyResult[]; receipt: OutcomeGuardReceipt };
type LiveSnapshot = {
  market: { marketId: string; venueId: string; asset: "ETH" | "BTC"; intervalSec: number; expiry: number; status: number; statusName: string; question: string; collateralDecimals: number };
  book: { capturedAt: string; blockNumber?: string; yesBids: { priceRaw: string; quantityRaw: string }[]; yesAsks: { priceRaw: string; quantityRaw: string }[] };
  parameters: { tickSize: string; lotSize: string; minQuantity: string };
};
type LiveResponse = { source: "live" | "unavailable"; snapshots?: LiveSnapshot[]; error?: string };
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
  const [error, setError] = useState<string>();
  const [liveRead, setLiveRead] = useState<LiveResponse>();
  const [liveLoading, setLiveLoading] = useState(false);
  const [livePlanMarketId, setLivePlanMarketId] = useState<string>();

  const refreshLive = async () => {
    setLiveLoading(true);
    try {
      const response = await fetch("/api/markets", { cache: "no-store" });
      setLiveRead(await response.json() as LiveResponse);
    } catch (reason) {
      setLiveRead({ source: "unavailable", error: reason instanceof Error ? reason.message : String(reason) });
    } finally { setLiveLoading(false); }
  };

  useEffect(() => { void refreshLive(); }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset, exposureUsd: exposure, horizonMinutes: horizon, adverseMovePct: adverseMove, maxPremium, maxSlippagePct: slippage, targetProtectionPct: protection, ...(livePlanMarketId ? { liveMarketId: livePlanMarketId } : {}) }), signal: controller.signal })
      .then(async (response) => { const json = await response.json() as PlanResponse & { error?: string }; if (!response.ok) throw new Error(json.error ?? "Plan failed"); return json; })
      .then((json) => { setData(json); setError(undefined); setSignature(undefined); })
      .catch((reason: unknown) => { if ((reason as { name?: string }).name !== "AbortError") setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [asset, exposure, horizon, maxPremium, slippage, adverseMove, protection, livePlanMarketId]);

  const failures = useMemo(() => data?.policies.filter((p) => p.status === "FAIL") ?? [], [data]);
  const liveMarket = useMemo(() => liveRead?.snapshots?.find(({ market }) => market.asset === asset && market.intervalSec === horizon * 60) ?? liveRead?.snapshots?.find(({ market }) => market.asset === asset), [liveRead, asset, horizon]);
  const authorize = async () => {
    if (!data) return;
    if (!window.ethereum) { setError("No injected wallet found. Preview remains available; install a wallet for authorization."); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const account = accounts[0];
      if (!account) throw new Error("Wallet returned no account");
      const chain = await window.ethereum.request({ method: "eth_chainId" }) as string;
      if (Number.parseInt(chain, 16) !== 50312) throw new Error("Switch the wallet to Somnia Shannon (chain 50312) before authorizing.");
      const message = authorizationMessage({ receiptDigest: data.receipt.integrity.digest, receiptId: data.receipt.receiptId, receiptCreatedAt: data.receipt.createdAt, venueId: data.market.venueId, marketId: data.market.marketId, snapshotAt: data.market.capturedAt, marketExpiry: data.market.expiry, size: data.plan.normalizedShares, worstPrice: data.plan.worstPrice, maximumPremium: maxPremium, collateralSymbol: data.market.collateral.symbol });
      const signed = await window.ethereum.request({ method: "personal_sign", params: [message, account] }) as string;
      const response = await fetch("/api/authorize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ receipt: data.receipt, message, signature: signed, signer: account }) });
      const authorized = await response.json() as { authorizedReceipt?: OutcomeGuardReceipt; error?: string };
      if (!response.ok || !authorized.authorizedReceipt) throw new Error(authorized.error ?? "Authorization verification failed");
      setData({ ...data, receipt: authorized.authorizedReceipt, policies: authorized.authorizedReceipt.policyEvaluation });
      setWallet(account); setSignature(signed); setError(undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const scenarioMax = Math.max(1, ...(data?.plan.scenarios.map((scenario) => Math.max(Math.abs(scenario.underlyingPnlUsd), Math.abs(scenario.hedgedPnlUsd))) ?? [1]));

  return <main>
    <nav><a className="brand" href="#top" aria-label="OutcomeGuard home"><span className="shield">◇</span> OutcomeGuard</a><div className="navMeta"><span className="liveDot" /> Shannon · 50312 <button className="ghost" onClick={authorize}>{wallet ? short(wallet) : "Connect wallet"}</button></div></nav>
    <header id="top" className="hero">
      <div><p className="eyebrow">PORTFOLIO-AWARE ROLLING PROTECTION</p><h1>Turn a downside concern into <em>bounded, verifiable protection.</em></h1><p className="lede">OutcomeGuard derives a short-duration hedge from your existing exposure, applies one deterministic policy contract, and preserves a linked intent-to-settlement trail.</p></div>
      <div className="mode"><span>JUDGE DEMO</span><strong>{data?.mode === "live" ? "Live Shannon" : "Deterministic fallback"}</strong><small>{data?.mode === "live" ? "Chain + indexer verified" : "Clearly labeled fixture; no simulated transaction"}</small></div>
    </header>

    <section className="workspace" aria-label="Hedge composer">
      <aside className="composer card">
        <div className="step"><b>01</b><span>Exposure</span></div>
        <div className="segmented"><button className={asset === "ETH" ? "active" : ""} onClick={() => setAsset("ETH")}>ETH</button><button className={asset === "BTC" ? "active" : ""} onClick={() => setAsset("BTC")}>BTC</button></div>
        <label>Exposure value <span>Manual demo override</span><div className="input"><i>$</i><input aria-label="Exposure value" type="number" min="1" value={exposure} onChange={(e) => setExposure(Number(e.target.value))} /></div></label>
        <div className="step"><b>02</b><span>Protection intent</span></div>
        <label>Horizon<div className="segmented"><button className={horizon === 15 ? "active" : ""} onClick={() => setHorizon(15)}>15 minutes</button><button className={horizon === 60 ? "active" : ""} onClick={() => setHorizon(60)}>1 hour</button></div></label>
        <label>Maximum premium <span>{data?.market.collateral.symbol ?? "collateral"}</span><input type="range" min="1" max="50" value={maxPremium} onChange={(e) => setMaxPremium(Number(e.target.value))} /><output>{money(maxPremium)}</output></label>
        <div className="twocol"><label>Scenario<input aria-label="Adverse move scenario" type="number" min="0.1" max="25" step="0.1" value={adverseMove} onChange={(e) => setAdverseMove(Number(e.target.value))} /><small>% down</small></label><label>Slippage<input aria-label="Slippage" type="number" min="0" max="3" step="0.1" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} /><small>% max</small></label><label>Protection<input aria-label="Protection target" type="number" min="1" max="100" value={protection} onChange={(e) => setProtection(Number(e.target.value))} /><small>% target</small></label></div>
        <div className="intent">“Protect my {money(exposure)} {asset} exposure against a {adverseMove}% downside move for the next {horizon === 60 ? "hour" : "15 minutes"}. Spend no more than {money(maxPremium)} and accept at most {slippage}% slippage.”</div>
      </aside>

      <div className="results">
        {error && <div role="alert" className="alert">{error}</div>}
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
          <div className="book"><div><span>YES bids</span>{data?.market.book.yesBids.slice(0, 3).map((l) => <i key={l.price} style={{ width: `${Number(l.size) / 1.1}%` }}>{l.price} · {l.size}</i>)}</div><div><span>YES asks</span>{data?.market.book.yesAsks.slice(0, 3).map((l) => <i className="ask" key={l.price} style={{ width: `${Number(l.size)}%` }}>{l.price} · {l.size}</i>)}</div></div>
          <footer><span>Settlement</span>{data?.market.settlementReference}<code>{data ? short(data.market.marketId) : "—"}</code></footer>
        </section>

        <section className="card scenarios"><div className="cardHead"><div><span>BEFORE / AFTER</span><h2>Loss becomes bounded—not erased</h2></div><div className="premium"><small>Premium at risk</small><strong>{data ? money(data.plan.premiumUsd) : "—"}</strong></div></div>
          <div className="chart">{data?.plan.scenarios.map((scenario) => <div className="scenario" key={scenario.adverseMovePct}><label title={`Conditional contract outcome: ${scenario.contractOutcome}`}>{scenario.adverseMovePct > 0 ? "+" : ""}{scenario.adverseMovePct}% · {scenario.contractOutcome}</label><div><i className="before" style={{ width: `${Math.abs(scenario.underlyingPnlUsd) / scenarioMax * 100}%` }} /><i className="after" style={{ width: `${Math.abs(scenario.hedgedPnlUsd) / scenarioMax * 100}%` }} /></div><strong>{money(scenario.hedgedPnlUsd)}</strong></div>)}</div>
          <div className="legend"><span><i className="before" /> Unhedged P&amp;L</span><span><i className="after" /> With protection</span></div>
          <div className="riskNote"><b>Basis risk is real.</b> Binary Event Contracts pay by settlement outcome—not by your exact spot loss. Strike, timing, oracle, liquidity and fees can create mismatch.</div>
        </section>

        <section className="card gate"><div className="cardHead"><div><span>POLICY GATE</span><h2>{failures.length ? `${failures.length} checks block execution` : "Deterministic checks are clear"}</h2></div><b className={failures.length ? "fail" : "pass"}>{failures.length ? "BLOCKED" : "READY"}</b></div>
          <div className="policyGrid">{data?.policies.map((policy) => <div key={policy.policyId}><b className={policy.status.toLowerCase()}>{policy.status}</b><span>{policy.policyId}</span><small>{policy.reason}</small></div>)}</div>
        </section>

        <section className="authorize card"><div><span>INTENT-SIGNATURE PROTOTYPE</span><h2>Buy {data?.plan.normalizedShares.toFixed(3) ?? "—"} DOWN shares · IOC</h2><p>Signing binds this fixture snapshot, market, size, price, expiry and {money(maxPremium)} maximum premium. It does not submit a transaction; every failed policy must be cleared on fresh live data first.</p></div><button onClick={authorize} disabled={loading}>{signature ? "Intent signed ✓" : "Sign intent (no execution)"}</button></section>

        <section className="card receipt"><div className="cardHead"><div><span>VERIFIABLE RECEIPT</span><h2>Intent → policy → authorization → chain</h2></div><b>{signature ? "AUTHORIZED" : "PRE-EXECUTION"}</b></div><div className="timeline"><i className="done">Intent</i><i className="done">Plan</i><i className="done">Policy</i><i className={signature ? "done" : ""}>Authorize</i><i>Execution</i><i>Settlement</i><i>Claim</i></div><code className="digest">{data?.receipt.integrity.digest ?? "Computing deterministic receipt…"}</code><p>Verification recomputes the canonical SHA-256 digest. Any changed field fails. Later lifecycle records link to this digest instead of rewriting history.</p></section>
      </div>
    </section>
    <footer className="siteFooter"><span>OutcomeGuard · Shannon testnet prototype · not financial advice</span><span>Event Contracts are nonlinear protection, not a perfect hedge.</span></footer>
  </main>;
}
