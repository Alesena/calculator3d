// Densidades de referencia en g/cm³.
//
// Son sólo un fallback: si el archivo declara `filament_density`, ese valor gana
// siempre — el archivo sabe qué rollo es, esta tabla no.
export const FILAMENT_DENSITIES: Record<string, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  ASA: 1.07,
  TPU: 1.21,
  Nylon: 1.1,
  PC: 1.2,
  Resina: 1.1,
};

export const DEFAULT_DENSITY = FILAMENT_DENSITIES.PLA;

/** Densidad de referencia para un tipo de filamento, tolerante a mayúsculas y sufijos. */
export function densityForType(type: string | undefined): number | undefined {
  if (!type) return undefined;
  const exact = FILAMENT_DENSITIES[type];
  if (exact) return exact;
  const upper = type.toUpperCase();
  for (const [key, value] of Object.entries(FILAMENT_DENSITIES)) {
    if (upper.startsWith(key.toUpperCase())) return value;
  }
  return undefined;
}

/**
 * Densidad a usar, por orden de confianza:
 *   1. la que declara el archivo
 *   2. la tabla, según el tipo de filamento del archivo
 *   3. PLA
 */
export function resolveDensity(
  fileDensity: number | undefined,
  filamentType: string | undefined
): { density: number; from: "file" | "table" | "default" } {
  if (fileDensity && fileDensity > 0) return { density: fileDensity, from: "file" };
  const table = densityForType(filamentType);
  if (table) return { density: table, from: "table" };
  return { density: DEFAULT_DENSITY, from: "default" };
}
