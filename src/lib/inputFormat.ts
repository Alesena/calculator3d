// Parseo de los campos que el usuario escribe con punto: tiempo de impresión
// (horas.minutos) y peso de filamento (gramos decimales).

export const PRINT_TIME_ERROR = "Formato inválido. Ej: 1.30 (horas.minutos)";

/**
 * El punto separa horas de minutos, NO es un decimal de horas:
 * `1.30` = 1h 30min (una hora y media), `1.15` = 1h 15min (una hora y cuarto).
 * Devuelve `null` si el formato no es válido.
 */
export function parsePrintTime(value: string): { hours: number; minutes: number } | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return { hours: 0, minutes: 0 };

  const parts = trimmed.split(".");
  if (parts.length === 1) {
    if (!/^\d+$/.test(parts[0])) return null;
    return { hours: parseInt(parts[0], 10), minutes: 0 };
  }
  if (parts.length === 2) {
    const [hStr, mStr] = parts;
    // Los minutos son como máximo dos dígitos: "1.155" no es un tiempo.
    if (!/^\d+$/.test(hStr) || !/^\d{1,2}$/.test(mStr)) return null;
    const minutes = parseInt(mStr, 10);
    if (minutes > 59) return null;
    return { hours: parseInt(hStr, 10), minutes };
  }
  return null;
}

/**
 * 1h 5min → `"1.05"`. Los minutos van siempre con dos dígitos para que el
 * punto no se lea como decimal.
 */
export function formatPrintTime(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) return "";
  if (minutes === 0) return `${hours}`;
  return `${hours}.${String(minutes).padStart(2, "0")}`;
}

/**
 * Gramos enteros, redondeando **hacia arriba**: el campo sólo deja tipear
 * dígitos (ver `onlyDigits`), pero el importador .3mf sí trae decimales
 * (12.61 g). Se redondea para arriba porque quedarse corto con el material
 * subestima el costo. Lo que no sea un número cae en 0, para que el mensaje
 * que ve el usuario venga del schema y no sea un "NaN".
 */
export function parseGrams(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.ceil(value) : 0;
  if (typeof value !== "string") return 0;
  const s = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return 0;
  return Math.ceil(Number(s));
}

/** Deja sólo dígitos: el campo de gramos no acepta ni punto ni coma. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}
