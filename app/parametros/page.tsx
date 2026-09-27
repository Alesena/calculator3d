"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import type { PricingParams } from "@/lib/pricing/types";
import { btnGhost, btnPrimary, cardCls, h1Cls, inputCls, mutedCls } from "@/components/quotes/styles";

// Parámetros del cotizador de la web: materiales y colores (catálogo), usos,
// calidades y todas las reglas de precio. Guardar crea una VERSIÓN NUEVA; cada
// cotización recuerda con qué versión se calculó.

interface VersionMeta { version: number; created_at: string; created_by: string; active: boolean }
interface PricingResponse { version: number; params: PricingParams; versions: VersionMeta[] }

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";

function uniqueId(base: string, taken: string[]): string {
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}

/** Input numérico. `pct` muestra fracciones como porcentaje (0,1 ↔ 10). */
function Num({ label, value, onChange, pct, step }: {
  label: string; value: number; onChange: (n: number) => void; pct?: boolean; step?: number;
}) {
  const shown = pct ? Math.round(value * 10000) / 100 : value;
  return (
    <label className="space-y-1 text-sm block">
      <span className={mutedCls}>{label}{pct ? " (%)" : ""}</span>
      <input
        type="number"
        step={step ?? "any"}
        className={inputCls}
        value={Number.isFinite(shown) ? shown : ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(pct ? n / 100 : n);
        }}
      />
    </label>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return (
    <label className="space-y-1 text-sm block">
      <span className={mutedCls}>{label}</span>
      <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={`${cardCls} space-y-3`}>
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
        {hint && <p className={`text-xs mt-0.5 ${mutedCls}`}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function ParametrosPage() {
  const { user } = useAuth();
  const [data, setData] = useState<PricingResponse | null>(null);
  const [p, setP] = useState<PricingParams | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await adminFetch<PricingResponse>("/pricing");
      setData(res);
      setP(res.params);
      setDirty(false);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "No se pudieron cargar los parámetros.");
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  /** Edita una copia y marca cambios sin guardar. */
  const edit = (fn: (draft: PricingParams) => void) => {
    setP((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    if (!p) return;
    setSaving(true);
    setError("");
    try {
      const { version } = await adminFetch<{ version: number }>("/pricing", { method: "POST", body: JSON.stringify(p) });
      toast.success(`Guardado como versión ${version}`);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4 pb-24">
        <Link href="/cotizaciones" className={`inline-flex items-center gap-1 text-sm ${mutedCls}`}>
          <ArrowLeft className="w-4 h-4" /> Cotizaciones
        </Link>
        <div>
          <h1 className={h1Cls}>Parámetros del cotizador</h1>
          {data && <p className={`text-sm ${mutedCls}`}>Versión activa: {data.version}. Guardar crea una versión nueva.</p>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!p && !error && <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />}

        {p && (
          <>
            {/* ── Materiales y colores ── */}
            <Section title="Materiales y colores" hint="Lo que ve el cliente en la web. Un material inactivo no aparece; un color sin stock aparece tachado.">
              {p.materials.map((m, mi) => (
                <div key={mi} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">{m.id}</span>
                    <label className="flex items-center gap-1.5 text-sm ml-auto">
                      <input type="checkbox" checked={m.active} onChange={(e) => edit((d) => { d.materials[mi].active = e.target.checked; })} />
                      Activo
                    </label>
                    <button
                      type="button"
                      className="p-2 text-gray-400 hover:text-red-600"
                      aria-label={`Borrar ${m.name}`}
                      onClick={() => {
                        if (p.uses.some((u) => u.material === m.id)) {
                          toast.error("Hay usos que recomiendan este material: cambialos primero.");
                          return;
                        }
                        edit((d) => { d.materials.splice(mi, 1); });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Text label="Nombre" value={m.name} onChange={(v) => edit((d) => { d.materials[mi].name = v; })} />
                    <Text label="Descripción (la ve el cliente)" value={m.description} onChange={(v) => edit((d) => { d.materials[mi].description = v; })} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Num label="Precio por kg ($)" value={m.price_per_kg} onChange={(v) => edit((d) => { d.materials[mi].price_per_kg = v; })} />
                    <Num label="Densidad (g/cm³)" value={m.density} onChange={(v) => edit((d) => { d.materials[mi].density = v; })} />
                    <Num label="Desperdicio" pct value={m.waste} onChange={(v) => edit((d) => { d.materials[mi].waste = v; })} />
                    <Num label="Recargo máquina" pct value={m.surcharge} onChange={(v) => edit((d) => { d.materials[mi].surcharge = v; })} />
                  </div>

                  <div className="space-y-2">
                    <p className={`text-xs font-medium ${mutedCls}`}>Colores</p>
                    {m.colors.map((c, ci) => (
                      <div key={ci} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={c.hex}
                          aria-label={`Color de ${c.name}`}
                          className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 shrink-0"
                          onChange={(e) => edit((d) => { d.materials[mi].colors[ci].hex = e.target.value.toUpperCase(); })}
                        />
                        <input
                          className={inputCls}
                          value={c.name}
                          aria-label="Nombre del color"
                          onChange={(e) => edit((d) => { d.materials[mi].colors[ci].name = e.target.value; })}
                        />
                        <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <input type="checkbox" checked={c.available}
                            onChange={(e) => edit((d) => { d.materials[mi].colors[ci].available = e.target.checked; })} />
                          Hay stock
                        </label>
                        <button type="button" className="p-2 text-gray-400 hover:text-red-600" aria-label={`Borrar ${c.name}`}
                          onClick={() => edit((d) => { d.materials[mi].colors.splice(ci, 1); })}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => {
                        const name = window.prompt("Nombre del color");
                        if (!name?.trim()) return;
                        edit((d) => {
                          const colors = d.materials[mi].colors;
                          colors.push({ id: uniqueId(slug(name), colors.map((x) => x.id)), name: name.trim(), hex: "#808080", available: true });
                        });
                      }}
                    >
                      <Plus className="w-4 h-4" /> Agregar color
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  const name = window.prompt("Nombre del material (ej. PLA Silk)");
                  if (!name?.trim()) return;
                  edit((d) => {
                    d.materials.push({
                      id: uniqueId(slug(name).toUpperCase(), d.materials.map((x) => x.id)),
                      name: name.trim(), description: "", active: false,
                      price_per_kg: 25000, density: 1.24, waste: 0.05, surcharge: 0, colors: [],
                    });
                  });
                }}
              >
                <Plus className="w-4 h-4" /> Agregar material
              </button>
            </Section>

            {/* ── Usos ── */}
            <Section title="Usos" hint="El cliente elige el uso y le recomendamos material y calidad. El relleno sólo afecta el precio.">
              {p.uses.map((u, ui) => (
                <div key={u.id} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                  <Text label="Nombre" value={u.name} onChange={(v) => edit((d) => { d.uses[ui].name = v; })} />
                  <Text label="Descripción" value={u.description} onChange={(v) => edit((d) => { d.uses[ui].description = v; })} />
                  <Num label="Relleno" pct value={u.infill} onChange={(v) => edit((d) => { d.uses[ui].infill = v; })} />
                  <label className="space-y-1 text-sm block">
                    <span className={mutedCls}>Material</span>
                    <select className={inputCls} value={u.material} onChange={(e) => edit((d) => { d.uses[ui].material = e.target.value; })}>
                      {p.materials.map((m) => <option key={m.id} value={m.id}>{m.name}{m.active ? "" : " (inactivo)"}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm block">
                    <span className={mutedCls}>Calidad</span>
                    <select className={inputCls} value={u.quality} onChange={(e) => edit((d) => { d.uses[ui].quality = e.target.value; })}>
                      {p.qualities.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                    </select>
                  </label>
                </div>
              ))}
            </Section>

            {/* ── Calidades ── */}
            <Section title="Calidades" hint="Ordenadas de menor a mayor: la sugerencia de ahorro baja un escalón.">
              {p.qualities.map((q, qi) => (
                <div key={q.id} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Text label="Nombre" value={q.name} onChange={(v) => edit((d) => { d.qualities[qi].name = v; })} />
                  <Text label="Descripción" value={q.description} onChange={(v) => edit((d) => { d.qualities[qi].description = v; })} />
                  <Num label="Caudal (cm³/h)" value={q.speed_cm3_h} onChange={(v) => edit((d) => { d.qualities[qi].speed_cm3_h = v; })} />
                  <Num label="Altura de capa (mm)" value={q.layer_height} onChange={(v) => edit((d) => { d.qualities[qi].layer_height = v; })} />
                </div>
              ))}
            </Section>

            {/* ── Soportes ── */}
            <Section title="Soportes" hint="Sin dato del cliente se asume “Pocos”.">
              {p.supports.map((s, si) => (
                <div key={s.id} className="grid grid-cols-3 gap-3">
                  <Text label="Nombre" value={s.name} onChange={(v) => edit((d) => { d.supports[si].name = v; })} />
                  <Num label="Material extra" pct value={s.extra} onChange={(v) => edit((d) => { d.supports[si].extra = v; })} />
                  <Num label="Post-proceso (min/u.)" value={s.post_min} onChange={(v) => edit((d) => { d.supports[si].post_min = v; })} />
                </div>
              ))}
            </Section>

            {/* ── Precio y cobro ── */}
            <Section title="Precio y cobro">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Num label="Markup sobre costo" pct value={p.markup} onChange={(v) => edit((d) => { d.markup = v; })} />
                <Num label="Pedido mínimo ($)" value={p.min_order} onChange={(v) => edit((d) => { d.min_order = v; })} />
                <Num label="Hora de trabajo ($)" value={p.labor_per_h} onChange={(v) => edit((d) => { d.labor_per_h = v; })} />
                <Num label="Preparación por pedido (min)" value={p.prep_minutes_per_order} onChange={(v) => edit((d) => { d.prep_minutes_per_order = v; })} />
                <Num label="Recargo prioridad" pct value={p.priority_surcharge} onChange={(v) => edit((d) => { d.priority_surcharge = v; })} />
                <Num label="Descuento transferencia" pct value={p.transfer_discount} onChange={(v) => edit((d) => { d.transfer_discount = v; })} />
                <Num label="Cuotas" step={1} value={p.installments.count} onChange={(v) => edit((d) => { d.installments.count = Math.round(v); })} />
                <Num label="Recargo cuotas" pct value={p.installments.surcharge} onChange={(v) => edit((d) => { d.installments.surcharge = v; })} />
                <Num label="Tope garantizado" pct value={p.price_cap} onChange={(v) => edit((d) => { d.price_cap = v; })} />
                <Num label="Vigencia (días)" step={1} value={p.validity_days} onChange={(v) => edit((d) => { d.validity_days = Math.round(v); })} />
                <Num label="Redondeo ($)" step={1} value={p.rounding} onChange={(v) => edit((d) => { d.rounding = Math.round(v); })} />
                <Num label="IVA" pct value={p.vat.rate} onChange={(v) => edit((d) => { d.vat.rate = v; })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={p.vat.enabled} onChange={(e) => edit((d) => { d.vat.enabled = e.target.checked; })} />
                Sumar IVA al precio
              </label>
            </Section>

            {/* ── Cantidad ── */}
            <Section title="Descuentos por cantidad" hint="Se aplica el del mayor escalón alcanzado.">
              {p.quantity_tiers.map((t, ti) => (
                <div key={ti} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <Num label="Desde (u.)" step={1} value={t.from} onChange={(v) => edit((d) => { d.quantity_tiers[ti].from = Math.round(v); })} />
                  <Num label="Descuento" pct value={t.discount} onChange={(v) => edit((d) => { d.quantity_tiers[ti].discount = v; })} />
                  <button type="button" className="p-2.5 text-gray-400 hover:text-red-600" aria-label="Borrar escalón"
                    onClick={() => edit((d) => { d.quantity_tiers.splice(ti, 1); })}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" className={btnGhost} onClick={() => edit((d) => { d.quantity_tiers.push({ from: 50, discount: 0.3 }); })}>
                <Plus className="w-4 h-4" /> Agregar escalón
              </button>
            </Section>

            {/* ── Máquina ── */}
            <Section title="Máquina">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Num label="Precio impresora ($)" value={p.machine.printer_price} onChange={(v) => edit((d) => { d.machine.printer_price = v; })} />
                <Num label="Vida útil (h)" value={p.machine.lifetime_h} onChange={(v) => edit((d) => { d.machine.lifetime_h = v; })} />
                <Num label="Consumo (kW)" value={p.machine.power_kw} onChange={(v) => edit((d) => { d.machine.power_kw = v; })} />
                <Num label="Precio kWh ($)" value={p.machine.kwh_price} onChange={(v) => edit((d) => { d.machine.kwh_price = v; })} />
                <Num label="Mantenimiento por hora ($)" value={p.machine.maintenance_per_h} onChange={(v) => edit((d) => { d.machine.maintenance_per_h = v; })} />
                <Num label="Tasa de fallas" pct value={p.machine.failure_rate} onChange={(v) => edit((d) => { d.machine.failure_rate = v; })} />
              </div>
            </Section>

            {/* ── Perfil ── */}
            <Section title="Perfil de impresión" hint="Modelo de cáscara: paredes y capas sólidas. La fracción de pared sólo se usa si la web no manda áreas.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Num label="Perímetros" step={1} value={p.shell.wall_loops} onChange={(v) => edit((d) => { d.shell.wall_loops = Math.round(v); })} />
                <Num label="Ancho línea externa (mm)" value={p.shell.outer_wall_line_width} onChange={(v) => edit((d) => { d.shell.outer_wall_line_width = v; })} />
                <Num label="Ancho línea interna (mm)" value={p.shell.inner_wall_line_width} onChange={(v) => edit((d) => { d.shell.inner_wall_line_width = v; })} />
                <Num label="Capas sólidas arriba" step={1} value={p.shell.top_shell_layers} onChange={(v) => edit((d) => { d.shell.top_shell_layers = Math.round(v); })} />
                <Num label="Capas sólidas abajo" step={1} value={p.shell.bottom_shell_layers} onChange={(v) => edit((d) => { d.shell.bottom_shell_layers = Math.round(v); })} />
                <Num label="Fracción de pared (referencia)" pct value={p.wall_fraction} onChange={(v) => edit((d) => { d.wall_fraction = v; })} />
              </div>
            </Section>

            {/* ── Límites ── */}
            <Section title="Límites" hint="Lo que no entra o supera la cantidad de revisión pasa a cotización manual.">
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <Num key={i} label={["Ancho máx. (mm)", "Prof. máx. (mm)", "Alto máx. (mm)"][i]} value={p.printer_max_mm[i]}
                    onChange={(v) => edit((d) => { d.printer_max_mm[i] = v; })} />
                ))}
                <Num label="Revisión manual desde (u.)" step={1} value={p.manual_review_from_qty} onChange={(v) => edit((d) => { d.manual_review_from_qty = Math.round(v); })} />
                <Num label="Cantidad máxima" step={1} value={p.limits.max_quantity} onChange={(v) => edit((d) => { d.limits.max_quantity = Math.round(v); })} />
                <Num label="Volumen máximo (cm³)" value={p.limits.max_volume_cm3} onChange={(v) => edit((d) => { d.limits.max_volume_cm3 = v; })} />
              </div>
            </Section>

            {/* ── Horario ── */}
            <Section title="Horario de confirmación" hint="Define el “te confirmamos antes de…” que ve el cliente.">
              <div className="flex flex-wrap gap-3">
                {DAYS.map((label, day) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={p.business_hours.days.includes(day)}
                      onChange={(e) => edit((d) => {
                        const days = new Set(d.business_hours.days);
                        if (e.target.checked) days.add(day); else days.delete(day);
                        d.business_hours.days = [...days].sort();
                      })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="space-y-1 text-sm block">
                  <span className={mutedCls}>Desde</span>
                  <input type="time" className={inputCls} value={p.business_hours.from} onChange={(e) => edit((d) => { d.business_hours.from = e.target.value; })} />
                </label>
                <label className="space-y-1 text-sm block">
                  <span className={mutedCls}>Hasta</span>
                  <input type="time" className={inputCls} value={p.business_hours.to} onChange={(e) => edit((d) => { d.business_hours.to = e.target.value; })} />
                </label>
                <Num label="Confirmar en (h hábiles)" value={p.business_hours.confirm_within_h} onChange={(v) => edit((d) => { d.business_hours.confirm_within_h = v; })} />
              </div>
            </Section>

            {data && data.versions.length > 0 && (
              <Section title="Historial de versiones">
                {data.versions.map((v) => (
                  <div key={v.version} className="flex justify-between text-sm">
                    <span className="text-gray-900 dark:text-white">v{v.version}{v.active ? " · activa" : ""}</span>
                    <span className={mutedCls}>{new Date(v.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</span>
                  </div>
                ))}
              </Section>
            )}

            <div className="fixed bottom-0 inset-x-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-800">
              <div className="max-w-3xl mx-auto flex items-center justify-end gap-3">
                {dirty && <span className={`text-sm ${mutedCls}`}>Cambios sin guardar</span>}
                <button type="button" className={btnPrimary} disabled={!dirty || saving} onClick={save}>
                  <Save className="w-4 h-4" /> {saving ? "Guardando…" : "Guardar versión nueva"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
