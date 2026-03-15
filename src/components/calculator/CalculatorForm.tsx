"use client";

import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserSettings, FilamentType, CalculationParams } from "@/types";
import { ChevronDown } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  cantidad: z.coerce.number().min(1, "Mínimo 1 unidad"),
  printTimeHours: z.coerce.number().min(0),
  printTimeMinutes: z.coerce.number().min(0).max(59),
  filamentWeight: z.coerce.number().min(0.1, "Ingresa el peso del filamento"),
  filamentType: z.enum(["PLA", "PETG", "ABS", "TPU", "Resina", "Otro"]),
  filamentTypeCustom: z.string().optional(),
  filamentPricePerKg: z.coerce.number().min(1, "Ingresa el precio del filamento"),
  printerWatts: z.coerce.number().min(1),
  electricityPrice: z.coerce.number().min(1),
  vidaUtilHoras: z.coerce.number().min(1),
  precioRepuestos: z.coerce.number().min(0),
  packaging: z.coerce.number().min(0),
  margenErrorPct: z.coerce.number().min(0).max(100),
  profitPercentage: z.coerce.number().min(0).max(99),
  shippingCost: z.coerce.number().min(0),
});

export type CalculatorFormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<CalculatorFormData>;
  settings: UserSettings;
  onCalculate: (data: CalculatorFormData) => void;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-shadow";

const section =
  "bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4";

export function CalculatorForm({ defaultValues, settings, onCalculate }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CalculatorFormData>({
    resolver: zodResolver(schema) as Resolver<CalculatorFormData>,
    defaultValues: {
      cantidad: 1,
      printTimeHours: 0,
      printTimeMinutes: 0,
      filamentType: "PLA",
      printerWatts: settings.printerWatts,
      electricityPrice: settings.electricityPrice,
      vidaUtilHoras: settings.vidaUtilHoras,
      precioRepuestos: settings.precioRepuestos,
      packaging: settings.packaging,
      margenErrorPct: settings.margenErrorPct,
      profitPercentage: settings.profitPercentage,
      shippingCost: 0,
      ...defaultValues,
    },
  });

  const filamentType = watch("filamentType");

  return (
    <form onSubmit={handleSubmit(onCalculate)} className="space-y-4">
      {/* Básicos */}
      <div className={section}>
        <h2 className="font-semibold text-gray-900 dark:text-white">🧩 Datos del producto</h2>
        <Field label="Nombre del producto" error={errors.name?.message}>
          <input {...register("name")} placeholder="Ej: Maceta hexagonal" className={inputCls} />
        </Field>
        <Field label="Descripción (opcional)">
          <input {...register("description")} placeholder="Ej: Para interior, diseño moderno" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad (unidades)" error={errors.cantidad?.message}>
            <input {...register("cantidad")} type="number" min="1" placeholder="1" className={inputCls} />
          </Field>
          <Field label="Tiempo por unidad" error={errors.printTimeHours?.message}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input {...register("printTimeHours")} type="number" min="0" placeholder="0" className={inputCls} />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">h</span>
              </div>
              <div className="relative flex-1">
                <input {...register("printTimeMinutes")} type="number" min="0" max="59" placeholder="0" className={inputCls} />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
              </div>
            </div>
          </Field>
        </div>
      </div>

      {/* Material */}
      <div className={section}>
        <h2 className="font-semibold text-gray-900 dark:text-white">🎨 Material</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de filamento">
            <div className="relative">
              <select {...register("filamentType")} className={inputCls + " appearance-none pr-8"}>
                {(["PLA", "PETG", "ABS", "TPU", "Resina", "Otro"] as FilamentType[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </Field>
          <Field label="Peso por unidad (g)" error={errors.filamentWeight?.message}>
            <input {...register("filamentWeight")} type="number" min="0" step="0.1" placeholder="146" className={inputCls} />
          </Field>
        </div>
        {filamentType === "Otro" && (
          <Field label="Especificar material">
            <input {...register("filamentTypeCustom")} placeholder="Ej: Nylon, Madera..." className={inputCls} />
          </Field>
        )}
        <Field label="Precio del rollo ($/kg)" error={errors.filamentPricePerKg?.message}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
            <input {...register("filamentPricePerKg")} type="number" min="0" placeholder="22500" className={inputCls + " pl-6"} />
          </div>
        </Field>
      </div>

      {/* Electricidad */}
      <div className={section}>
        <h2 className="font-semibold text-gray-900 dark:text-white">⚡ Electricidad</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Consumo impresora (W)">
            <input {...register("printerWatts")} type="number" min="0" placeholder="200" className={inputCls} />
          </Field>
          <Field label="Precio kWh ($)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input {...register("electricityPrice")} type="number" min="0" placeholder="45" className={inputCls + " pl-6"} />
            </div>
          </Field>
        </div>
      </div>

      {/* Mantenimiento */}
      <div className={section}>
        <h2 className="font-semibold text-gray-900 dark:text-white">🔧 Repuestos y mantenimiento</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          El costo de repuestos se distribuye proporcionalmente según las horas de uso vs la vida útil de la impresora.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vida útil impresora (h)">
            <input {...register("vidaUtilHoras")} type="number" min="1" placeholder="4320" className={inputCls} />
          </Field>
          <Field label="Costo repuestos/mantenimiento ($)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input {...register("precioRepuestos")} type="number" min="0" placeholder="15000" className={inputCls + " pl-6"} />
            </div>
          </Field>
        </div>
      </div>

      {/* Ganancia y costos */}
      <div className={section}>
        <h2 className="font-semibold text-gray-900 dark:text-white">💰 Costos adicionales y ganancia</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Packaging por unidad ($)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input {...register("packaging")} type="number" min="0" placeholder="2300" className={inputCls + " pl-6"} />
            </div>
          </Field>
          <Field label="Envío ($)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input {...register("shippingCost")} type="number" min="0" placeholder="0" className={inputCls + " pl-6"} />
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Margen de error (%)" error={errors.margenErrorPct?.message}>
            <div className="relative">
              <input {...register("margenErrorPct")} type="number" min="0" max="100" placeholder="10" className={inputCls + " pr-7"} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
            </div>
          </Field>
          <Field label="Margen de ganancia (%)" error={errors.profitPercentage?.message}>
            <div className="relative">
              <input {...register("profitPercentage")} type="number" min="0" max="99" placeholder="30" className={inputCls + " pr-7"} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
            </div>
          </Field>
        </div>
      </div>

      <button
        type="submit"
        className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-base rounded-2xl shadow-lg shadow-orange-200 dark:shadow-orange-900/30 transition-all duration-150"
      >
        Calcular precio →
      </button>
    </form>
  );
}
