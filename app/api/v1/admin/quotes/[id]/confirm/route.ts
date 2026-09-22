import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, json, readJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/adminAuth";
import { mutateQuote } from "@/lib/server/quotesStore";
import { applyConfirmation } from "@/lib/pricing/confirm";

// POST /api/v1/admin/quotes/:id/confirm — precio final. La regla del tope vive
// ACÁ (backend), no en la interfaz: dentro del tope → confirmed; arriba →
// needs_acceptance y el cliente acepta o cancela sin costo.

const schema = z.object({
  final_total: z.number().int().positive(),
  reason: z.string().trim().max(300).optional(),
  actual_weight_g: z.number().positive().optional(),
  // Link de pago generado a mano (etapa 1A). Opcional.
  payment_url: z.string().url().max(500).optional().or(z.literal("")),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const uid = await requireAdmin(req);
    const { id } = await params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? "final_total");
      throw new ApiError("validation_error", "Revisá el precio final.", field);
    }
    const body = parsed.data;

    const quote = await mutateQuote(id, (q, now) => {
      // needs_acceptance también: el admin puede revisar un precio que el cliente todavía no aceptó.
      if (q.status !== "requested" && q.status !== "needs_acceptance") {
        throw new ApiError("invalid_state", `No se puede confirmar una cotización en estado "${q.status}".`);
      }
      const outcome = applyConfirmation(q.estimated_total, q.max_guaranteed, body.final_total);
      if (outcome.status === "needs_acceptance" && !body.reason) {
        throw new ApiError("validation_error", "Si el precio supera el tope, escribí el motivo: el cliente lo va a ver.", "reason");
      }
      return {
        status: outcome.status,
        final_total: body.final_total,
        charged_total: outcome.charged_total,
        deviation: outcome.deviation,
        reason: body.reason ?? null,
        actual_weight_g: body.actual_weight_g ?? null,
        payment_url: body.payment_url || null,
        confirmed_at: now.toISOString(),
        confirmed_by: uid,
        timeline: [...q.timeline, { status: outcome.status, at: now.toISOString() }],
      };
    });
    return json(req, { quote });
  } catch (err) {
    return errorResponse(req, err);
  }
}
