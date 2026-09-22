"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import type { AccuracyReport } from "@/lib/pricing/confirm";
import { cardCls, h1Cls, mutedCls } from "@/components/quotes/styles";

// Control de precisión: estimado vs. final confirmado. Pasar a la etapa 1B
// (cotización automática) cuando haya ≥ 50 pedidos y ≥ 80 % dentro del ±10 %.

const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={cardCls}>
      <p className={`text-xs ${mutedCls}`}>{label}</p>
      <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
      {hint && <p className={`text-xs mt-1 ${mutedCls}`}>{hint}</p>}
    </div>
  );
}

export default function PrecisionPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<AccuracyReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    adminFetch<AccuracyReport>("/accuracy")
      .then(setReport)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "No se pudo cargar."));
  }, [user]);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <Link href="/cotizaciones" className={`inline-flex items-center gap-1 text-sm ${mutedCls}`}>
          <ArrowLeft className="w-4 h-4" /> Cotizaciones
        </Link>
        <h1 className={h1Cls}>Precisión del cotizador</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}

        {report && (
          <>
            <div className={`${cardCls} ${report.ready_for_automation ? "border-green-400" : ""}`}>
              <p className="font-semibold text-gray-900 dark:text-white">
                {report.ready_for_automation
                  ? "Listo para automatizar (etapa 1B)."
                  : `Todavía no: hacen falta ≥ 50 pedidos confirmados y ≥ 80 % dentro del ±10 % (hoy: ${report.count} y ${pct(report.within_10pct)}).`}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Confirmadas" value={String(report.count)} />
              <Stat label="Dentro del ±10 %" value={pct(report.within_10pct)} />
              <Stat label="Superaron el tope" value={pct(report.over_cap)} hint="Si pasa del 10 %, corregir la fórmula" />
              <Stat label="Desvío promedio" value={pct(report.avg_deviation)} hint={`Sesgo: ${report.bias > 0 ? "+" : ""}${pct(report.bias)}`} />
            </div>
            {Object.keys(report.by_material).length > 0 && (
              <div className={cardCls}>
                <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">Por material</h2>
                {Object.entries(report.by_material).map(([m, v]) => (
                  <div key={m} className="flex justify-between text-sm py-1">
                    <span className={mutedCls}>{m} ({v.count})</span>
                    <span className="font-medium text-gray-900 dark:text-white">{pct(v.avg_deviation)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
