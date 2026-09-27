import type { NextRequest } from "next/server";
import { ApiError, errorResponse, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/adminAuth";
import { getQuote } from "@/lib/server/quotesStore";

// GET /api/v1/admin/quotes/:id — detalle con el desglose interno completo.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const quote = await getQuote(id);
    if (!quote) throw new ApiError("not_found", "No encontramos esa cotización.");
    return json(req, { quote });
  } catch (err) {
    return errorResponse(req, err);
  }
}
