// Regla del tope (spec §3 confirm) y control de precisión (§3 accuracy). Puros.

export interface ConfirmOutcome {
  status: "confirmed" | "needs_acceptance";
  /** Lo que se cobra: el final si está dentro del tope (aunque sea menor al estimado). */
  charged_total: number | null;
  deviation: number;
}

/**
 * El precio final nunca supera el estimado + tope sin aceptación del cliente.
 * `maxGuaranteed` es el tope que se le MOSTRÓ al cliente (guardado en la
 * cotización), no uno recalculado con los parámetros de hoy.
 */
export function applyConfirmation(estimatedTotal: number, maxGuaranteed: number, finalTotal: number): ConfirmOutcome {
  const deviation = (finalTotal - estimatedTotal) / estimatedTotal;
  if (finalTotal <= maxGuaranteed) {
    return { status: "confirmed", charged_total: finalTotal, deviation };
  }
  return { status: "needs_acceptance", charged_total: null, deviation };
}

export interface AccuracyRow {
  material: string;
  estimated_total: number;
  final_total: number;
  max_guaranteed: number;
}

export interface AccuracyReport {
  count: number;
  within_10pct: number;
  over_cap: number;
  /** Desvío absoluto promedio. */
  avg_deviation: number;
  /** Desvío con signo promedio: > 0 = el estimado se queda corto. */
  bias: number;
  ready_for_automation: boolean;
  by_material: Record<string, { count: number; avg_deviation: number }>;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function computeAccuracy(rows: AccuracyRow[]): AccuracyReport {
  const devs = rows.map((r) => (r.final_total - r.estimated_total) / r.estimated_total);
  const count = rows.length;
  const within = devs.filter((d) => Math.abs(d) <= 0.1).length;
  const over = rows.filter((r) => r.final_total > r.max_guaranteed).length;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const groups: Record<string, number[]> = {};
  rows.forEach((r, i) => (groups[r.material] ??= []).push(Math.abs(devs[i])));

  const within_10pct = count ? within / count : 0;
  return {
    count,
    within_10pct: r3(within_10pct),
    over_cap: r3(count ? over / count : 0),
    avg_deviation: r3(mean(devs.map(Math.abs))),
    bias: r3(mean(devs)),
    ready_for_automation: count >= 50 && within_10pct >= 0.8,
    by_material: Object.fromEntries(
      Object.entries(groups).map(([k, v]) => [k, { count: v.length, avg_deviation: r3(mean(v)) }]),
    ),
  };
}
