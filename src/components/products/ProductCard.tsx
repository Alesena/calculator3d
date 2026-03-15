"use client";

import { useState } from "react";
import Link from "next/link";
import { Product } from "@/types";
import { formatARS, formatHours } from "@/lib/calculations";
import { Pencil, Trash2, Copy, ChevronRight } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Props {
  product: Product;
  onDelete: (id: string) => void;
  onDuplicate: (product: Product) => void;
}

const FILAMENT_COLORS: Record<string, string> = {
  PLA: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  PETG: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  ABS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  TPU: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  Resina: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400",
  Otro: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

export function ProductCard({ product, onDelete, onDuplicate }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filamentLabel = product.filamentType === "Otro" && product.filamentTypeCustom
    ? product.filamentTypeCustom
    : product.filamentType;

  return (
    <>
      <div className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {product.name}
            </h3>
            {product.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {product.description}
              </p>
            )}
          </div>
          <span className="text-lg font-bold text-orange-600 dark:text-orange-400 shrink-0">
            {formatARS(product.calculatedPrices.precioConMarkup)}
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${FILAMENT_COLORS[product.filamentType] ?? FILAMENT_COLORS.Otro}`}
          >
            {filamentLabel}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {formatHours(product.printTimeHours, product.printTimeMinutes)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 self-center">
            {product.createdAt.toLocaleDateString("es-AR")}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link
            href={`/productos/${product.id}`}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
          >
            Ver detalle <ChevronRight className="w-3 h-3" />
          </Link>
          <div className="flex-1" />
          <Link
            href={`/calculadora?edit=${product.id}`}
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors active:scale-95"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </Link>
          <button
            onClick={() => onDuplicate(product)}
            className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors active:scale-95"
            title="Duplicar"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Eliminar producto"
        description={`¿Seguro que quieres eliminar "${product.name}"? Esta acción no se puede deshacer.`}
        onConfirm={() => {
          setConfirmOpen(false);
          onDelete(product.id);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
