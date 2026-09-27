import type { PricingParams, QuoteInput, QuoteResult } from "./types";
import { DEFAULT_MULTICOLOR } from "./defaults";

// Lo que sale por la API pública. Se ARMA campo por campo desde una lista
// permitida (spec A7): nunca se hace un spread del resultado interno y se
// borran cosas, así un campo nuevo del desglose no se filtra por accidente.

export type QuoteStatus =
  | "estimated" | "requested" | "confirmed" | "needs_acceptance"
  | "paid" | "cancelled" | "expired";

export interface QuoteCustomer {
  name: string;
  /** E.164: +549… */
  whatsapp: string;
  email: string | null;
  delivery: { method: "pickup" } | { method: "shipping"; postal_code: string };
  invoice: { type: "B" } | { type: "A"; cuit: string; business_name: string };
  notes: string | null;
}

/** Documento `quotes/{id}` en Firestore. Fechas: ISO UTC. */
export interface StoredQuote {
  id: string;
  public_token: string;
  status: QuoteStatus;
  input: QuoteInput & { file_name: string };
  /** Resultado completo, CON desglose interno. */
  result: QuoteResult;
  pricing_version: number;
  estimated_total: number;
  max_guaranteed: number;
  final_total: number | null;
  charged_total: number | null;
  deviation: number | null;
  customer: QuoteCustomer | null;
  reason: string | null;
  actual_weight_g: number | null;
  payment_url: string | null;
  valid_until: string;
  session_id: string;
  confirm_by: string | null;
  confirmed_by: string | null;
  timeline: { status: QuoteStatus; at: string }[];
  created_at: string;
  requested_at: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  anonymized_at: string | null;
}

export function toPublicQuote(q: StoredQuote) {
  const r = q.result;
  return {
    quote_id: q.id,
    status: q.status,
    pricing_version: q.pricing_version,
    currency: "ARS" as const,
    estimated_total: r.estimated_total,
    unit_price: r.unit_price,
    max_guaranteed: r.max_guaranteed,
    transfer_price: r.transfer_price,
    installments: { count: r.installments.count, amount: r.installments.amount },
    quantity_discount: r.quantity_discount,
    vat_included: r.vat_included,
    valid_until: r.valid_until,
    fits_printer: r.fits_printer,
    // Las cotizaciones guardadas antes de existir el campo no lo tienen.
    split_parts: r.split_parts ?? 1,
    needs_manual_review: r.needs_manual_review,
    manual_review_reasons: [...r.manual_review_reasons],
    savings_suggestions: r.savings_suggestions.map((s) => ({
      type: s.type, to: s.to, new_total: s.new_total, saving: s.saving,
    })),
    assumptions: [...r.assumptions],
  };
}

/** Pantalla de seguimiento (GET /quotes/:id?t=). */
export function toPublicTracking(q: StoredQuote) {
  return {
    quote_id: q.id,
    status: q.status,
    currency: "ARS" as const,
    file_name: q.input.file_name,
    quantity: q.input.quantity,
    estimated_total: q.estimated_total,
    max_guaranteed: q.max_guaranteed,
    final_total: q.final_total,
    charged_total: q.charged_total,
    // El motivo sólo se muestra cuando el cliente tiene que decidir.
    reason: q.status === "needs_acceptance" ? q.reason : null,
    payment_url: q.payment_url,
    valid_until: q.valid_until,
    confirm_by: q.confirm_by,
    timeline: q.timeline.map((t) => ({ status: t.status, at: t.at })),
  };
}

export function toPublicCatalog(params: PricingParams, version: number) {
  const active = params.materials.filter((m) => m.active);
  return {
    materials: active.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      colors: m.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, available: c.available })),
    })),
    qualities: params.qualities.map((q) => ({
      id: q.id, name: q.name, description: q.description, ...(q.default ? { default: true } : {}),
    })),
    uses: params.uses.map((u) => ({
      id: u.id,
      name: u.name,
      description: u.description,
      recommended_material: u.material,
      recommended_quality: u.quality,
    })),
    supports: params.supports.map((s) => ({ id: s.id, name: s.name })),
    printer_max_mm: [...params.printer_max_mm] as [number, number, number],
    max_colors: (params.multicolor ?? DEFAULT_MULTICOLOR).max_colors,
    limits: { max_quantity: params.limits.max_quantity, max_volume_cm3: params.limits.max_volume_cm3 },
    pricing_version: version,
  };
}
