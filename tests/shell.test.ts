import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHELL_PARAMS,
  estimateMaterialVolume,
  filamentLengthMeters,
  materialMass,
  wallThickness,
  type ShellParams,
} from "@/src/lib/print/shell";
import type { MeshAreas } from "@/src/lib/print/types";

/** Áreas de un ortoedro alineado a los ejes. */
function boxAreas(x: number, y: number, z: number): MeshAreas {
  return {
    lateralMm2: 2 * (x * z) + 2 * (y * z),
    topMm2: x * y,
    bottomMm2: x * y,
  };
}

describe("modelo de cáscara", () => {
  it("un cubo de 20 mm al 100 % de relleno es macizo: 9,92 g en PLA", () => {
    const volume = 20 ** 3; // 8000 mm³
    const estimate = estimateMaterialVolume(volume, boxAreas(20, 20, 20), {
      ...DEFAULT_SHELL_PARAMS,
      infillDensity: 1,
    });

    expect(estimate.materialMm3).toBeCloseTo(8000, 6);
    expect(estimate.materialFraction).toBeCloseTo(1, 6);
    expect(materialMass(estimate.materialMm3, 1.24)).toBeCloseTo(9.92, 6);
  });

  it("la cáscara nunca supera el volumen de la pieza", () => {
    // Una lámina de 0,3 mm es más fina que una sola pared: es maciza entera.
    const estimate = estimateMaterialVolume(30 * 30 * 0.3, boxAreas(30, 30, 0.3), {
      ...DEFAULT_SHELL_PARAMS,
      infillDensity: 0,
    });
    expect(estimate.materialFraction).toBeCloseTo(1, 6);
    expect(estimate.coreMm3).toBe(0);
  });

  it("una pieza fina es casi maciza aunque el relleno sea bajo (H-01)", () => {
    // El caso del llavero: 40×40×4 mm, capa 0,2 → 20 capas.
    // Con 5 arriba + 3 abajo, 8 de esas 20 capas ya son sólidas.
    const params: ShellParams = { ...DEFAULT_SHELL_PARAMS, infillDensity: 0.15 };
    const estimate = estimateMaterialVolume(40 * 40 * 4, boxAreas(40, 40, 4), params);

    // La fórmula vieja daba 0.2 + 0.15*0.8 = 0.32 para cualquier geometría.
    const legacy = 0.2 + 0.15 * 0.8;
    expect(estimate.materialFraction).toBeGreaterThan(legacy * 1.5);
    expect(estimate.materialFraction).toBeCloseTo(0.564, 3);
    expect(estimate.materialFraction).toBeLessThanOrEqual(1);
  });

  it("una pieza grande sí se beneficia del relleno bajo", () => {
    const params: ShellParams = { ...DEFAULT_SHELL_PARAMS, infillDensity: 0.15 };
    const estimate = estimateMaterialVolume(100 ** 3, boxAreas(100, 100, 100), params);

    // Superficie/volumen chica: acá la cáscara es una fracción menor.
    expect(estimate.materialFraction).toBeLessThan(0.3);
    expect(estimate.materialFraction).toBeGreaterThan(0.15);
  });

  it("el relleno se aplica sólo al núcleo, no al volumen total", () => {
    const params: ShellParams = { ...DEFAULT_SHELL_PARAMS, infillDensity: 0.15 };
    const areas = boxAreas(60, 60, 60);
    const estimate = estimateMaterialVolume(60 ** 3, areas, params);

    expect(estimate.shellMm3 + estimate.infillMm3).toBeCloseTo(estimate.materialMm3, 6);
    expect(estimate.infillMm3).toBeCloseTo(estimate.coreMm3 * 0.15, 6);
  });

  it("el espesor de pared suma el perímetro externo y los internos", () => {
    expect(wallThickness({ ...DEFAULT_SHELL_PARAMS, wallLoops: 2 })).toBeCloseTo(0.87, 10);
    expect(wallThickness({ ...DEFAULT_SHELL_PARAMS, wallLoops: 1 })).toBeCloseTo(0.42, 10);
    expect(wallThickness({ ...DEFAULT_SHELL_PARAMS, wallLoops: 0 })).toBe(0);
  });

  it("el factor de flujo del archivo se aplica a la masa", () => {
    expect(materialMass(1000, 1.26, 0.98)).toBeCloseTo(1.2348, 10);
    expect(materialMass(1000, 1.26)).toBeCloseTo(1.26, 10);
  });

  it("la longitud de filamento sale de V = π·(d/2)²·L", () => {
    // 1 metro de filamento de 1,75 mm son 2405,28 mm³.
    const volume = Math.PI * 0.875 ** 2 * 1000;
    expect(filamentLengthMeters(volume)).toBeCloseTo(1, 10);
  });

  it("un volumen nulo no rompe el cálculo", () => {
    const estimate = estimateMaterialVolume(0, boxAreas(0, 0, 0), DEFAULT_SHELL_PARAMS);
    expect(estimate.materialMm3).toBe(0);
    expect(estimate.materialFraction).toBe(0);
  });
});
