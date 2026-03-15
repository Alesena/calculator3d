"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { AppShell } from "@/components/layout/AppShell";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductCardSkeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import { formatARS, formatHours } from "@/lib/calculations";
import { Plus } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { products, loading, remove, duplicate } = useProducts(user?.uid);

  const totalHours = products.reduce(
    (acc: number, p) => acc + p.printTimeHours + p.printTimeMinutes / 60,
    0
  );
  const stats = {
    total: products.length,
    totalHours,
    totalMaterial: products.reduce((acc: number, p) => acc + p.filamentWeight, 0) / 1000,
    avgPrice: products.length
      ? products.reduce((acc: number, p) => acc + p.calculatedPrices.precioConMarkup, 0) / products.length
      : 0,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              Hola, {user?.displayName?.split(" ")[0]} 👋
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {products.length > 0
                ? `Tenés ${products.length} producto${products.length !== 1 ? "s" : ""} guardado${products.length !== 1 ? "s" : ""}`
                : "Empezá calculando tu primera pieza"}
            </p>
          </div>
          <Link
            href="/calculadora"
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo cálculo
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard label="Productos" value={String(stats.total)} />
              <StatCard
                label="Tiempo total"
                value={formatHours(Math.floor(stats.totalHours), Math.round((stats.totalHours % 1) * 60))}
              />
              <StatCard label="Material usado" value={`${stats.totalMaterial.toFixed(2)} kg`} />
              <StatCard label="Precio promedio" value={formatARS(stats.avgPrice)} />
            </>
          )}
        </div>

        {/* Products */}
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white mb-3">Tus productos</h2>

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onDelete={remove} onDuplicate={(prod) => void duplicate(prod)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="text-7xl">🖨️</div>
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Nada por aquí todavía</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Calculá el costo de tu primera pieza y guardala acá
        </p>
      </div>
      <Link
        href="/calculadora"
        className="mt-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl active:scale-95 transition-all"
      >
        Hacer mi primer cálculo
      </Link>
    </div>
  );
}
