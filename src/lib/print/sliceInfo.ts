import type { FilamentUsage, SlicerReport } from "./types";

/**
 * Lee `Metadata/slice_info.config` de un .3mf exportado DESPUÉS de laminar (H-03).
 *
 * Es la verdad de referencia: `prediction` (segundos) y `weight` (gramos) los
 * calculó el mismo motor que va a imprimir la pieza, y el peso ya incluye purga,
 * torre y soportes. Cuando este bloque existe no hay nada que estimar.
 *
 * Un .3mf de proyecto (guardado sin laminar) trae el archivo pero sólo con el
 * header, sin `<plate>`: ahí devolvemos null y hay que caer a la malla.
 *
 * Se parsea con expresiones regulares a propósito: el formato es plano y estable,
 * y así el módulo no depende del DOM y se puede testear en Node.
 */
export function parseSliceInfo(xml: string): SlicerReport | null {
  const version = xml.match(/key="X-BBL-Client-Version"\s+value="([^"]+)"/)?.[1];
  const producer = version ? `BambuStudio ${version}` : "BambuStudio";

  // Puede haber varias placas; nos quedamos con la primera que tenga datos.
  const plates = xml.match(/<plate>[\s\S]*?<\/plate>/g) ?? [];

  for (const plate of plates) {
    const weight = metaNumber(plate, "weight");
    const prediction = metaNumber(plate, "prediction");
    if (weight === undefined && prediction === undefined) continue;

    const filaments = parseFilaments(plate);
    // El `weight` de la placa es la fuente principal; la suma por filamento sirve
    // de respaldo si esa clave faltara.
    const summed = filaments.reduce((acc, f) => acc + f.grams, 0);
    const weightGrams = weight ?? summed;
    if (!(weightGrams > 0)) continue;

    return {
      weightGrams,
      printTimeSeconds: prediction !== undefined && prediction > 0 ? prediction : undefined,
      filaments,
      supportUsed: metaString(plate, "support_used") === "true",
      producer,
    };
  }

  return null;
}

function metaString(scope: string, key: string): string | undefined {
  const m = scope.match(new RegExp(`key="${key}"\\s+value="([^"]*)"`));
  return m?.[1];
}

function metaNumber(scope: string, key: string): number | undefined {
  const raw = metaString(scope, key);
  if (raw === undefined) return undefined;
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseFilaments(plate: string): FilamentUsage[] {
  const out: FilamentUsage[] = [];
  const tags = plate.match(/<filament\b[^>]*\/>/g) ?? [];

  for (const tag of tags) {
    const grams = parseFloat(attr(tag, "used_g") ?? "");
    if (!Number.isFinite(grams)) continue;
    const meters = parseFloat(attr(tag, "used_m") ?? "");
    out.push({
      id: parseInt(attr(tag, "id") ?? "0", 10) || out.length + 1,
      type: attr(tag, "type"),
      color: normalizeColor(attr(tag, "color")),
      grams,
      meters: Number.isFinite(meters) ? meters : undefined,
    });
  }

  return out;
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

/** BambuStudio escribe #RRGGBBAA; la UI quiere #RRGGBB. */
function normalizeColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const hex = raw.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(hex)) return hex.slice(0, 7);
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  return undefined;
}
