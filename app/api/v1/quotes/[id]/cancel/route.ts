import type { NextRequest } from "next/server";
import { ApiError, errorResponse, json, preflight } from "@/lib/server/http";
import { getQuoteWithToken, mutateQuote } from "@/lib/server/quotesStore";
import { toPublicTracking } from "@/lib/pricing/public";

// POST /api/v1/quotes/:id/cancel?t=<token> — el cliente rechaza un precio final
// que superó el tope. Sin costo. Sólo desde needs_acceptance.

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await getQuoteWithToken(id, req.nextUrl.searchParams.get("t"));
    const quote = await mutateQuote(id, (q, now) => {
      if (q.status !== "needs_acceptance") throw new ApiError("invalid_state", "Este pedido ya no se puede modificar.");
      return {
        status: "cancelled",
        timeline: [...q.timeline, { status: "cancelled", at: now.toISOString() }],
      };
    });
    return json(req, toPublicTracking(quote));
  } catch (err) {
    return errorResponse(req, err);
  }
}

export const OPTIONS = preflight;
