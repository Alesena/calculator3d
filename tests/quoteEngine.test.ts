import { describe, expect, it } from "vitest";
import { calculateQuote, colorCount, fitsPrinter, splitParts } from "@/src/lib/pricing/calculate";
import { applyConfirmation, computeAccuracy } from "@/src/lib/pricing/confirm";
import { DEFAULT_PLATE_MINUTES, DEFAULT_PRICING_PARAMS } from "@/src/lib/pricing/defaults";
import { toPublicCatalog, toPublicQuote, type StoredQuote } from "@/src/lib/pricing/public";
import type { PricingParams, QuoteInput } from "@/src/lib/pricing/types";

// Parámetros de la spec §4.1 (planilla de negocio), para el caso de referencia
// 4.4. Difieren de DEFAULT_PRICING_PARAMS en precios por kg, máquina, IVA y tamaño.
const SPEC: PricingParams = {
  ...structuredClone(DEFAULT_PRICING_PARAMS),
  materials: [
    { ...DEFAULT_PRICING_PARAMS.materials[0], price_per_kg: 25000, density: 1.24, waste: 0.05, surcharge: 0 },
    { ...DEFAULT_PRICING_PARAMS.materials[1], price_per_kg: 28000, density: 1.27, waste: 0.05, surcharge: 0 },
  ],
  machine: { printer_price: 950000, lifetime_h: 4000, power_kw: 0.15, kwh_price: 180, maintenance_per_h: 120, failure_rate: 0.05 },
  vat: { enabled: false, rate: 0.21 },
  printer_max_mm: [256, 256, 256],
};

const CASE_44: QuoteInput = {
  material: "PETG",
  quality: "standard",
  use: "functional",
  volume_cm3: 38,
  bbox_mm: [80, 45, 40],
  supports: "few",
  quantity: 4,
  color: "black",
};

// 2026-09-22 12:00 en Buenos Aires
const NOW = new Date("2026-09-22T15:00:00Z");

describe("calculateQuote — caso de referencia 4.4", () => {
  const r = calculateQuote(CASE_44, SPEC, NOW);
  const b = r.breakdown;

  it("intermedios (±0,01)", () => {
    expect(b.material_model).toBe("reference");
    expect(b.solid_fraction).toBeCloseTo(0.58, 2);
    expect(b.extrusion_cm3).toBeCloseTo(24.244, 2);
    expect(b.weight_g).toBeCloseTo(32.329, 2);
    expect(b.hours).toBeCloseTo(1.8649, 2);
    expect(b.machine_hour).toBeCloseTo(384.5, 2);
    expect(b.material_cost).toBeCloseTo(905.22, 1);
    expect(b.machine_cost).toBeCloseTo(717.06, 1);
    expect(b.post_cost).toBeCloseTo(700, 2);
    expect(b.failure_cost).toBeCloseTo(81.11, 1);
    expect(b.unit_cost).toBeCloseTo(2403.4, 1);
    expect(b.unit_list).toBeCloseTo(4806.8, 1);
    expect(b.parts_subtotal).toBeCloseTo(19227.2, 1);
    expect(b.setup).toBeCloseTo(3500, 2);
    expect(b.raw_total).toBeCloseTo(22727.2, 1);
  });

  it("totales exactos", () => {
    expect(r.estimated_total).toBe(22750);
    expect(r.unit_price).toBe(5688);
    expect(r.max_guaranteed).toBe(25050);
    expect(r.transfer_price).toBe(21650);
    expect(r.installments).toEqual({ count: 3, amount: 8500 });
    expect(r.valid_until).toBe("2026-09-29");
    expect(r.fits_printer).toBe(true);
    expect(r.needs_manual_review).toBe(false);
  });
});

describe("calculateQuote — reglas adicionales (spec 4.4)", () => {
  it("pedido chico: aplica el mínimo", () => {
    const r = calculateQuote({ ...CASE_44, material: "PLA", use: "decorative", volume_cm3: 2, quantity: 1 }, SPEC, NOW);
    expect(r.estimated_total).toBe(8000);
  });

  it("5 unidades: 10 % de descuento", () => {
    const r = calculateQuote({ ...CASE_44, quantity: 5 }, SPEC, NOW);
    expect(r.quantity_discount).toBe(0.1);
    expect(r.breakdown.parts_subtotal).toBeCloseTo(r.breakdown.unit_list * 5 * 0.9, 6);
  });

  it("25 unidades: revisión manual", () => {
    const r = calculateQuote({ ...CASE_44, quantity: 25 }, SPEC, NOW);
    expect(r.needs_manual_review).toBe(true);
    expect(r.manual_review_reasons).toContain("quantity");
  });

  it("no entra en la impresora", () => {
    const r = calculateQuote({ ...CASE_44, bbox_mm: [300, 10, 10] }, SPEC, NOW);
    expect(r.fits_printer).toBe(false);
    expect(r.needs_manual_review).toBe(true);
  });

  it("IVA habilitado suma el 21 %", () => {
    const sin = calculateQuote(CASE_44, SPEC, NOW).breakdown.raw_total;
    const con = calculateQuote(CASE_44, { ...SPEC, vat: { enabled: true, rate: 0.21 } }, NOW);
    expect(con.breakdown.raw_total).toBeCloseTo(sin * 1.21, 6);
    expect(con.vat_included).toBe(true);
  });

  it("camas: cada cama extra por unidad suma plate_minutes de trabajo", () => {
    const one = calculateQuote(CASE_44, SPEC, NOW);
    const three = calculateQuote({ ...CASE_44, parts: 4, plates: 3 }, { ...SPEC, plate_minutes: 12 }, NOW);
    expect(one.breakdown.plate_cost).toBe(0);
    expect(three.breakdown.plates).toBe(3);
    expect(three.breakdown.plate_cost).toBeCloseTo((2 * 12 / 60) * SPEC.labor_per_h, 6);
    expect(three.breakdown.unit_cost).toBeCloseTo(one.breakdown.unit_cost + three.breakdown.plate_cost!, 6);
  });
  it("camas: sin plate_minutes en los parámetros usa el valor por defecto", () => {
    const { plate_minutes, ...old } = SPEC;
    void plate_minutes;
    const r = calculateQuote({ ...CASE_44, plates: 2 }, old, NOW);
    expect(r.breakdown.plate_cost).toBeCloseTo((DEFAULT_PLATE_MINUTES / 60) * SPEC.labor_per_h, 6);
  });
  it("no entra: estima en cuántas partes se imprime y suma el armado", () => {
    // 300 mm contra una cama de 256: 2 partes, una unión.
    const big = calculateQuote({ ...CASE_44, bbox_mm: [300, 45, 40] }, { ...SPEC, assembly_minutes: 20 }, NOW);
    expect(big.fits_printer).toBe(false);
    expect(big.split_parts).toBe(2);
    expect(big.breakdown.assembly_cost).toBeCloseTo((20 / 60) * SPEC.labor_per_h, 6);
    expect(big.manual_review_reasons).toContain("does_not_fit");

    const fits = calculateQuote(CASE_44, SPEC, NOW);
    expect(fits.split_parts).toBe(1);
    expect(fits.breakdown.assembly_cost).toBe(0);
  });
  it("splitParts multiplica los cortes de cada lado", () => {
    expect(splitParts([80, 45, 40], [256, 256, 256])).toBe(1);
    expect(splitParts([600, 300, 100], [256, 256, 256])).toBe(3 * 2);
    expect(splitParts([10, 700, 10], [256, 256, 256])).toBe(3); // prueba rotaciones
  });
  it("multicolor: cada color extra suma tiempo y material, y va a revisión", () => {
    const mc = { max_colors: 4, extra_time: 0.1, extra_waste: 0.03, manual_review: true };
    const one = calculateQuote(CASE_44, { ...SPEC, multicolor: mc }, NOW);
    const three = calculateQuote({ ...CASE_44, colors: ["black", "white", "blue"] }, { ...SPEC, multicolor: mc }, NOW);
    expect(three.breakdown.color_count).toBe(3);
    expect(three.breakdown.hours).toBeCloseTo(one.breakdown.hours * 1.2, 6);
    expect(three.breakdown.weight_g).toBeCloseTo(one.breakdown.weight_g * (1 + 0.05 + 0.06) / (1 + 0.05), 6);
    expect(three.manual_review_reasons).toContain("multicolor");
    expect(one.manual_review_reasons).not.toContain("multicolor");
  });
  it("multicolor: dos filamentos del mismo color son un solo color", () => {
    expect(colorCount({ color: "black", colors: ["black", "black"] })).toBe(1);
    const r = calculateQuote({ ...CASE_44, colors: ["black", "black"] }, SPEC, NOW);
    expect(r.estimated_total).toBe(22750);
  });
  it("multicolor: sin revisión manual si se desactiva", () => {
    const mc = { max_colors: 4, extra_time: 0.1, extra_waste: 0.03, manual_review: false };
    const r = calculateQuote({ ...CASE_44, colors: ["black", "white"] }, { ...SPEC, multicolor: mc }, NOW);
    expect(r.needs_manual_review).toBe(false);
  });
  it("prioridad: recargo y revisión manual", () => {
    const r = calculateQuote({ ...CASE_44, priority: true }, SPEC, NOW);
    expect(r.breakdown.priority_amt).toBeGreaterThan(0);
    expect(r.manual_review_reasons).toContain("priority");
  });

  it("sin soportes informados asume 'few' y lo avisa", () => {
    const input: QuoteInput = { ...CASE_44 };
    delete input.supports;
    const r = calculateQuote(input, SPEC, NOW);
    expect(r.supports).toBe("few");
    expect(r.assumptions).toEqual(["supports_default"]);
    expect(r.estimated_total).toBe(22750);
  });

  it("fitsPrinter prueba rotaciones", () => {
    expect(fitsPrinter([10, 250, 10], [256, 256, 256])).toBe(true);
  });
});

describe("calculateQuote — modelo de cáscara (web manda áreas)", () => {
  // Cubo de 40 mm: 64 cm³, 4 caras laterales de 16 cm² y techo/piso de 16 cm².
  const cube: QuoteInput = {
    ...CASE_44,
    volume_cm3: 64,
    areas_cm2: { lateral: 64, top: 16, bottom: 16 },
    bbox_mm: [40, 40, 40],
  };

  it("usa cáscara + núcleo en lugar de la fracción fija", () => {
    const r = calculateQuote(cube, SPEC, NOW);
    expect(r.breakdown.material_model).toBe("shell");
    // pared 0,42+0,45 = 0,87 mm · techo 5×0,2 = 1 mm · piso 3×0,2 = 0,6 mm
    const shell = 6400 * 0.87 + 1600 * 1 + 1600 * 0.6; // mm³
    const expected = (shell + (64000 - shell) * 0.4) / 64000;
    expect(r.breakdown.solid_fraction).toBeCloseTo(expected, 6);
  });

  it("una pieza fina es casi maciza", () => {
    // Placa de 40×40×1 mm: la cáscara se come todo el volumen.
    const plate: QuoteInput = { ...CASE_44, volume_cm3: 1.6, areas_cm2: { lateral: 1.6, top: 16, bottom: 16 }, bbox_mm: [40, 40, 1] };
    expect(calculateQuote(plate, SPEC, NOW).breakdown.solid_fraction).toBe(1);
  });
});

describe("sugerencias de ahorro", () => {
  it("baja un escalón de calidad si ahorra ≥ 5 %", () => {
    const r = calculateQuote({ ...CASE_44, volume_cm3: 200, quality: "high" }, SPEC, NOW);
    const q = r.savings_suggestions.find((s) => s.type === "quality");
    expect(q?.to).toBe("standard");
    expect(q!.new_total).toBeLessThan(r.estimated_total);
    expect(q!.saving).toBe(r.estimated_total - q!.new_total);
  });

  it("como máximo 2 sugerencias y nunca un escalón que exige revisión", () => {
    const r = calculateQuote({ ...CASE_44, volume_cm3: 200, quality: "high", quantity: 12 }, SPEC, NOW);
    expect(r.savings_suggestions.length).toBeLessThanOrEqual(2);
    expect(r.savings_suggestions.some((s) => s.type === "quantity" && Number(s.to) >= 25)).toBe(false);
  });
});

describe("regla del tope", () => {
  // Caso 4.4: estimado 22.750, tope 25.050.
  it("dentro del tope → confirmed", () => {
    expect(applyConfirmation(22750, 25050, 24100)).toMatchObject({ status: "confirmed", charged_total: 24100 });
  });
  it("igual al tope → confirmed", () => {
    expect(applyConfirmation(22750, 25050, 25050).status).toBe("confirmed");
  });
  it("un peso arriba del tope → needs_acceptance, sin cobro", () => {
    expect(applyConfirmation(22750, 25050, 25051)).toMatchObject({ status: "needs_acceptance", charged_total: null });
  });
  it("menor al estimado → se cobra el menor", () => {
    const o = applyConfirmation(22750, 25050, 20000);
    expect(o.charged_total).toBe(20000);
    expect(o.deviation).toBeCloseTo((20000 - 22750) / 22750, 6);
  });
});

describe("respuesta pública", () => {
  const result = calculateQuote(CASE_44, SPEC, NOW);
  const stored = {
    id: "q_abc2345", public_token: "x".repeat(32), status: "estimated", pricing_version: 3,
    result, estimated_total: result.estimated_total, max_guaranteed: result.max_guaranteed,
  } as unknown as StoredQuote;

  it("no expone costos, horas, peso, margen ni parámetros", () => {
    const pub = toPublicQuote(stored);
    const text = JSON.stringify(pub);
    for (const forbidden of ["breakdown", "cost", "hours", "weight", "markup", "margin", "machine", "public_token", "raw_total", "solid_fraction"]) {
      expect(text).not.toContain(forbidden);
    }
    expect(Object.keys(pub).sort()).toEqual([
      "assumptions", "currency", "estimated_total", "fits_printer", "installments", "manual_review_reasons",
      "max_guaranteed", "needs_manual_review", "pricing_version", "quantity_discount", "quote_id",
      "savings_suggestions", "split_parts", "status", "transfer_price", "unit_price", "valid_until", "vat_included",
    ]);
  });

  it("el catálogo no expone precios por kg ni densidades", () => {
    const text = JSON.stringify(toPublicCatalog(DEFAULT_PRICING_PARAMS, 1));
    for (const forbidden of ["price_per_kg", "density", "waste", "surcharge", "infill", "speed", "extra", "post_min"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("el catálogo omite materiales inactivos", () => {
    const cat = toPublicCatalog(DEFAULT_PRICING_PARAMS, 1);
    expect(cat.materials.map((m) => m.id)).not.toContain("TPU");
  });
});

describe("computeAccuracy", () => {
  it("cuenta dentro del ±10 %, sobre el tope y el criterio de 1B", () => {
    const rows = [
      { material: "PLA", estimated_total: 10000, final_total: 10500, max_guaranteed: 11000 },
      { material: "PLA", estimated_total: 10000, final_total: 12000, max_guaranteed: 11000 },
      { material: "PETG", estimated_total: 10000, final_total: 9500, max_guaranteed: 11000 },
    ];
    const r = computeAccuracy(rows);
    expect(r.count).toBe(3);
    expect(r.within_10pct).toBeCloseTo(0.667, 3);
    expect(r.over_cap).toBeCloseTo(0.333, 3);
    expect(r.ready_for_automation).toBe(false);
    expect(r.by_material.PLA.count).toBe(2);
  });

  it("listo para automatizar con 50 pedidos y 80 % adentro", () => {
    const ok = Array.from({ length: 50 }, (_, i) => ({
      material: "PLA", estimated_total: 10000, final_total: i < 40 ? 10200 : 13000, max_guaranteed: 11000,
    }));
    expect(computeAccuracy(ok).ready_for_automation).toBe(true);
  });
});
