"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Check, Copy, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import { confirmationMessage, fmtPesos, whatsappLink } from "@/lib/pricing/messages";
import type { StoredQuote } from "@/lib/pricing/public";
import type { QuoteBreakdown } from "@/lib/pricing/types";
import { formatDecimalHours } from "@/lib/calculations";
import { btnGhost, btnPrimary, cardCls, h1Cls, inputCls, mutedCls } from "@/components/quotes/styles";

// Detalle de una cotización: desglose interno completo, confirmación del precio
// final (la regla del tope la aplica el backend) y mensaje de WhatsApp listo.

const WEB_TRACKING_URL = process.env.NEXT_PUBLIC_WEB_TRACKING_URL ?? "https://misintenciones3d.com/impresion-3d";

const STATUS_LABEL: Record<StoredQuote["status"], string> = {
  estimated: "Estimada (sin pedido)",
  requested: "Por confirmar",
  confirmed: "Confirmada — a cobrar",
  needs_acceptance: "Supera el tope — espera OK del cliente",
  paid: "Pagada",
  cancelled: "Cancelada",
  expired: "Vencida",
};

const BREAKDOWN_ROWS: { key: keyof QuoteBreakdown; label: string; fmt: (n: number) => string }[] = [
  { key: "solid_fraction", label: "Fracción de material", fmt: (n) => `${(n * 100).toFixed(1)} %` },
  { key: "extrusion_cm3", label: "Material extruido", fmt: (n) => `${n.toFixed(2)} cm³` },
  { key: "weight_g", label: "Peso por unidad", fmt: (n) => `${n.toFixed(1)} g` },
  { key: "hours", label: "Tiempo por unidad", fmt: (n) => formatDecimalHours(n) },
  { key: "machine_hour", label: "Hora de máquina", fmt: fmtPesos },
  { key: "material_cost", label: "Material", fmt: fmtPesos },
  { key: "machine_cost", label: "Máquina", fmt: fmtPesos },
  { key: "post_cost", label: "Post-proceso", fmt: fmtPesos },
  { key: "failure_cost", label: "Fallas", fmt: fmtPesos },
  { key: "unit_cost", label: "Costo unitario", fmt: fmtPesos },
  { key: "unit_list", label: "Precio de lista unitario", fmt: fmtPesos },
  { key: "qty_discount", label: "Descuento por cantidad", fmt: (n) => `${(n * 100).toFixed(0)} %` },
  { key: "parts_subtotal", label: "Subtotal piezas", fmt: fmtPesos },
  { key: "setup", label: "Preparación", fmt: fmtPesos },
  { key: "priority_amt", label: "Prioridad", fmt: fmtPesos },
  { key: "vat_amt", label: "IVA", fmt: fmtPesos },
  { key: "raw_total", label: "Total sin redondear", fmt: fmtPesos },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-1">
      <span className={mutedCls}>{label}</span>
      <span className="text-right font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

export default function CotizacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [quote, setQuote] = useState<StoredQuote | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ final_total: "", reason: "", actual_weight_g: "", payment_url: "" });
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{ quote: StoredQuote }>(`/quotes/${id}`);
      setQuote(data.quote);
      setForm((f) => ({
        ...f,
        final_total: String(data.quote.final_total ?? data.quote.estimated_total),
        reason: data.quote.reason ?? "",
        payment_url: data.quote.payment_url ?? "",
      }));
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "No se pudo cargar la cotización.");
    }
  }, [id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const final = Math.round(Number(form.final_total));
    if (!(final > 0)) return setFormError("Ingresá el precio final.");
    setBusy(true);
    try {
      const data = await adminFetch<{ quote: StoredQuote }>(`/quotes/${id}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          final_total: final,
          ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
          ...(Number(form.actual_weight_g) > 0 ? { actual_weight_g: Number(form.actual_weight_g) } : {}),
          ...(form.payment_url.trim() ? { payment_url: form.payment_url.trim() } : {}),
        }),
      });
      setQuote(data.quote);
    } catch (err) {
      setFormError(err instanceof AdminApiError ? err.message : "No se pudo confirmar.");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    setBusy(true);
    try {
      const data = await adminFetch<{ quote: StoredQuote }>(`/quotes/${id}/paid`, { method: "POST" });
      setQuote(data.quote);
    } catch (err) {
      toast.error(err instanceof AdminApiError ? err.message : "No se pudo marcar como pagada.");
    } finally {
      setBusy(false);
    }
  };

  const message = quote && (quote.status === "confirmed" || quote.status === "needs_acceptance")
    ? confirmationMessage(quote, WEB_TRACKING_URL)
    : null;

  const copy = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    toast.success("Mensaje copiado");
  };

  const finalNum = Number(form.final_total);
  const canConfirm = quote && (quote.status === "requested" || quote.status === "needs_acceptance");

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <Link href="/cotizaciones" className={`inline-flex items-center gap-1 text-sm ${mutedCls}`}>
          <ArrowLeft className="w-4 h-4" /> Cotizaciones
        </Link>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!quote && !error && <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />}

        {quote && (
          <>
            <div>
              <h1 className={h1Cls}>{quote.id}</h1>
              <p className="text-sm font-medium text-orange-600">{STATUS_LABEL[quote.status]}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <section className={cardCls}>
                <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">Cliente</h2>
                {quote.customer ? (
                  <>
                    <Row label="Nombre" value={quote.customer.name} />
                    <Row label="WhatsApp" value={
                      <a className="text-orange-600 underline" href={whatsappLink(quote.customer.whatsapp, "")} target="_blank" rel="noopener noreferrer">
                        {quote.customer.whatsapp}
                      </a>
                    } />
                    {quote.customer.email && <Row label="Email" value={quote.customer.email} />}
                    <Row label="Entrega" value={quote.customer.delivery.method === "pickup" ? "Retiro" : `Envío · CP ${quote.customer.delivery.postal_code}`} />
                    <Row label="Factura" value={quote.customer.invoice.type === "A" ? `A · ${quote.customer.invoice.business_name} · ${quote.customer.invoice.cuit}` : "B"} />
                    {quote.customer.notes && <p className="text-sm mt-2 text-gray-700 dark:text-gray-300">“{quote.customer.notes}”</p>}
                  </>
                ) : (
                  <p className={`text-sm ${mutedCls}`}>{quote.anonymized_at ? "Datos borrados (90 días)." : "Todavía no hizo el pedido."}</p>
                )}
              </section>

              <section className={cardCls}>
                <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">Pieza</h2>
                <Row label="Archivo" value={quote.input.file_name || "—"} />
                <Row label="Medidas" value={`${quote.input.bbox_mm.map((n) => Math.round(n)).join(" × ")} mm`} />
                <Row label="Volumen" value={`${quote.input.volume_cm3} cm³`} />
                <Row label="Uso · material · calidad" value={`${quote.input.use} · ${quote.input.material} · ${quote.input.quality}`} />
                <Row label="Color · cantidad" value={`${quote.input.color} · ${quote.input.quantity} u.`} />
                <Row label="Soportes" value={quote.result.supports} />
                {quote.result.manual_review_reasons.length > 0 && (
                  <Row label="Revisión manual" value={quote.result.manual_review_reasons.join(", ")} />
                )}
              </section>
            </div>

            <section className={cardCls}>
              <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">Desglose interno</h2>
              <p className={`text-xs mb-2 ${mutedCls}`}>
                Parámetros v{quote.pricing_version} · modelo de material: {quote.result.breakdown.material_model === "shell" ? "cáscara + núcleo" : "fórmula de referencia"}
              </p>
              {BREAKDOWN_ROWS.map((r) => (
                <Row key={r.key} label={r.label} value={r.fmt(quote.result.breakdown[r.key] as number)} />
              ))}
              <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                <Row label="Estimado (lo que vio el cliente)" value={fmtPesos(quote.estimated_total)} />
                <Row label="Tope garantizado" value={fmtPesos(quote.max_guaranteed)} />
                {quote.final_total !== null && <Row label="Final" value={`${fmtPesos(quote.final_total)} (${((quote.deviation ?? 0) * 100).toFixed(1)} %)`} />}
                {quote.actual_weight_g !== null && <Row label="Peso real" value={`${quote.actual_weight_g} g`} />}
              </div>
            </section>

            {canConfirm && (
              <form onSubmit={confirm} className={`${cardCls} space-y-3`}>
                <h2 className="font-semibold text-gray-900 dark:text-white">Confirmar precio final</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="space-y-1 text-sm">
                    <span className={mutedCls}>Precio final ($)</span>
                    <input className={inputCls} inputMode="numeric" value={form.final_total}
                      onChange={(e) => setForm({ ...form, final_total: e.target.value })} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className={mutedCls}>Peso real (g, opcional)</span>
                    <input className={inputCls} inputMode="decimal" value={form.actual_weight_g}
                      onChange={(e) => setForm({ ...form, actual_weight_g: e.target.value })} />
                  </label>
                </div>
                <label className="block space-y-1 text-sm">
                  <span className={mutedCls}>Motivo (obligatorio si supera el tope; lo ve el cliente)</span>
                  <input className={inputCls} value={form.reason} placeholder="Más soportes de lo previsto"
                    onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className={mutedCls}>Link de pago (opcional)</span>
                  <input className={inputCls} value={form.payment_url} placeholder="https://mpago.la/…"
                    onChange={(e) => setForm({ ...form, payment_url: e.target.value })} />
                </label>
                {finalNum > 0 && (
                  <p className={`text-sm ${finalNum > quote.max_guaranteed ? "text-orange-600" : mutedCls}`}>
                    {finalNum > quote.max_guaranteed
                      ? `Supera el tope de ${fmtPesos(quote.max_guaranteed)}: el cliente va a tener que aceptarlo.`
                      : finalNum < quote.estimated_total
                        ? "Es menor al estimado: se cobra el precio menor."
                        : `Dentro del tope de ${fmtPesos(quote.max_guaranteed)}.`}
                  </p>
                )}
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <button type="submit" className={btnPrimary} disabled={busy}>
                  <Check className="w-4 h-4" /> Confirmar
                </button>
              </form>
            )}

            {message && (
              <section className={`${cardCls} space-y-3`}>
                <h2 className="font-semibold text-gray-900 dark:text-white">Mensaje para el cliente</h2>
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-gray-800 dark:text-gray-200">{message}</pre>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={copy} className={btnGhost}><Copy className="w-4 h-4" /> Copiar mensaje</button>
                  {quote.customer && (
                    <a href={whatsappLink(quote.customer.whatsapp, message)} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                      <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
                    </a>
                  )}
                  {quote.status === "confirmed" && (
                    <button type="button" onClick={markPaid} className={btnPrimary} disabled={busy}>Marcar como pagada</button>
                  )}
                </div>
              </section>
            )}

            <section className={cardCls}>
              <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">Historial</h2>
              {quote.timeline.map((t, i) => (
                <Row key={i} label={STATUS_LABEL[t.status]} value={new Date(t.at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} />
              ))}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
