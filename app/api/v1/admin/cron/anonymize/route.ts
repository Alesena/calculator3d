import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listQuotesCreatedBefore, patchQuote } from "@/lib/server/quotesStore";
import type { QuoteStatus } from "@/lib/pricing/public";

// GET /api/v1/admin/cron/anonymize — Vercel Cron, una vez por día (vercel.json).
// Borra los datos personales de los pedidos que no se concretaron a los 90 días
// (spec A5 / política de privacidad). Los montos quedan para el control de precisión.
// Vercel manda Authorization: Bearer <CRON_SECRET>.

const RETENTION_DAYS = 90;
const NOT_CONCRETED: QuoteStatus[] = ["estimated", "requested", "needs_acceptance", "cancelled", "expired"];

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "unauthorized", message: "No autorizado." } }, { status: 401 });
  }

  const before = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
  const old = await listQuotesCreatedBefore(before);
  const targets = old.filter((q) => NOT_CONCRETED.includes(q.status) && q.customer && !q.anonymized_at);

  const now = new Date().toISOString();
  for (const q of targets) {
    await patchQuote(q.id, { customer: null, anonymized_at: now });
  }
  return NextResponse.json({ anonymized: targets.length });
}
