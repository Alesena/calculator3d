import type { NextRequest } from "next/server";
import { ApiError, errorResponse, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/adminAuth";
import { mutateQuote } from "@/lib/server/quotesStore";

// POST /api/v1/admin/quotes/:id/paid — en la etapa 1A el pago se marca a mano.

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const quote = await mutateQuote(id, (q, now) => {
      if (q.status !== "confirmed") throw new ApiError("invalid_state", "Sólo se puede marcar como pagada una cotización confirmada.");
      return {
        status: "paid",
        paid_at: now.toISOString(),
        timeline: [...q.timeline, { status: "paid", at: now.toISOString() }],
      };
    });
    return json(req, { quote });
  } catch (err) {
    return errorResponse(req, err);
  }
}
