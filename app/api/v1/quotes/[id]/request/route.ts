import type { NextRequest } from "next/server";
import { ApiError, clientIp, errorResponse, json, mask, preflight, readJson } from "@/lib/server/http";
import { requestLimit } from "@/lib/server/ratelimit";
import { getActivePricing } from "@/lib/server/pricingStore";
import { mutateQuote } from "@/lib/server/quotesStore";
import { validateRequestBody } from "@/lib/pricing/validation";
import { addBusinessHours, isoBuenosAires } from "@/lib/pricing/time";

// POST /api/v1/quotes/:id/request — el cliente envía el pedido. No se paga acá.
// El aviso al equipo (spec A6) es la lista de /cotizaciones ordenada por confirm_by.

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    await requestLimit(clientIp(req));
    const { id } = await params;
    const customer = validateRequestBody(await readJson(req));
    const { params: pricing } = await getActivePricing();

    const quote = await mutateQuote(id, (q, now) => {
      if (q.status === "expired") {
        throw new ApiError("quote_expired", "El precio de esta cotización venció. Lo recalculamos con un clic.");
      }
      if (q.status !== "estimated") throw new ApiError("invalid_state", "Este pedido ya fue enviado.");
      const confirmBy = addBusinessHours(now, pricing.business_hours.confirm_within_h, pricing.business_hours);
      return {
        status: "requested",
        customer,
        requested_at: now.toISOString(),
        confirm_by: confirmBy.toISOString(),
        timeline: [...q.timeline, { status: "requested", at: now.toISOString() }],
      };
    });

    console.info("[quotes] pedido", quote.id, "de", mask(customer.whatsapp));
    return json(req, {
      quote_id: quote.id,
      status: quote.status,
      confirm_by: isoBuenosAires(new Date(quote.confirm_by!)),
      // Única respuesta que lleva el token de seguimiento.
      token: quote.public_token,
    });
  } catch (err) {
    return errorResponse(req, err);
  }
}

export const OPTIONS = preflight;
