import type { NextRequest } from "next/server";
import { errorResponse, json, preflight } from "@/lib/server/http";
import { getQuoteWithToken } from "@/lib/server/quotesStore";
import { toPublicTracking } from "@/lib/pricing/public";

// GET /api/v1/quotes/:id?t=<token> — pantalla de seguimiento del cliente.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const quote = await getQuoteWithToken(id, req.nextUrl.searchParams.get("t"));
    return json(req, toPublicTracking(quote), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(req, err);
  }
}

export const OPTIONS = preflight;
