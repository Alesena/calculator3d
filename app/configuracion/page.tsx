"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { AppShell } from "@/components/layout/AppShell";
import { UserSettings } from "@/types";
import { LogOut, Save } from "lucide-react";

const schema = z.object({
  electricityPrice: z.coerce.number().min(1, "Requerido"),
  printerWatts: z.coerce.number().min(1, "Requerido"),
  profitPercentage: z.coerce.number().min(0).max(99),
  vidaUtilHoras: z.coerce.number().min(1),
  precioRepuestos: z.coerce.number().min(0),
  margenErrorPct: z.coerce.number().min(0).max(100),
  packaging: z.coerce.number().min(0),
});

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-shadow";

const fields: { key: Extract<keyof UserSettings, string>; label: string; unit: string; placeholder: string }[] = [
  { key: "electricityPrice", label: "Precio del kWh", unit: "$/kWh", placeholder: "45" },
  { key: "printerWatts", label: "Consumo de la impresora", unit: "W", placeholder: "200" },
  { key: "vidaUtilHoras", label: "Vida útil de la impresora", unit: "h", placeholder: "4320" },
  { key: "precioRepuestos", label: "Costo total de repuestos/mantenimiento", unit: "$", placeholder: "15000" },
  { key: "packaging", label: "Packaging por unidad", unit: "$/ud", placeholder: "2300" },
  { key: "margenErrorPct", label: "Margen de error predeterminado", unit: "%", placeholder: "10" },
  { key: "profitPercentage", label: "Margen de ganancia predeterminado", unit: "%", placeholder: "30" },
];

export default function ConfiguracionPage() {
  const { user, logout } = useAuth();
  const { settings, loading, save } = useSettings(user?.uid);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UserSettings>({
    resolver: zodResolver(schema) as import("react-hook-form").Resolver<UserSettings>,
    defaultValues: settings,
  });

  useEffect(() => {
    reset(settings);
  }, [settings, reset]);

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Configuración</h1>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Valores por defecto</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Se precargan automáticamente en la calculadora para ahorrarte tiempo.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit(save)} className="space-y-4">
              {fields.map(({ key, label, unit, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {label}
                  </label>
                  <div className="relative">
                    <input
                      {...register(key)}
                      type="number"
                      min="0"
                      placeholder={placeholder}
                      className={inputCls + " pr-14"}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      {unit}
                    </span>
                  </div>
                  {errors[key] && (
                    <p className="text-xs text-red-500">{errors[key]?.message}</p>
                  )}
                </div>
              ))}
              <button
                type="submit"
                disabled={!isDirty || isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Cuenta</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all"
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </div>
    </AppShell>
  );
}
