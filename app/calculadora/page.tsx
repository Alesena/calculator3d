"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { AppShell } from "@/components/layout/AppShell";
import { CalculatorForm, CalculatorFormData } from "@/components/calculator/CalculatorForm";
import { PriceBreakdown } from "@/components/products/PriceBreakdown";
import { calculatePrice } from "@/lib/calculations";
import { createProduct, updateProduct, getProduct } from "@/lib/firestore";
import { CalculatedPrices, CalculationParams } from "@/types";
import { ArrowLeft, Save, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

function CalculadoraContent() {
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = useSettings(user?.uid);
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [step, setStep] = useState<"form" | "result">("form");
  const [formData, setFormData] = useState<CalculatorFormData | null>(null);
  const [prices, setPrices] = useState<CalculatedPrices | null>(null);
  const [saving, setSaving] = useState(false);
  const [prefill, setPrefill] = useState<Partial<CalculatorFormData> | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  useEffect(() => {
    console.log("[Edit] editId:", editId, "| user:", user?.uid ?? "null");
    if (!editId || !user) {
      console.log("[Edit] abortando — falta editId o user");
      return;
    }
    console.log("[Edit] cargando producto", editId);
    getProduct(user.uid, editId)
      .then((p) => {
        console.log("[Edit] getProduct result:", p);
        if (!p) {
          console.warn("[Edit] producto no encontrado");
          return;
        }
        const fill = {
          name: p.name,
          description: p.description,
          cantidad: p.cantidad,
          printTimeHours: p.printTimeHours,
          printTimeMinutes: p.printTimeMinutes,
          filamentWeight: p.filamentWeight,
          filamentType: p.filamentType,
          filamentTypeCustom: p.filamentTypeCustom,
          filamentPricePerKg: p.filamentPricePerKg,
          printerWatts: p.printerWatts,
          electricityPrice: p.electricityPrice,
          vidaUtilHoras: p.vidaUtilHoras,
          precioRepuestos: p.precioRepuestos,
          packaging: p.packaging,
          margenErrorPct: p.margenErrorPct,
          profitPercentage: p.profitPercentage,
          shippingCost: p.shippingCost,
        };
        console.log("[Edit] setPrefill →", fill);
        setPrefill(fill);
      })
      .catch((err) => {
        console.error("[Edit] error en getProduct:", err);
      })
      .finally(() => {
        console.log("[Edit] loadingEdit = false");
        setLoadingEdit(false);
      });
  }, [editId, user]);

  const handleCalculate = (data: CalculatorFormData) => {
    const result = calculatePrice(data as CalculationParams);
    setFormData(data);
    setPrices(result);
    setStep("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    console.log("[Save] user:", user?.uid, "| editId:", editId, "| formData:", !!formData, "| prices:", !!prices);
    if (!user || !formData || !prices) return;
    setSaving(true);
    try {
      const params = formData as CalculationParams & { name: string; description?: string };
      if (editId) {
        console.log("[Save] updateProduct uid:", user.uid, "id:", editId);
        await updateProduct(user.uid, editId, params, prices);
        toast.success("Producto actualizado");
        router.push("/dashboard");
      } else {
        console.log("[Save] createProduct uid:", user.uid);
        const id = await createProduct(user.uid, params, prices);
        toast.success("Producto guardado");
        router.push(`/productos/${id}`);
      }
    } catch (err) {
      console.error("[Save] error:", err);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (settingsLoading || loadingEdit) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="p-2 rounded-xl text-gray-500 hover:bg-white dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {editId ? "Editar producto" : "Nueva pieza"}
        </h1>
      </div>

      {step === "form" ? (
        <CalculatorForm defaultValues={prefill ?? undefined} settings={settings} onCalculate={handleCalculate} />
      ) : (
        formData && prices && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="font-bold text-gray-900 dark:text-white">📋 {formData.name}</h2>
              <PriceBreakdown
                prices={prices}
                cantidad={formData.cantidad}
                filamentWeight={formData.filamentWeight}
                filamentType={formData.filamentType === "Otro" ? formData.filamentTypeCustom || "Otro" : formData.filamentType}
                profitPercentage={formData.profitPercentage}
                margenErrorPct={formData.margenErrorPct}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("form")}
                className="flex items-center gap-2 flex-1 justify-center py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Re-calcular
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 flex-1 justify-center py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-bold text-white active:scale-95 transition-all disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? "Guardando..." : editId ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default function CalculadoraPage() {
  return (
    <AppShell>
      <Suspense fallback={
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <CalculadoraContent />
      </Suspense>
    </AppShell>
  );
}
