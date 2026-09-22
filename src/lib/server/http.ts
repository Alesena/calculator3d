import { NextResponse, type NextRequest } from "next/server";
import { ValidationError } from "@/lib/pricing/validation";
import { PricingError } from "@/lib/pricing/calculate";

// Respuestas JSON, formato de error único (spec §3) y CORS para la web.

export type ErrorCode =
  | "validation_error" | "not_found" | "quote_expired" | "invalid_state"
  | "rate_limited" | "unauthorized" | "internal_error";

const STATUS: Record<ErrorCode, number> = {
  validation_error: 422,
  not_found: 404,
  quote_expired: 409,
  invalid_state: 409,
  rate_limited: 429,
  unauthorized: 401,
  internal_error: 500,
};

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string, public field?: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ── CORS ──
// ALLOWED_ORIGINS=https://misintenciones3d.com,https://www.misintenciones3d.com
function allowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = allowedOrigin(req);
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export function preflight(req: NextRequest): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  const origin = allowedOrigin(req);
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type");
    res.headers.set("Access-Control-Max-Age", "86400");
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export function json(req: NextRequest, data: unknown, init?: ResponseInit): NextResponse {
  return withCors(req, NextResponse.json(data, init));
}

export function errorResponse(req: NextRequest, err: unknown): NextResponse {
  let e: ApiError;
  if (err instanceof ApiError) e = err;
  else if (err instanceof ValidationError || err instanceof PricingError) e = new ApiError("validation_error", err.message, err.field);
  else {
    console.error("[api/v1]", err);
    e = new ApiError("internal_error", "Tuvimos un problema. Probá de nuevo en un rato.");
  }
  return json(
    req,
    { error: { code: e.code, message: e.message, ...(e.field ? { field: e.field } : {}) } },
    { status: STATUS[e.code] },
  );
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError("validation_error", "El pedido no tiene un formato válido.");
  }
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || `unknown-${crypto.randomUUID()}`;
}

/** Para logs: nunca el WhatsApp o el email completos (spec A7). */
export function mask(value: string | null | undefined): string {
  if (!value) return "";
  return value.length <= 4 ? "****" : `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}
