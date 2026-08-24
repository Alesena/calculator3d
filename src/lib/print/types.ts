// Tipos compartidos por la capa de importación/estimación de impresión.
//
// Capas:
//   formats  → leen archivos (parse3mf, sliceInfo, gcodeSummary)
//   estimate → matemática pura (shell), sin IO ni React
//   UI       → ThreeMFImporter

/** De dónde salen los números que mostramos. Determina cuánta confianza merecen. */
export type EstimateSource =
  | "slicer" // exacto: lo calculó el laminador que va a imprimir la pieza
  | "mesh"; // estimado: derivado de la malla + parámetros del perfil

export interface FilamentUsage {
  id: number;
  type?: string;
  /** Color en formato #RRGGBB, si el archivo lo declara. */
  color?: string;
  grams: number;
  meters?: number;
}

/**
 * Datos exactos reportados por el laminador. Incluyen purga, torre y soportes:
 * es el filamento que realmente sale del rollo, que es justo lo que se cobra.
 */
export interface SlicerReport {
  weightGrams: number;
  printTimeSeconds?: number;
  filaments: FilamentUsage[];
  layerCount?: number;
  filamentChanges?: number;
  supportUsed?: boolean;
  /** Nombre del laminador, para mostrarlo en la UI. */
  producer?: string;
}

/** Áreas de la malla clasificadas por orientación de la normal, en mm². */
export interface MeshAreas {
  lateralMm2: number;
  topMm2: number;
  bottomMm2: number;
}
