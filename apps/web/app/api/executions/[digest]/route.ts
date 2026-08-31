import { readExecutionStatus } from "../../../../lib/execution-queue";

export async function GET(_request: Request, context: { params: Promise<{ digest: string }> }) {
  try {
    const { digest } = await context.params;
    if (!/^0x[0-9a-fA-F]{64}$/.test(digest)) return Response.json({ error: "Invalid execution identifier" }, { status: 400 });
    const status = await readExecutionStatus(digest);
    if (!status) return Response.json({ error: "Execution not found" }, { status: 404 });
    return Response.json(status, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
