import type { NextRequest } from "next/server";
import { clientIp, errorResponse, json, preflight, readJson } from "@/lib/server/http";
import { quotesLimit } from "@/lib/server/ratelimit";
import { getActivePricing } from "@/lib/server/pricingStore";
import { insertQuote, newPublicToken } from "@/lib/server/quotesStore";
import { calculateQuote } from "@/lib/pricing/calculate";
import { validateQuoteBody } from "@/lib/pricing/validation";
import { toPublicQuote } from "@/lib/pricing/public";

// POST /api/v1/quotes — cotización estimada. La web lo llama con debounce cada
// vez que cambia una opción; cada llamada queda guardada (alimenta el embudo).

export async function POST(req: NextRequest) {
  try {
    await quotesLimit(clientIp(req));
    const body = await readJson(req);
    const { version, params } = await getActivePricing();
    const input = validateQuoteBody(body, params);

    const now = new Date();
    const result = calculateQuote(input, params, now);
    const { session_id, ...stored } = input;

    const quote = await insertQuote({
      public_token: newPublicToken(),
      status: "estimated",
      input: stored,
      result,
      pricing_version: version,
      estimated_total: result.estimated_total,
      max_guaranteed: result.max_guaranteed,
      final_total: null,
      charged_total: null,
      deviation: null,
      customer: null,
      reason: null,
      actual_weight_g: null,
      payment_url: null,
      valid_until: result.valid_until,
      session_id,
      confirm_by: null,
      confirmed_by: null,
      timeline: [{ status: "estimated", at: now.toISOString() }],
      created_at: now.toISOString(),
      requested_at: null,
      confirmed_at: null,
      paid_at: null,
      anonymized_at: null,
    });

    return json(req, toPublicQuote(quote), { status: 201 });
  } catch (err) {
    return errorResponse(req, err);
  }
}

export const OPTIONS = preflight;
