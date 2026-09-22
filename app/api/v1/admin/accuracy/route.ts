import type { NextRequest } from "next/server";
import { errorResponse, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/adminAuth";
import { listConfirmedQuotes } from "@/lib/server/quotesStore";
import { computeAccuracy } from "@/lib/pricing/confirm";

// GET /api/v1/admin/accuracy — ¿el estimado queda dentro del ±10 % del final?
// Criterio para pasar a la etapa 1B: ≥ 50 pedidos y ≥ 80 % dentro del ±10 %.

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const quotes = await listConfirmedQuotes();
    const report = computeAccuracy(
      quotes
        .filter((q) => q.final_total !== null)
        .map((q) => ({
          material: q.input.material,
          estimated_total: q.estimated_total,
          final_total: q.final_total!,
          max_guaranteed: q.max_guaranteed,
        })),
    );
    return json(req, report);
  } catch (err) {
    return errorResponse(req, err);
  }
}
