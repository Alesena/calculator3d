import { z } from "zod";
import type { PricingParams, QuoteInput } from "./types";

// Validación estricta de la entrada pública (spec §3). Dos capas:
//   1. zod: forma y tipos.
//   2. catálogo activo: que material, calidad, uso, color y soportes existan.
// Los mensajes van en español: la web los muestra tal cual al cliente.

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const positive = z.number().finite().positive();

export const quoteBodySchema = z.object({
  material: z.string().min(1).max(40),
  quality: z.string().min(1).max(40),
  use: z.string().min(1).max(40),
  volume_cm3: z.number().finite(),
  areas_cm2: z
    .object({ lateral: z.number().finite().min(0), top: z.number().finite().min(0), bottom: z.number().finite().min(0) })
    .optional(),
  bbox_mm: z.tuple([positive, positive, positive]),
  parts: z.number().int().min(1).max(500).optional(),
  plates: z.number().int().min(1).max(100).optional(),
  supports: z.string().min(1).max(40).optional(),
  quantity: z.number(),
  color: z.string().min(1).max(40),
  priority: z.boolean().optional().default(false),
  file_name: z.string().max(200).optional().default(""),
  session_id: z.string().max(100).optional().default(""),
});

export type QuoteBody = z.infer<typeof quoteBodySchema>;

const FIELD_MESSAGES: Record<string, string> = {
  bbox_mm: "Las medidas de la pieza no son válidas.",
  volume_cm3: "El volumen de la pieza no es válido.",
  areas_cm2: "Las medidas de la pieza no son válidas.",
  quantity: "La cantidad no es válida.",
  parts: "El archivo tiene más piezas de las que podemos cotizar al instante.",
  plates: "El archivo ocupa más camas de las que podemos cotizar al instante.",
};

/** zod + catálogo. Devuelve el input listo para calculateQuote o tira ValidationError. */
export function validateQuoteBody(raw: unknown, params: PricingParams): QuoteBody & QuoteInput {
  const parsed = quoteBodySchema.safeParse(raw);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "body");
    throw new ValidationError(field, FIELD_MESSAGES[field] ?? "Faltan datos para cotizar.");
  }
  const b = parsed.data;
  const { limits } = params;

  if (!(b.volume_cm3 > 0.1 && b.volume_cm3 <= limits.max_volume_cm3)) {
    throw new ValidationError("volume_cm3", "El volumen de la pieza está fuera de lo que podemos cotizar al instante.");
  }
  if (!Number.isInteger(b.quantity) || b.quantity < 1 || b.quantity > limits.max_quantity) {
    throw new ValidationError("quantity", `La cantidad debe ser entre 1 y ${limits.max_quantity}.`);
  }
  const material = params.materials.find((m) => m.id === b.material && m.active);
  if (!material) throw new ValidationError("material", "Ese material no está disponible.");
  if (!params.qualities.some((q) => q.id === b.quality)) throw new ValidationError("quality", "Esa calidad no está disponible.");
  if (!params.uses.some((u) => u.id === b.use)) throw new ValidationError("use", "Elegí para qué es la pieza.");
  if (b.supports && !params.supports.some((s) => s.id === b.supports)) {
    throw new ValidationError("supports", "Opción de soportes inválida.");
  }
  if (!material.colors.some((c) => c.id === b.color && c.available)) {
    throw new ValidationError("color", "Ese color no está disponible para este material.");
  }
  return b;
}

// ── POST /quotes/:id/request ────────────────────────────────────────────────

/** CUIT/CUIL: 11 dígitos con dígito verificador (módulo 11). */
export function isValidCuit(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === Number(d[10]);
}

/**
 * WhatsApp → E.164 (+549…). Acepta lo que escribe la gente en Argentina:
 * "11 5555-0123", "011 15 5555 0123", "+54 9 11 5555 0123", "5491155550123".
 * Números de otros países sólo con "+" adelante. Devuelve null si no se entiende.
 */
export function normalizeWhatsapp(raw: string): string | null {
  const trimmed = raw.trim();
  let d = trimmed.replace(/\D/g, "");
  if (!d) return null;

  if (trimmed.startsWith("+") && !d.startsWith("54")) {
    return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  }

  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  // "15" de celular después de un código de área de 2 a 4 dígitos.
  if (d.length === 12) {
    const m = d.match(/^(\d{2,4})15(\d+)$/);
    if (m && m[1].length + m[2].length === 10) d = m[1] + m[2];
  }
  return d.length === 10 ? `+549${d}` : null;
}

export const requestBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  whatsapp: z.string().min(6).max(30),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  delivery: z.discriminatedUnion("method", [
    z.object({ method: z.literal("pickup") }),
    z.object({ method: z.literal("shipping"), postal_code: z.string().trim().regex(/^(\d{4}|[A-Za-z]\d{4}[A-Za-z]{3})$/) }),
  ]),
  invoice: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("B") }),
      z.object({ type: z.literal("A"), cuit: z.string(), business_name: z.string().trim().min(1).max(200) }),
    ])
    .optional()
    .default({ type: "B" }),
  notes: z.string().trim().max(500).optional(),
});

const REQUEST_MESSAGES: Record<string, string> = {
  name: "Ingresá tu nombre.",
  whatsapp: "Revisá el número de WhatsApp.",
  email: "Revisá el email.",
  delivery: "Revisá el código postal.",
  invoice: "Revisá los datos de facturación.",
  notes: "El comentario es demasiado largo.",
};

export function validateRequestBody(raw: unknown) {
  const parsed = requestBodySchema.safeParse(raw);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path ?? [];
    const top = String(path[0] ?? "body");
    const field = top === "delivery" ? "postal_code" : top === "invoice" ? String(path[1] ?? "invoice") : top;
    throw new ValidationError(field, REQUEST_MESSAGES[top] ?? "Revisá los datos.");
  }
  const b = parsed.data;
  const whatsapp = normalizeWhatsapp(b.whatsapp);
  if (!whatsapp) throw new ValidationError("whatsapp", REQUEST_MESSAGES.whatsapp);
  if (b.invoice.type === "A" && !isValidCuit(b.invoice.cuit)) {
    throw new ValidationError("cuit", "El CUIT no es válido.");
  }
  return {
    name: b.name,
    whatsapp,
    email: b.email || null,
    delivery: b.delivery.method === "shipping"
      ? { method: "shipping" as const, postal_code: b.delivery.postal_code.toUpperCase() }
      : { method: "pickup" as const },
    invoice: b.invoice.type === "A"
      ? { type: "A" as const, cuit: b.invoice.cuit.replace(/\D/g, ""), business_name: b.invoice.business_name }
      : { type: "B" as const },
    notes: b.notes || null,
  };
}

// ── Parámetros (admin) ──────────────────────────────────────────────────────

const id = z.string().trim().min(1).max(40);
const frac = z.number().finite().min(0).max(1);
const money = z.number().finite().min(0);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

export const pricingParamsSchema = z.object({
  materials: z.array(z.object({
    id, name: z.string().trim().min(1).max(60), description: z.string().max(200), active: z.boolean(),
    price_per_kg: money, density: z.number().finite().positive(), waste: frac, surcharge: z.number().finite().min(0).max(5),
    colors: z.array(z.object({
      id, name: z.string().trim().min(1).max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/), available: z.boolean(),
    })),
  })).min(1),
  qualities: z.array(z.object({
    id, name: z.string().trim().min(1).max(60), description: z.string().max(200),
    speed_cm3_h: z.number().finite().positive(), layer_height: z.number().finite().positive().max(1),
    default: z.boolean().optional(),
  })).min(1),
  uses: z.array(z.object({
    id, name: z.string().trim().min(1).max(60), description: z.string().max(200), infill: frac, material: id, quality: id,
  })).min(1),
  supports: z.array(z.object({
    id, name: z.string().trim().min(1).max(60), extra: z.number().finite().min(0).max(5), post_min: money,
  })).min(1),
  wall_fraction: frac,
  shell: z.object({
    wall_loops: z.number().int().min(0).max(20),
    outer_wall_line_width: z.number().finite().positive(),
    inner_wall_line_width: z.number().finite().positive(),
    top_shell_layers: z.number().int().min(0).max(50),
    bottom_shell_layers: z.number().int().min(0).max(50),
  }),
  machine: z.object({
    printer_price: money, lifetime_h: z.number().finite().positive(), power_kw: money,
    kwh_price: money, maintenance_per_h: money, failure_rate: frac,
  }),
  labor_per_h: money,
  prep_minutes_per_order: money,
  plate_minutes: money.optional(),
  assembly_minutes: money.optional(),
  markup: z.number().finite().min(0).max(20),
  min_order: money,
  priority_surcharge: z.number().finite().min(0).max(5),
  transfer_discount: frac,
  installments: z.object({ count: z.number().int().min(1).max(24), surcharge: z.number().finite().min(0).max(5) }),
  vat: z.object({ enabled: z.boolean(), rate: frac }),
  price_cap: frac,
  validity_days: z.number().int().min(1).max(90),
  rounding: z.number().int().min(1).max(10000),
  quantity_tiers: z.array(z.object({ from: z.number().int().min(1), discount: frac })).min(1),
  manual_review_from_qty: z.number().int().min(1),
  printer_max_mm: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
  limits: z.object({ max_quantity: z.number().int().min(1), max_volume_cm3: z.number().positive() }),
  business_hours: z.object({
    tz: z.string(), days: z.array(z.number().int().min(0).max(6)).min(1), from: hhmm, to: hhmm,
    confirm_within_h: z.number().finite().positive(),
  }),
});

/** Chequeos cruzados que zod no cubre: ids únicos y referencias válidas. */
export function validatePricingParams(raw: unknown) {
  const parsed = pricingParamsSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(issue?.path.join(".") ?? "params", `Valor inválido en ${issue?.path.join(".") ?? "parámetros"}.`);
  }
  const p = parsed.data;
  const dup = (xs: { id: string }[]) => xs.find((x, i) => xs.findIndex((y) => y.id === x.id) !== i)?.id;
  for (const [name, list] of [["materials", p.materials], ["qualities", p.qualities], ["uses", p.uses], ["supports", p.supports]] as const) {
    const d = dup(list);
    if (d) throw new ValidationError(name, `Hay dos elementos con el id "${d}" en ${name}.`);
  }
  for (const m of p.materials) {
    const d = dup(m.colors);
    if (d) throw new ValidationError("materials", `${m.name}: hay dos colores con el id "${d}".`);
  }
  for (const u of p.uses) {
    if (!p.materials.some((m) => m.id === u.material)) throw new ValidationError("uses", `El uso "${u.name}" recomienda un material que no existe.`);
    if (!p.qualities.some((q) => q.id === u.quality)) throw new ValidationError("uses", `El uso "${u.name}" recomienda una calidad que no existe.`);
  }
  if (!p.supports.some((s) => s.id === "few")) {
    throw new ValidationError("supports", 'Tiene que existir la opción de soportes "few": es la que se usa por defecto.');
  }
  return p;
}
