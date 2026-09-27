import type { BusinessHours } from "./types";

// Fechas en hora de Buenos Aires. Argentina no tiene horario de verano desde
// 2009, así que un offset fijo de −3 h es exacto y evita depender de Intl en el
// servidor. Truco: "hora local" = Date desplazada, leída con getUTC*.

const OFFSET_MS = -3 * 3600_000;

const toLocal = (d: Date) => new Date(d.getTime() + OFFSET_MS);
const fromLocal = (d: Date) => new Date(d.getTime() - OFFSET_MS);
const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha local de Buenos Aires + N días → "YYYY-MM-DD". */
export function localDatePlusDays(now: Date, days: number): string {
  const l = toLocal(now);
  l.setUTCDate(l.getUTCDate() + days);
  return `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}`;
}

/** Hoy en Buenos Aires, "YYYY-MM-DD". */
export const localToday = (now: Date) => localDatePlusDays(now, 0);

/** ISO con offset de Buenos Aires: "2026-09-22T16:14:00-03:00". */
export function isoBuenosAires(d: Date): string {
  const l = toLocal(d);
  return (
    `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}` +
    `T${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}:${pad(l.getUTCSeconds())}-03:00`
  );
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/**
 * Suma horas hábiles: sólo cuentan los minutos dentro de `days` y [from, to).
 * Un pedido del viernes a las 17:30 con 2 h vence el lunes a las 10:30.
 */
export function addBusinessHours(now: Date, hours: number, bh: BusinessHours): Date {
  const open = minutesOf(bh.from);
  const close = minutesOf(bh.to);
  let remaining = Math.round(hours * 60);
  const t = toLocal(now);
  t.setUTCSeconds(0, 0);

  // Tope defensivo: con days vacío o from ≥ to no habría horario hábil.
  for (let guard = 0; guard < 400; guard++) {
    const minute = t.getUTCHours() * 60 + t.getUTCMinutes();
    const workday = bh.days.includes(t.getUTCDay());

    if (!workday || minute >= close) {
      t.setUTCDate(t.getUTCDate() + 1);
      t.setUTCHours(0, open, 0, 0);
      continue;
    }
    if (minute < open) {
      t.setUTCHours(0, open, 0, 0);
      continue;
    }
    const available = close - minute;
    if (remaining <= available) {
      return fromLocal(new Date(t.getTime() + remaining * 60_000));
    }
    remaining -= available;
    t.setUTCDate(t.getUTCDate() + 1);
    t.setUTCHours(0, open, 0, 0);
  }
  return new Date(now.getTime() + hours * 3600_000);
}
