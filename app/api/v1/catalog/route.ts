import type { NextRequest } from "next/server";
import { errorResponse, json, preflight } from "@/lib/server/http";
import { getActivePricing } from "@/lib/server/pricingStore";
import { toPublicCatalog } from "@/lib/pricing/public";

// GET /api/v1/catalog — opciones para armar la interfaz de la web. Sin costos.

export async function GET(req: NextRequest) {
  try {
    const { version, params } = await getActivePricing();
    return json(req, toPublicCatalog(params, version), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    return errorResponse(req, err);
  }
}

export const OPTIONS = preflight;
