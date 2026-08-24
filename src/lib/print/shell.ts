import type { MeshAreas } from "./types";

/**
 * Modelo de cáscara + núcleo (H-01).
 *
 * El error grande de la versión anterior era asumir que la fracción de material
 * depende sólo del relleno (`0.2 + infill * 0.8`). No es así: depende de la
 * relación superficie/volumen de la pieza. Las paredes y las capas sólidas de
 * arriba y abajo son material 100 % macizo, y en piezas chicas o finas dominan
 * el resultado.
 *
 * Ejemplo real: un llavero de 40×40×4 mm son 20 capas de 0,2 mm. Con
 * top_shell_layers=5 y bottom_shell_layers=3, 8 de esas 20 capas ya son macizas
 * antes de imprimir un milímetro de relleno.
 *
 * Es una aproximación de primer orden: `A · t` sobreestima un poco en geometría
 * cóncava y donde la pared se encuentra con la cáscara superior. El error baja
 * de ~50 % a un dígito, que es lo que importa para costear.
 */
export interface ShellParams {
  layerHeight: number;
  wallLoops: number;
  outerWallLineWidth: number;
  innerWallLineWidth: number;
  topShellLayers: number;
  bottomShellLayers: number;
  /** Densidad de relleno, 0–1. */
  infillDensity: number;
}

export interface MaterialEstimate {
  /** Paredes + capas sólidas, en mm³. */
  shellMm3: number;
  /** Volumen interior que queda para el relleno, en mm³. */
  coreMm3: number;
  /** Material efectivo dentro del núcleo, en mm³. */
  infillMm3: number;
  /** Total de material de la pieza, en mm³. */
  materialMm3: number;
  /** materialMm3 / volumen sólido. */
  materialFraction: number;
}

export const DEFAULT_SHELL_PARAMS: ShellParams = {
  layerHeight: 0.2,
  wallLoops: 2,
  outerWallLineWidth: 0.42,
  innerWallLineWidth: 0.45,
  topShellLayers: 5,
  bottomShellLayers: 3,
  infillDensity: 0.15,
};

/** Espesor total de la pared vertical: perímetro externo + los internos. */
export function wallThickness(p: ShellParams): number {
  const loops = Math.max(0, p.wallLoops);
  if (loops <= 0) return 0;
  return p.outerWallLineWidth + (loops - 1) * p.innerWallLineWidth;
}

export function topShellThickness(p: ShellParams): number {
  return Math.max(0, p.topShellLayers) * p.layerHeight;
}

export function bottomShellThickness(p: ShellParams): number {
  return Math.max(0, p.bottomShellLayers) * p.layerHeight;
}

/**
 * Estima el material de una pieza a partir de su volumen sólido y del área de su
 * superficie clasificada por orientación.
 *
 *   cascara  = min(V, A_lateral·t_pared + A_techo·t_techo + A_piso·t_piso)
 *   nucleo   = max(0, V − cascara)
 *   material = cascara + infill · nucleo
 */
export function estimateMaterialVolume(
  volumeMm3: number,
  areas: MeshAreas,
  params: ShellParams
): MaterialEstimate {
  if (!(volumeMm3 > 0)) {
    return { shellMm3: 0, coreMm3: 0, infillMm3: 0, materialMm3: 0, materialFraction: 0 };
  }

  const rawShell =
    areas.lateralMm2 * wallThickness(params) +
    areas.topMm2 * topShellThickness(params) +
    areas.bottomMm2 * bottomShellThickness(params);

  // Una pieza no puede tener más cáscara que volumen: por debajo de ~2·t de
  // espesor la pieza es maciza y las dos caras se solapan.
  const shellMm3 = Math.min(volumeMm3, Math.max(0, rawShell));
  const coreMm3 = Math.max(0, volumeMm3 - shellMm3);
  const infill = Math.min(1, Math.max(0, params.infillDensity));
  const infillMm3 = coreMm3 * infill;
  const materialMm3 = shellMm3 + infillMm3;

  return {
    shellMm3,
    coreMm3,
    infillMm3,
    materialMm3,
    materialFraction: materialMm3 / volumeMm3,
  };
}

/** Convierte volumen de material a gramos aplicando densidad y factor de flujo. */
export function materialMass(
  materialMm3: number,
  densityGramsPerCm3: number,
  flowRatio = 1
): number {
  return (materialMm3 * densityGramsPerCm3 * flowRatio) / 1000;
}

/**
 * Longitud de filamento consumida, en metros.
 * Acá sí aplica V = π · (d/2)² · L, despejando L.
 */
export function filamentLengthMeters(materialMm3: number, filamentDiameterMm = 1.75): number {
  const area = Math.PI * (filamentDiameterMm / 2) ** 2;
  return area > 0 ? materialMm3 / area / 1000 : 0;
}
