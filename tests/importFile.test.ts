// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importPrintFile, isSupportedPrintFile } from "@/src/lib/print/importFile";

function loadFile(name: string, type = "application/octet-stream"): File {
  const buffer = readFileSync(join(__dirname, "fixtures", name));
  return new File([new Uint8Array(buffer)], name, { type });
}

/**
 * Integración sobre archivos reales del llavero AMS.
 *
 * El .3mf de la A1 es una exportación posterior al laminado: sus <resources>
 * vienen vacíos, sin malla. La versión anterior tiraba "no se encontró
 * geometría imprimible" y el archivo era directamente inabrible (H-03).
 */
describe("importPrintFile", () => {
  it("reconoce las extensiones soportadas", () => {
    expect(isSupportedPrintFile("pieza.3mf")).toBe(true);
    expect(isSupportedPrintFile("pieza.gcode")).toBe(true);
    expect(isSupportedPrintFile("PIEZA.GCODE")).toBe(true);
    expect(isSupportedPrintFile("pieza.stl")).toBe(false);
  });

  it("abre un .3mf laminado sin malla y devuelve los datos exactos", async () => {
    const result = await importPrintFile(loadFile("bambu-a1-sliced.3mf"));

    expect(result.slicerReport).toBeDefined();
    expect(result.slicerReport!.weightGrams).toBeCloseTo(12.61, 6);
    expect(result.slicerReport!.printTimeSeconds).toBe(2620);
    expect(result.slicerReport!.filaments).toHaveLength(3);

    // No hay malla, y eso ya no es un error.
    expect(result.mesh).toBeUndefined();
  });

  it("lee el perfil del laminador junto con los datos exactos", async () => {
    const { profile } = await importPrintFile(loadFile("bambu-a1-sliced.3mf"));

    // La densidad del archivo (1,26) es la que gana sobre la tabla (1,24) — H-05.
    expect(profile.filamentDensity).toBe(1.26);
    expect(profile.filamentFlowRatio).toBe(0.98);
    expect(profile.printerModel).toBe("Bambu Lab A1");

    // Parámetros de cáscara reales, los que antes se ignoraban — H-01.
    expect(profile.shellParams).toMatchObject({
      wallLoops: 2,
      topShellLayers: 5,
      bottomShellLayers: 3,
      layerHeight: 0.2,
      outerWallLineWidth: 0.42,
      innerWallLineWidth: 0.45,
    });
    // El relleno sale del archivo: 15 %, no el 20 % fijo del slider — H-04.
    expect(profile.shellParams!.infillDensity).toBeCloseTo(0.15, 10);

    // Y la torre de purga está activa: la UI tiene que avisarlo — H-06.
    expect(profile.primeTowerEnabled).toBe(true);
    expect(profile.supportEnabled).toBe(false);
  });

  it("abre un .gcode suelto y lee su resumen", async () => {
    const result = await importPrintFile(loadFile("snapmaker-u1-summary.gcode", "text/plain"));

    expect(result.slicerReport).toBeDefined();
    expect(result.slicerReport!.weightGrams).toBeCloseTo(8.09, 6);
    expect(result.slicerReport!.printTimeSeconds).toBe(1157);
    expect(result.slicerReport!.producer).toBe("Snapmaker Orca 2.3.5");
    expect(result.mesh).toBeUndefined();
  });

  it("rechaza un formato que no maneja", async () => {
    await expect(importPrintFile(loadFile("bambu-a1-slice_info.config"))).rejects.toThrow(
      /no soportado/i
    );
  });
});
