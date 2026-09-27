"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, Gauge, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import { fmtPesos } from "@/lib/pricing/messages";
import type { StoredQuote } from "@/lib/pricing/public";
import { btnGhost, cardCls, h1Cls, mutedCls } from "@/components/quotes/styles";

// Pedidos de la web (etapa 1A). "Por confirmar" ordenada por confirm_by: el que
// vence antes, arriba. Es el aviso al equipo (spec A6).

const TABS = [
  { status: "requested", label: "Por confirmar" },
  { status: "needs_acceptance", label: "Esperan OK" },
  { status: "confirmed", label: "A cobrar" },
  { status: "paid", label: "Pagadas" },
  { status: "cancelled,expired", label: "Canceladas" },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

function Deadline({ iso, now }: { iso: string; now: number }) {
  const minutes = (new Date(iso).getTime() - now) / 60_000;
  const cls = minutes < 0 ? "text-red-600" : minutes < 30 ? "text-orange-600" : mutedCls;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      {minutes < 30 && <AlertTriangle className="w-3.5 h-3.5" />}
      {minutes < 0 ? "Vencido: " : "Confirmar antes de "}{fmtDate(iso)}
    </span>
  );
}

export default function CotizacionesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState(TABS[0].status);
  const [quotes, setQuotes] = useState<StoredQuote[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    adminFetch<{ quotes: StoredQuote[] }>(`/quotes?status=${tab}`)
      .then((data) => {
        if (cancelled) return;
        setQuotes(data.quotes);
        setLoadedAt(Date.now());
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof AdminApiError ? err.message : "No se pudieron cargar las cotizaciones.");
        setQuotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, tab]);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className={h1Cls}>Cotizaciones</h1>
          <div className="flex gap-2">
            <Link href="/cotizaciones/precision" className={btnGhost}><Gauge className="w-4 h-4" /> Precisión</Link>
            <Link href="/parametros" className={btnGhost}><SlidersHorizontal className="w-4 h-4" /> Parámetros</Link>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.status}
              onClick={() => {
                setTab(t.status);
                setQuotes(null);
                setError("");
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.status
                  ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {quotes === null ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : quotes.length === 0 ? (
          !error && <p className={`text-sm ${mutedCls}`}>No hay cotizaciones acá.</p>
        ) : (
          <ul className="space-y-2">
            {quotes.map((q) => (
              <li key={q.id}>
                <Link href={`/cotizaciones/${q.id}`} className={`${cardCls} flex items-center gap-3 hover:border-orange-300 transition-colors`}>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {q.customer?.name ?? "Sin datos"} <span className={`font-mono text-xs ${mutedCls}`}>{q.id}</span>
                    </p>
                    <p className={`text-sm truncate ${mutedCls}`}>
                      {q.input.file_name} · {q.input.material} · {q.input.quantity} u. · estimado {fmtPesos(q.estimated_total)}
                      {q.final_total !== null && <> · final {fmtPesos(q.final_total)}</>}
                    </p>
                    {q.status === "requested" && q.confirm_by && <Deadline iso={q.confirm_by} now={loadedAt} />}
                    {q.result.needs_manual_review && (
                      <span className="inline-block text-xs font-medium text-orange-600">Revisión manual</span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
