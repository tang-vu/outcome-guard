export function GET() {
  return Response.json({ ok: true, service: "outcome-guard-web", network: "somnia-shannon", chainId: 50312, mode: process.env.NEXT_PUBLIC_FIXTURE_MODE === "false" ? "live" : "fixture-fallback", timestamp: new Date().toISOString() });
}
