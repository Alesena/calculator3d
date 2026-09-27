// Tipos del motor de cotización pública (web → /api/v1).
//
// Es un motor APARTE de calculatePrice() (src/lib/calculations.ts): aquel costea
// productos propios con peso y tiempo reales del laminador; este estima el
// precio de una pieza del cliente sólo con su malla. No se tocan entre sí, así
// el dashboard de productos da exactamente lo mismo que antes.

export interface ColorParams {
  id: string;
  name: string;
  hex: string;
  available: boolean;
}

export interface MaterialParams {
  id: string;
  name: string;
  description: string;
  /** Inactivo = no aparece en el catálogo público. */
  active: boolean;
  price_per_kg: number;
  /** g/cm³ */
  density: number;
  /** Desperdicio (purga, pruebas): 0,05 = 5 %. */
  waste: number;
  /** Recargo sobre el costo de máquina por material difícil (ABS, TPU…). */
  surcharge: number;
  colors: ColorParams[];
}

export interface QualityParams {
  id: string;
  name: string;
  description: string;
  /** Caudal efectivo de impresión. */
  speed_cm3_h: number;
  /** Altura de capa: define el espesor de techo y piso en el modelo de cáscara. */
  layer_height: number;
  default?: boolean;
}

export interface UseParams {
  id: string;
  name: string;
  description: string;
  /** Relleno, 0–1. */
  infill: number;
  material: string;
  quality: string;
}

export interface SupportParams {
  id: string;
  name: string;
  /** Material extra de soportes sobre la pieza: 0,10 = 10 %. */
  extra: number;
  /** Minutos de post-proceso por unidad (sacar soportes). */
  post_min: number;
}

/** Perímetros y capas sólidas del perfil de impresión (modelo de cáscara). */
export interface ShellProfile {
  wall_loops: number;
  outer_wall_line_width: number;
  inner_wall_line_width: number;
  top_shell_layers: number;
  bottom_shell_layers: number;
}

export interface BusinessHours {
  /** Informativo: el cálculo asume UTC−3 fijo (Argentina no tiene horario de verano). */
  tz: string;
  /** 0 = domingo … 6 = sábado. */
  days: number[];
  from: string; // "09:00"
  to: string; // "18:00"
  confirm_within_h: number;
}

export interface PricingParams {
  materials: MaterialParams[];
  /** Ordenadas de menor a mayor calidad: la sugerencia de ahorro baja un escalón. */
  qualities: QualityParams[];
  uses: UseParams[];
  supports: SupportParams[];
  /** Fracción de pared de la fórmula de referencia (§4). Sólo si la web no manda áreas. */
  wall_fraction: number;
  shell: ShellProfile;
  machine: {
    printer_price: number;
    lifetime_h: number;
    power_kw: number;
    kwh_price: number;
    maintenance_per_h: number;
    failure_rate: number;
  };
  labor_per_h: number;
  prep_minutes_per_order: number;
  /**
   * Minutos de trabajo por cada cama extra de una unidad (sacar, limpiar,
   * relanzar). Opcional: las versiones de parámetros anteriores no lo tienen y
   * usan DEFAULT_PLATE_MINUTES.
   */
  plate_minutes?: number;
  /** Markup sobre costo: 1 = +100 %. */
  markup: number;
  min_order: number;
  priority_surcharge: number;
  transfer_discount: number;
  installments: { count: number; surcharge: number };
  vat: { enabled: boolean; rate: number };
  /** Tope sobre el estimado: 0,10 = el final nunca supera el estimado +10 % sin aceptación. */
  price_cap: number;
  validity_days: number;
  rounding: number;
  quantity_tiers: { from: number; discount: number }[];
  manual_review_from_qty: number;
  printer_max_mm: [number, number, number];
  limits: { max_quantity: number; max_volume_cm3: number };
  business_hours: BusinessHours;
}

/** Input ya validado de POST /quotes. */
export interface QuoteInput {
  material: string;
  quality: string;
  use: string;
  volume_cm3: number;
  /** Superficie por orientación (cm²). Si falta, se usa la fórmula de referencia. */
  areas_cm2?: { lateral: number; top: number; bottom: number };
  /**
   * Con una sola parte, su caja. Con varias, la caja que contiene a cualquiera
   * de ellas (ordenada de mayor a menor): entra en la impresora ⇔ entran todas.
   */
  bbox_mm: [number, number, number];
  /** Objetos separados en el archivo (1 si falta). Volumen y áreas son la suma. */
  parts?: number;
  /** Camas que ocupa una unidad (1 si falta). */
  plates?: number;
  supports?: string;
  quantity: number;
  color: string;
  priority?: boolean;
}

export interface SavingSuggestion {
  type: "quality" | "quantity";
  to: string | number;
  new_total: number;
  saving: number;
}

/** Desglose interno. NUNCA sale en una respuesta pública. */
export interface QuoteBreakdown {
  material_model: "shell" | "reference";
  solid_fraction: number;
  extrusion_cm3: number;
  weight_g: number;
  hours: number;
  machine_hour: number;
  material_cost: number;
  machine_cost: number;
  post_cost: number;
  failure_cost: number;
  /** Camas por unidad y costo de las extra. Las cotizaciones viejas no los tienen. */
  plates?: number;
  plate_cost?: number;
  unit_cost: number;
  unit_list: number;
  qty_discount: number;
  parts_subtotal: number;
  setup: number;
  priority_amt: number;
  vat_amt: number;
  raw_total: number;
}

export interface QuoteResult {
  breakdown: QuoteBreakdown;
  supports: string;
  estimated_total: number;
  unit_price: number;
  max_guaranteed: number;
  transfer_price: number;
  installments: { count: number; amount: number };
  quantity_discount: number;
  vat_included: boolean;
  valid_until: string; // YYYY-MM-DD
  fits_printer: boolean;
  needs_manual_review: boolean;
  manual_review_reasons: ("quantity" | "priority" | "does_not_fit")[];
  savings_suggestions: SavingSuggestion[];
  assumptions: string[];
}
