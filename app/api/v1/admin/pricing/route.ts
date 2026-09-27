import type { NextRequest } from "next/server";
import { errorResponse, json, readJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/adminAuth";
import { getActivePricing, listPricingVersions, savePricingVersion } from "@/lib/server/pricingStore";
import { validatePricingParams } from "@/lib/pricing/validation";
import type { PricingParams } from "@/lib/pricing/types";

// GET  /api/v1/admin/pricing → parámetros activos + historial de versiones.
// POST /api/v1/admin/pricing → guarda una versión NUEVA (nunca pisa una vieja).

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const [active, versions] = await Promise.all([getActivePricing(), listPricingVersions()]);
    return json(req, { version: active.version, params: active.params, versions });
  } catch (err) {
    return errorResponse(req, err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await requireAdmin(req);
    const params = validatePricingParams(await readJson(req)) as PricingParams;
    const version = await savePricingVersion(params, uid);
    return json(req, { version });
  } catch (err) {
    return errorResponse(req, err);
  }
}
