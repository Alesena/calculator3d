import { describe, expect, it } from "vitest";
import { calculatePrice } from "@/src/lib/calculations";
import type { CalculationParams } from "@/src/types";

const base: CalculationParams = {
  cantidad: 1,
  printTimeHours: 6,
  printTimeMinutes: 6, // 6,1 h
  filamentWeight: 146,
  filamentType: "PLA",
  filamentPricePerKg: 22500,
  printerWatts: 200,
  electricityPrice: 45,
  vidaUtilHoras: 4320,
  precioRepuestos: 15000,
  packaging: 2300,
  laborCostPerHour: 0,
  postProcessMinutes: 0,
  margenErrorPct: 10,
  profitPercentage: 30,
  shippingCost: 0,
};

describe("calculatePrice", () => {
  it("reproduce los totales del prototipo original (script.js)", () => {
    const p = calculatePrice(base);
    expect(p.costoMaterial).toBeCloseTo(3285, 6); // 146 g × 22,5 $/g
    expect(p.costoElectricidad).toBeCloseTo(54.9, 6); // 0,2 kW × 6,1 h × 45
    expect(p.costoRepuestos).toBeCloseTo((15000 / 4320) * 6.1, 6);
    expect(p.costoPackaging).toBe(2300);
    expect(p.costoConError).toBeCloseTo(p.costoBase * 1.1, 6);
  });

  it("suma la mano de obra al costo base (H-10)", () => {
    const sinLabor = calculatePrice(base);
    const conLabor = calculatePrice({
      ...base,
      laborCostPerHour: 8000,
      postProcessMinutes: 10,
    });

    expect(conLabor.horasManoObra).toBeCloseTo(10 / 60, 10);
    expect(conLabor.costoManoObra).toBeCloseTo(8000 / 6, 6);
    expect(conLabor.costoBase).toBeCloseTo(sinLabor.costoBase + 8000 / 6, 6);
    // Y se propaga al precio, no queda colgado del desglose.
    expect(conLabor.precioConMarkup).toBeGreaterThan(sinLabor.precioConMarkup);
  });

  it("la mano de obra escala con la cantidad, no con las horas de impresión", () => {
    const p = calculatePrice({
      ...base,
      cantidad: 10,
      laborCostPerHour: 6000,
      postProcessMinutes: 6,
    });
    expect(p.horasManoObra).toBeCloseTo(1, 10); // 10 × 6 min
    expect(p.costoManoObra).toBeCloseTo(6000, 6);
  });

  it("en una pieza chica la mano de obra domina sobre el material", () => {
    // El llavero real: 12,61 g de PLA y 10 minutos de post-proceso.
    const p = calculatePrice({
      ...base,
      filamentWeight: 12.61,
      printTimeHours: 0,
      printTimeMinutes: 44,
      packaging: 0,
      laborCostPerHour: 8000,
      postProcessMinutes: 10,
    });
    expect(p.costoManoObra).toBeGreaterThan(p.costoMaterial * 3);
  });

  it("el envío no se multiplica por la cantidad ni entra en la ganancia", () => {
    const p = calculatePrice({ ...base, cantidad: 4, shippingCost: 5000 });
    expect(p.shipping).toBe(5000);
    expect(p.gananciaMarkup).toBeCloseTo(p.costoConError * 0.3, 6);
    expect(p.precioUnidadMarkup).toBeCloseTo((p.precioConMarkup - 5000) / 4, 6);
  });

  it("una cantidad inválida se trata como una unidad", () => {
    expect(calculatePrice({ ...base, cantidad: 0 }).gramosTotales).toBe(146);
  });
});
