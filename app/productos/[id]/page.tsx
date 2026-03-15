"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getProduct, deleteProduct, duplicateProduct } from "@/lib/firestore";
import { Product } from "@/types";
import { AppShell } from "@/components/layout/AppShell";
import { PriceBreakdown } from "@/components/products/PriceBreakdown";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatHours } from "@/lib/calculations";
import { ArrowLeft, Pencil, Trash2, Copy, Share2 } from "lucide-react";
import toast from "react-hot-toast";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    getProduct(user.uid, id)
      .then(setProduct)
      .catch(() => toast.error("Producto no encontrado"))
      .finally(() => setLoading(false));
  }, [user, id]);

  const handleDelete = async () => {
    if (!user || !id) return;
    try {
      await deleteProduct(user.uid, id);
      toast.success("Producto eliminado");
      router.push("/dashboard");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const handleDuplicate = async () => {
    if (!user || !product) return;
    try {
      const newId = await duplicateProduct(user.uid, product);
      toast.success("Producto duplicado");
      router.push(`/productos/${newId}`);
    } catch {
      toast.error("Error al duplicar");
    }
  };

  const handleShare = () => {
    if (!product) return;
    const precio = product.calculatedPrices.precioConMarkup;
    const msg = `🖨️ *${product.name}*\n💰 Precio: ${precio.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}\n⏱️ Tiempo: ${formatHours(product.printTimeHours, product.printTimeMinutes)} × ${product.cantidad} und.\n🎨 Material: ${product.filamentType}`;
    if (navigator.share) {
      navigator.share({ text: msg });
    } else {
      navigator.clipboard.writeText(msg);
      toast.success("Copiado al portapapeles");
    }
  };

  const filamentLabel =
    product?.filamentType === "Otro" && product.filamentTypeCustom
      ? product.filamentTypeCustom
      : product?.filamentType;

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl text-gray-500 hover:bg-white dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1 truncate">
            {loading ? <Skeleton className="h-6 w-40 inline-block" /> : product?.name}
          </h1>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : product ? (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 text-sm">
              {product.description && (
                <p className="text-gray-500 dark:text-gray-400 mb-3">{product.description}</p>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-500 dark:text-gray-400">
                <span>🎨 {filamentLabel} · {product.filamentWeight}g/ud</span>
                <span>📦 {product.cantidad} unidad{product.cantidad !== 1 ? "es" : ""}</span>
                <span>⏱️ {formatHours(product.printTimeHours, product.printTimeMinutes)}/ud</span>
                <span>📅 {product.createdAt.toLocaleDateString("es-AR")}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Desglose de costos</h2>
              <PriceBreakdown
                prices={product.calculatedPrices}
                cantidad={product.cantidad}
                filamentWeight={product.filamentWeight}
                filamentType={filamentLabel}
                profitPercentage={product.profitPercentage}
                margenErrorPct={product.margenErrorPct}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/calculadora?edit=${product.id}`}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
              >
                <Pencil className="w-4 h-4" /> Editar
              </Link>
              <button
                onClick={handleDuplicate}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
              >
                <Copy className="w-4 h-4" /> Duplicar
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-sm font-medium text-white active:scale-95 transition-all"
              >
                <Share2 className="w-4 h-4" /> Compartir
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium text-white active:scale-95 transition-all"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </>
        ) : (
          <p className="text-center text-gray-500 py-12">Producto no encontrado</p>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title="Eliminar producto"
          description={`¿Seguro que querés eliminar "${product?.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </AppShell>
  );
}
