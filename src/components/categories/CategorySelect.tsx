"use client";

import { useState } from "react";
import { Category } from "@/types";
import { ChevronDown, FolderPlus } from "lucide-react";
import { PromptDialog } from "@/components/ui/PromptDialog";

interface Props {
  categories: Category[];
  loading?: boolean;
  value?: string;
  onChange: (categoryId: string | undefined) => void;
  /** Crea la categoría y devuelve su id, o null si el nombre fue rechazado. */
  onCreate: (name: string) => Promise<string | null>;
  className?: string;
}

/**
 * Select de categoría con creación al vuelo: si el usuario todavía no tiene
 * ninguna, la crea desde acá sin salir del cálculo.
 */
export function CategorySelect({
  categories,
  loading,
  value,
  onChange,
  onCreate,
  className = "",
}: Props) {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className={`flex gap-2 ${className}`}>
        <div className="relative flex-1">
          <select
            value={value ?? ""}
            disabled={loading}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-shadow disabled:opacity-60"
          >
            <option value="">{loading ? "Cargando..." : "Sin categoría"}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          title="Nueva categoría"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all shrink-0"
        >
          <FolderPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva</span>
        </button>
      </div>

      <PromptDialog
        open={creating}
        title="Nueva categoría"
        description="Agrupá tus productos para encontrarlos más rápido en el dashboard."
        label="Nombre"
        placeholder="Ej: Llaveros"
        confirmLabel="Crear"
        onCancel={() => setCreating(false)}
        onConfirm={async (name) => {
          const id = await onCreate(name);
          if (id) {
            onChange(id);
            setCreating(false);
          }
        }}
      />
    </>
  );
}
