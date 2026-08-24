import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSliceInfo } from "@/src/lib/print/sliceInfo";
import { parseDuration, parseGcodeSummary } from "@/src/lib/print/gcodeSummary";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf-8");

/**
 * Verdad de referencia: el mismo llavero AMS laminado en las dos impresoras.
 *
 *   Bambu Lab A1  → 12,61 g · 43 m 40 s   (3 filamentos, purga a torre)
 *   Snapmaker U1  →  8,09 g · 19 m 17 s   (cambiador de herramienta)
 *
 * La diferencia de 4,5 g entre máquinas es purga: exactamente lo que el modelo
 * anterior no veía (H-06).
 */
describe("datos exactos del laminador (H-03)", () => {
  describe("slice_info.config de BambuStudio", () => {
    const report = parseSliceInfo(fixture("bambu-a1-slice_info.config"));

    it("lee el peso y el tiempo de la placa", () => {
      expect(report).not.toBeNull();
      expect(report!.weightGrams).toBeCloseTo(12.61, 6);
      expect(report!.printTimeSeconds).toBe(2620);
    });

    it("desglosa los tres filamentos y suman el total", () => {
      const filaments = report!.filaments;
      expect(filaments).toHaveLength(3);
      expect(filaments.map((f) => f.grams)).toEqual([7.49, 3.39, 1.73]);
      expect(filaments.reduce((a, f) => a + f.grams, 0)).toBeCloseTo(12.61, 6);
      expect(filaments.every((f) => f.type === "PLA")).toBe(true);
    });

    it("normaliza el color #RRGGBBAA a #RRGGBB", () => {
      expect(report!.filaments[0].color).toBe("#000000");
      expect(report!.filaments[2].color).toBe("#FFFF00");
    });

    it("reporta que no se usaron soportes", () => {
      expect(report!.supportUsed).toBe(false);
    });

    it("devuelve null para un proyecto sin laminar", () => {
      // Un .3mf guardado sin laminar trae el archivo pero sin bloque <plate>.
      const soloHeader = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
    <header_item key="X-BBL-Client-Version" value="02.06.00.51"/>
  </header>
</config>`;
      expect(parseSliceInfo(soloHeader)).toBeNull();
    });
  });

  describe("resumen del G-code", () => {
    it("lee el dialecto de Orca / Snapmaker", () => {
      const report = parseGcodeSummary(fixture("snapmaker-u1-summary.gcode"));
      expect(report).not.toBeNull();
      expect(report!.weightGrams).toBeCloseTo(8.09, 6);
      expect(report!.printTimeSeconds).toBe(19 * 60 + 17);
      expect(report!.layerCount).toBe(25);
      expect(report!.filamentChanges).toBe(6);
      expect(report!.producer).toBe("Snapmaker Orca 2.3.5");
      // Los slots sin usar (0.00 g) no se listan.
      expect(report!.filaments.map((f) => f.grams)).toEqual([1.58, 5.78, 0.74]);
    });

    it("lee el dialecto de BambuStudio y prefiere el tiempo total", () => {
      const report = parseGcodeSummary(fixture("bambu-a1-summary.gcode"));
      expect(report).not.toBeNull();
      // Suma de 7,49 + 3,39 + 1,73.
      expect(report!.weightGrams).toBeCloseTo(12.61, 6);
      // 43m 40s (total) y no 37m 25s (sólo impresión).
      expect(report!.printTimeSeconds).toBe(43 * 60 + 40);
      expect(report!.layerCount).toBe(25);
      expect(report!.producer).toBe("BambuStudio 02.07.01.62");
    });

    it("las dos máquinas coinciden en la pieza y difieren en la purga", () => {
      const bambu = parseGcodeSummary(fixture("bambu-a1-summary.gcode"))!;
      const snapmaker = parseGcodeSummary(fixture("snapmaker-u1-summary.gcode"))!;
      // Mismo llavero: la A1 gasta ~56 % más por purgar en la torre.
      expect(bambu.weightGrams - snapmaker.weightGrams).toBeGreaterThan(4);
    });

    it("devuelve null si no hay resumen", () => {
      expect(parseGcodeSummary("G1 X10 Y10 E1.5\nG1 X20 Y20 E3.0\n")).toBeNull();
    });
  });

  describe("parseo de duraciones", () => {
    it("acepta los formatos de los laminadores", () => {
      expect(parseDuration("19m 17s")).toBe(1157);
      expect(parseDuration("43m 40s")).toBe(2620);
      expect(parseDuration("1h 2m 3s")).toBe(3723);
      expect(parseDuration("2d 1h")).toBe(176400);
      expect(parseDuration("45s")).toBe(45);
      expect(parseDuration("sin datos")).toBeUndefined();
    });
  });
});
