import type { ColorParams, PricingParams } from "./types";

// Parámetros iniciales: la versión 1 que se siembra en Firestore si no hay
// ninguna. Después se editan desde /parametros (cada edición = versión nueva).
//
// Base: spec INTEGRACION_IMPRICOST §4.1, con las decisiones de Ale:
// $25.000/kg, IVA sí, volumen máximo 270 mm (Snapmaker U1; la A1 es 256).
// Colores: los que ofrecía /impresion-3d antes del cotizador.

const c = (id: string, name: string, hex: string): ColorParams => ({ id, name, hex, available: true });

// Funciones y no constantes: cada material necesita su propio objeto de color
// (si no, marcar "sin stock" el negro de PLA lo marcaría también en PETG).
const WHITE = () => c("white", "Blanco", "#F5F5F0");
const BLACK = () => c("black", "Negro", "#1C1410");
const RED = () => c("red", "Rojo", "#C0392B");
const BLUE = () => c("blue", "Azul", "#2C5F6E");

export const DEFAULT_PRICING_PARAMS: PricingParams = {
  materials: [
    {
      id: "PLA", name: "PLA", description: "Ideal para decoración y figuras. Gran detalle.", active: true,
      price_per_kg: 25000, density: 1.24, waste: 0.05, surcharge: 0,
      colors: [WHITE(), BLACK(), RED(), BLUE(), c("green", "Verde", "#2D6A4F"), c("yellow", "Amarillo", "#E9C46A"), c("natural", "Natural", "#F5E7C1")],
    },
    {
      id: "PETG", name: "PETG", description: "Resistente a golpes y temperatura moderada.", active: true,
      price_per_kg: 25000, density: 1.27, waste: 0.05, surcharge: 0,
      colors: [c("clear", "Transparente", "#DDE7EA"), WHITE(), BLACK(), BLUE()],
    },
    {
      id: "ABS", name: "ABS", description: "Más resistente al calor. Para piezas que trabajan.", active: true,
      price_per_kg: 25000, density: 1.04, waste: 0.08, surcharge: 0.1,
      colors: [WHITE(), BLACK(), RED(), BLUE(), c("natural", "Natural", "#F5E7C1")],
    },
    {
      id: "ASA", name: "ASA", description: "Para exterior: aguanta sol y lluvia.", active: false,
      price_per_kg: 25000, density: 1.07, waste: 0.08, surcharge: 0.1,
      colors: [BLACK()],
    },
    {
      id: "TPU", name: "TPU", description: "Flexible, como goma.", active: false,
      price_per_kg: 25000, density: 1.21, waste: 0.06, surcharge: 0.2,
      colors: [BLACK()],
    },
  ],
  qualities: [
    { id: "economy", name: "Económica", description: "Más rápida. Ideal para piezas funcionales y pruebas.", speed_cm3_h: 20, layer_height: 0.28 },
    { id: "standard", name: "Estándar", description: "Buen equilibrio entre terminación, tiempo y precio.", speed_cm3_h: 13, layer_height: 0.2, default: true },
    { id: "high", name: "Alta definición", description: "Más detalle y mejor acabado visual.", speed_cm3_h: 7, layer_height: 0.12 },
  ],
  uses: [
    { id: "decorative", name: "Decoración", description: "Figuras, macetas, regalos", infill: 0.15, material: "PLA", quality: "standard" },
    { id: "functional", name: "Repuesto funcional", description: "Piezas que hacen fuerza o se usan a diario", infill: 0.4, material: "PETG", quality: "standard" },
    // Spec: ASA. Sembrado con ABS porque ASA todavía no se ofrece — cambiarlo en /parametros.
    { id: "outdoor", name: "Exterior", description: "Al sol o a la intemperie", infill: 0.3, material: "ABS", quality: "standard" },
    { id: "automotive", name: "Auto", description: "Interior del auto: calor y vibración", infill: 0.5, material: "ABS", quality: "standard" },
    { id: "prototype", name: "Prototipo", description: "Probar forma y medidas", infill: 0.15, material: "PLA", quality: "economy" },
    { id: "unsure", name: "No estoy seguro", description: "Te recomendamos lo más seguro", infill: 0.25, material: "PETG", quality: "standard" },
  ],
  supports: [
    { id: "none", name: "Sin soportes", extra: 0, post_min: 2 },
    { id: "few", name: "Pocos", extra: 0.1, post_min: 6 },
    { id: "many", name: "Muchos", extra: 0.25, post_min: 15 },
  ],
  wall_fraction: 0.3,
  shell: {
    wall_loops: 2,
    outer_wall_line_width: 0.42,
    inner_wall_line_width: 0.45,
    top_shell_layers: 5,
    bottom_shell_layers: 3,
  },
  machine: { printer_price: 950000, lifetime_h: 4000, power_kw: 0.15, kwh_price: 180, maintenance_per_h: 120, failure_rate: 0.05 },
  labor_per_h: 7000,
  prep_minutes_per_order: 15,
  markup: 1,
  min_order: 8000,
  priority_surcharge: 0.3,
  transfer_discount: 0.05,
  installments: { count: 3, surcharge: 0.12 },
  vat: { enabled: true, rate: 0.21 },
  price_cap: 0.1,
  validity_days: 7,
  rounding: 50,
  quantity_tiers: [
    { from: 1, discount: 0 },
    { from: 5, discount: 0.1 },
    { from: 10, discount: 0.18 },
    { from: 25, discount: 0.25 },
  ],
  manual_review_from_qty: 25,
  printer_max_mm: [270, 270, 270],
  limits: { max_quantity: 500, max_volume_cm3: 20000 },
  business_hours: { tz: "America/Argentina/Buenos_Aires", days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00", confirm_within_h: 2 },
};
