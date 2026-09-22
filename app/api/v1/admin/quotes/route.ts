import type { NextRequest } from "next/server";
import { errorResponse, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/adminAuth";
import { listQuotesByStatus } from "@/lib/server/quotesStore";
import type { QuoteStatus } from "@/lib/pricing/public";

// GET /api/v1/admin/quotes?status=requested,needs_acceptance
// Pendientes primero por confirm_by (el que vence antes, arriba); el resto por fecha.

const ALL: QuoteStatus[] = ["estimated", "requested", "confirmed", "needs_acceptance", "paid", "cancelled", "expired"];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const requested = (req.nextUrl.searchParams.get("status") ?? "requested")
      .split(",")
      .filter((s): s is QuoteStatus => (ALL as string[]).includes(s))
      .slice(0, 10); // límite del operador "in" de Firestore
    const quotes = await listQuotesByStatus(requested.length ? requested : ["requested"]);
    quotes.sort((a, b) =>
      a.confirm_by && b.confirm_by ? a.confirm_by.localeCompare(b.confirm_by) : b.created_at.localeCompare(a.created_at),
    );
    return json(req, { quotes });
  } catch (err) {
    return errorResponse(req, err);
  }
}
