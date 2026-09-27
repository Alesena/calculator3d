import { estimateMaterialVolume } from "../print/shell";
import { DEFAULT_ASSEMBLY_MINUTES, DEFAULT_MULTICOLOR, DEFAULT_PLATE_MINUTES } from "./defaults";
import { localDatePlusDays } from "./time";
import type {
  PricingParams, QuoteBreakdown, QuoteInput, QuoteResult, SavingSuggestion,
} from "./types";

// Motor de cotización de piezas del cliente (spec INTEGRACION_IMPRICOST §4).
// Puro y determinístico: sin I/O ni Date.now() — la fecha entra por parámetro.
//
// Diferencia acordada con la fórmula de referencia (§4.2): la fracción de
// material sale del modelo de cáscara + núcleo (src/lib/print/shell.ts) cuando
// la web manda las áreas de la malla. `wall_fraction + (1 − wall_fraction) ·
// infill` subestima mucho las piezas chicas o finas. Sin áreas se usa la de
// referencia (y así el caso 4.4 de la spec da exacto).
//
// No se redondea ningún paso intermedio: sólo R() sobre los montos finales.

export class PricingError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "PricingError";
  }
}

export const DEFAULT_SUPPORTS = "few";

const roundTo = (x: number, step: number) => Math.ceil(x / step) * step;

export function fitsPrinter(bbox: [number, number, number], max: [number, number, number]): boolean {
  const a = [...bbox].sort((x, y) => y - x);
  const b = [...max].sort((x, y) => y - x);
  return a.every((d, i) => d <= b[i]);
}

/**
 * Partes en que hay que cortar una pieza para que entre: por cada lado (ordenados
 * de mayor a menor, igual que fitsPrinter), cuántas veces entra el de la cama.
 * 1 = entra entera.
 */
export function splitParts(bbox: [number, number, number], max: [number, number, number]): number {
  const a = [...bbox].sort((x, y) => y - x);
  const b = [...max].sort((x, y) => y - x);
  return a.reduce((n, d, i) => n * Math.max(1, Math.ceil(d / b[i])), 1);
}

/** Colores distintos que usa la pieza: dos filamentos del mismo color son un solo cabezal. */
export function colorCount(input: Pick<QuoteInput, "color" | "colors">): number {
  return input.colors?.length ? new Set(input.colors).size : 1;
}

export function quantityDiscount(quantity: number, tiers: PricingParams["quantity_tiers"]): number {
  let discount = 0;
  let best = -Infinity;
  for (const t of tiers) {
    if (t.from <= quantity && t.from > best) {
      best = t.from;
      discount = t.discount;
    }
  }
  return discount;
}

interface Core {
  breakdown: QuoteBreakdown;
  estimated_total: number;
}

function core(input: QuoteInput, params: PricingParams, supportsId: string): Core {
  const material = params.materials.find((m) => m.id === input.material);
  if (!material) throw new PricingError("material", "Ese material no está disponible.");
  const quality = params.qualities.find((q) => q.id === input.quality);
  if (!quality) throw new PricingError("quality", "Esa calidad no está disponible.");
  const use = params.uses.find((u) => u.id === input.use);
  if (!use) throw new PricingError("use", "Elegí para qué es la pieza.");
  const supports = params.supports.find((s) => s.id === supportsId);
  if (!supports) throw new PricingError("supports", "Opción de soportes inválida.");

  // ── Por unidad (§4.2) ──
  let solid_fraction: number;
  let material_model: QuoteBreakdown["material_model"];
  if (input.areas_cm2) {
    const est = estimateMaterialVolume(
      input.volume_cm3 * 1000,
      {
        lateralMm2: input.areas_cm2.lateral * 100,
        topMm2: input.areas_cm2.top * 100,
        bottomMm2: input.areas_cm2.bottom * 100,
      },
      {
        layerHeight: quality.layer_height,
        wallLoops: params.shell.wall_loops,
        outerWallLineWidth: params.shell.outer_wall_line_width,
        innerWallLineWidth: params.shell.inner_wall_line_width,
        topShellLayers: params.shell.top_shell_layers,
        bottomShellLayers: params.shell.bottom_shell_layers,
        infillDensity: use.infill,
      },
    );
    solid_fraction = est.materialFraction;
    material_model = "shell";
  } else {
    solid_fraction = params.wall_fraction + (1 - params.wall_fraction) * use.infill;
    material_model = "reference";
  }

  const m = params.machine;
  const extrusion_cm3 = input.volume_cm3 * solid_fraction * (1 + supports.extra);
  // Multicolor: cada color extra suma cambios de cabezal (tiempo) y purga (material).
  const mc = params.multicolor ?? DEFAULT_MULTICOLOR;
  const color_count = colorCount(input);
  const extra_colors = color_count - 1;
  const weight_g = extrusion_cm3 * material.density * (1 + material.waste + mc.extra_waste * extra_colors);
  const hours = (extrusion_cm3 / quality.speed_cm3_h) * (1 + mc.extra_time * extra_colors);
  const machine_hour = m.printer_price / m.lifetime_h + m.power_kw * m.kwh_price + m.maintenance_per_h;
  const material_cost = (weight_g / 1000) * material.price_per_kg;
  const machine_cost = hours * machine_hour * (1 + material.surcharge);
  const post_cost = (supports.post_min / 60) * params.labor_per_h;
  const failure_cost = (material_cost + machine_cost) * m.failure_rate;
  // La primera cama va en la preparación del pedido; cada cama extra de la
  // unidad es trabajo: sacar la pieza, limpiar y relanzar.
  const plates = input.plates ?? 1;
  const plate_cost = ((plates - 1) * (params.plate_minutes ?? DEFAULT_PLATE_MINUTES) / 60) * params.labor_per_h;
  // Si no entra, se imprime en partes y se pega: cada unión es trabajo.
  const split_parts = splitParts(input.bbox_mm, params.printer_max_mm);
  const assembly_cost = ((split_parts - 1) * (params.assembly_minutes ?? DEFAULT_ASSEMBLY_MINUTES) / 60) * params.labor_per_h;
  const unit_cost = material_cost + machine_cost + post_cost + failure_cost + plate_cost + assembly_cost;

  // ── Pedido (§4.3) ──
  const unit_list = unit_cost * (1 + params.markup);
  const qty_discount = quantityDiscount(input.quantity, params.quantity_tiers);
  const parts_subtotal = unit_list * input.quantity * (1 - qty_discount);
  const setup = (params.prep_minutes_per_order / 60) * params.labor_per_h * (1 + params.markup);
  const priority_amt = input.priority ? (parts_subtotal + setup) * params.priority_surcharge : 0;
  const vat_amt = params.vat.enabled ? (parts_subtotal + setup + priority_amt) * params.vat.rate : 0;
  const raw_total = parts_subtotal + setup + priority_amt + vat_amt;

  return {
    breakdown: {
      material_model, solid_fraction, extrusion_cm3, weight_g, hours, machine_hour,
      material_cost, machine_cost, post_cost, failure_cost, plates, plate_cost, split_parts, assembly_cost,
      color_count, unit_cost, unit_list,
      qty_discount, parts_subtotal, setup, priority_amt, vat_amt, raw_total,
    },
    estimated_total: roundTo(Math.max(raw_total, params.min_order), params.rounding),
  };
}

/** Las sugerencias sólo valen si ahorran al menos esto. */
const MIN_SAVING = 0.05;

function savings(input: QuoteInput, params: PricingParams, supportsId: string, total: number): SavingSuggestion[] {
  const out: SavingSuggestion[] = [];

  // Una calidad más abajo (las calidades están ordenadas de menor a mayor).
  const qi = params.qualities.findIndex((q) => q.id === input.quality);
  if (qi > 0) {
    const lower = params.qualities[qi - 1];
    const alt = core({ ...input, quality: lower.id }, params, supportsId).estimated_total;
    if ((total - alt) / total >= MIN_SAVING) {
      out.push({ type: "quality", to: lower.id, new_total: alt, saving: total - alt });
    }
  }

  // Siguiente escalón de cantidad: conviene si baja el precio por unidad. El
  // ahorro es contra pagar esas unidades al precio unitario de hoy. No se
  // sugiere un escalón que manda el pedido a revisión manual.
  const next = params.quantity_tiers
    .filter((t) => t.from > input.quantity && t.from < params.manual_review_from_qty && t.from <= params.limits.max_quantity)
    .sort((a, b) => a.from - b.from)[0];
  if (next) {
    const alt = core({ ...input, quantity: next.from }, params, supportsId).estimated_total;
    const unitNow = total / input.quantity;
    const unitAlt = alt / next.from;
    if ((unitNow - unitAlt) / unitNow >= MIN_SAVING) {
      out.push({ type: "quantity", to: next.from, new_total: alt, saving: Math.round(unitNow * next.from - alt) });
    }
  }

  return out.slice(0, 2);
}

export function calculateQuote(input: QuoteInput, params: PricingParams, now: Date): QuoteResult {
  const assumptions: string[] = [];
  const supportsId = input.supports ?? DEFAULT_SUPPORTS;
  if (!input.supports) assumptions.push("supports_default");

  const { breakdown, estimated_total } = core(input, params, supportsId);
  const R = (x: number) => roundTo(x, params.rounding);

  const fits = fitsPrinter(input.bbox_mm, params.printer_max_mm);
  const reasons: QuoteResult["manual_review_reasons"] = [];
  if (input.quantity >= params.manual_review_from_qty) reasons.push("quantity");
  if (input.priority) reasons.push("priority");
  if (!fits) reasons.push("does_not_fit");
  if ((breakdown.color_count ?? 1) > 1 && (params.multicolor ?? DEFAULT_MULTICOLOR).manual_review) {
    reasons.push("multicolor");
  }

  return {
    breakdown,
    supports: supportsId,
    estimated_total,
    unit_price: Math.round(estimated_total / input.quantity),
    max_guaranteed: R(estimated_total * (1 + params.price_cap)),
    transfer_price: R(estimated_total * (1 - params.transfer_discount)),
    installments: {
      count: params.installments.count,
      amount: R((estimated_total * (1 + params.installments.surcharge)) / params.installments.count),
    },
    quantity_discount: breakdown.qty_discount,
    vat_included: params.vat.enabled,
    valid_until: localDatePlusDays(now, params.validity_days),
    fits_printer: fits,
    split_parts: breakdown.split_parts ?? 1,
    needs_manual_review: reasons.length > 0,
    manual_review_reasons: reasons,
    savings_suggestions: savings(input, params, supportsId, estimated_total),
    assumptions,
  };
}
