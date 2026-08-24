import { parse3MF, type SlicingParams } from "../parse3mf";
import { readGcodeSummary } from "./gcodeSummary";
import type { MeshAreas, SlicerReport } from "./types";
import type { ShellParams } from "./shell";

/**
 * Resultado normalizado de importar un archivo de impresión, venga de donde
 * venga. La UI trabaja sólo con esta forma.
 *
 *   slicerReport presente → números exactos, no hay nada que estimar
 *   mesh presente         → hay que estimar con el modelo de cáscara
 */
export interface PrintImport {
  fileName: string;
  slicerReport?: SlicerReport;
  mesh?: {
    volumeMm3: number;
    areas: MeshAreas;
    dimensions: { x: number; y: number; z: number };
    triangleCount: number;
  };
  profile: {
    filamentDensity?: number;
    filamentType?: string;
    filamentFlowRatio?: number;
    filamentDiameter?: number;
    printerModel?: string;
    shellParams?: ShellParams;
    slicingParams?: SlicingParams;
    supportEnabled?: boolean;
    primeTowerEnabled?: boolean;
  };
}

const GCODE_EXT = /\.(gcode|gco|g)$/i;
const THREEMF_EXT = /\.3mf$/i;

export function isSupportedPrintFile(name: string): boolean {
  return THREEMF_EXT.test(name) || GCODE_EXT.test(name);
}

export async function importPrintFile(file: File): Promise<PrintImport> {
  if (GCODE_EXT.test(file.name)) {
    const slicerReport = await readGcodeSummary(file);
    if (!slicerReport) {
      throw new Error(
        "El G-code no trae el resumen del laminador. Verificá que sea un archivo completo, no un fragmento."
      );
    }
    return { fileName: file.name, slicerReport, profile: {} };
  }

  if (!THREEMF_EXT.test(file.name)) {
    throw new Error("Formato no soportado. Subí un .3mf o un .gcode.");
  }

  const parsed = await parse3MF(file);
  const hasMesh = parsed.triangleCount > 0 && parsed.totalVolumeMm3 > 0;

  return {
    fileName: parsed.fileName,
    slicerReport: parsed.slicerReport,
    mesh: hasMesh
      ? {
          volumeMm3: parsed.totalVolumeMm3,
          areas: parsed.areas,
          dimensions: parsed.dimensions,
          triangleCount: parsed.triangleCount,
        }
      : undefined,
    profile: {
      filamentDensity: parsed.filamentDensity,
      filamentType: parsed.filamentType,
      filamentFlowRatio: parsed.filamentFlowRatio,
      filamentDiameter: parsed.filamentDiameter,
      printerModel: parsed.printerModel,
      shellParams: parsed.shellParams,
      slicingParams: parsed.slicingParams,
      supportEnabled: parsed.supportEnabled,
      primeTowerEnabled: parsed.primeTowerEnabled,
    },
  };
}
