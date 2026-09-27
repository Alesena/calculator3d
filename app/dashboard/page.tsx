"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { AppShell } from "@/components/layout/AppShell";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductCardSkeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { formatARS, formatDecimalHours } from "@/lib/calculations";
import { Category, Product } from "@/types";
import { ArrowLeft, ChevronRight, FolderPlus, Package, Pencil, Plus, Trash2 } from "lucide-react";

/** Id sintético para el grupo de los productos que no tienen categoría. */
const SIN_CATEGORIA = "none";

function DashboardContent() {
  const { user } = useAuth();
  const { products, loading, remove, duplicate, refetch } = useProducts(user?.uid);
  const {
    categories,
    loading: categoriesLoading,
    create,
    rename,
    remove: removeCategory,
  } = useCategories(user?.uid);

  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("cat");

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const nameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Los productos de una categoría borrada quedan sueltos, y los guardados
  // antes de que existieran las categorías tampoco tienen una.
  const groupOf = (p: Product) =>
    p.categoryId && nameById.has(p.categoryId) ? p.categoryId : SIN_CATEGORIA;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => {
      const g = p.categoryId && nameById.has(p.categoryId) ? p.categoryId : SIN_CATEGORIA;
      m.set(g, (m.get(g) ?? 0) + 1);
    });
    return m;
  }, [products, nameById]);

  const selected: Category | { id: string; name: string } | null =
    selectedId === SIN_CATEGORIA
      ? { id: SIN_CATEGORIA, name: "Sin categoría" }
      : categories.find((c) => c.id === selectedId) ?? null;

  const visible = selectedId ? products.filter((p) => groupOf(p) === selectedId) : products;

  // Si el ?cat= apunta a algo que ya no existe, lo decimos en vez de mostrar
  // una pantalla vacía sin explicación.
  const catNotFound = !!selectedId && !selected && !categoriesLoading;

  const stats = useMemo(() => {
    const totalHours = visible.reduce(
      (acc, p) => acc + p.printTimeHours + p.printTimeMinutes / 60,
      0
    );
    return {
      total: visible.length,
      totalHours,
      totalMaterial: visible.reduce((acc, p) => acc + p.filamentWeight, 0) / 1000,
      avgPrice: visible.length
        ? visible.reduce((acc, p) => acc + p.calculatedPrices.precioConMarkup, 0) / visible.length
        : 0,
    };
  }, [visible]);

  const busy = loading || categoriesLoading;
  const selectedCount = counts.get(selected?.id ?? "") ?? 0;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        {selected ? (
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl text-gray-500 hover:bg-white dark:hover:bg-gray-800 transition-colors shrink-0"
              title="Todas las categorías"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-gray-900 dark:text-white truncate">
                {selected.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {visible.length} producto{visible.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        ) : (
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
        )}

        <div className="flex items-center gap-1 shrink-0">
          {selected && selected.id !== SIN_CATEGORIA && (
            <>
              <button
                onClick={() => setRenaming(true)}
                title="Renombrar categoría"
                className="p-2.5 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors active:scale-95"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleting(true)}
                title="Eliminar categoría"
                className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <Link
            href={
              selected && selected.id !== SIN_CATEGORIA
                ? `/calculadora?cat=${selected.id}`
                : "/calculadora"
            }
            className="hidden sm:flex items-center gap-2 ml-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo cálculo
          </Link>
        </div>
      </div>

      {catNotFound && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-sm text-gray-500 dark:text-gray-400">
          Esa categoría ya no existe.{" "}
          <Link href="/dashboard" className="text-orange-600 dark:text-orange-400 font-medium">
            Volver al dashboard
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {busy ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Productos" value={String(stats.total)} />
            <StatCard label="Tiempo total" value={formatDecimalHours(stats.totalHours)} />
            <StatCard label="Material usado" value={`${stats.totalMaterial.toFixed(2)} kg`} />
            <StatCard label="Precio promedio" value={formatARS(stats.avgPrice)} />
          </>
        )}
      </div>

      {/* Vista general: sólo categorías. Los productos se ven al entrar en una. */}
      {!selectedId ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 dark:text-white">Categorías</h2>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 active:scale-95 transition-all"
            >
              <FolderPlus className="w-4 h-4" />
              Nueva
            </button>
          </div>

          {busy ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          ) : categories.length === 0 && !counts.get(SIN_CATEGORIA) ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map((c) => (
                <CategoryTile
                  key={c.id}
                  name={c.name}
                  count={counts.get(c.id) ?? 0}
                  href={`/dashboard?cat=${c.id}`}
                />
              ))}
              {/* Los productos sin categoría necesitan una puerta de entrada:
                  si no, quedan invisibles en el dashboard. */}
              {(counts.get(SIN_CATEGORIA) ?? 0) > 0 && (
                <CategoryTile
                  name="Sin categoría"
                  count={counts.get(SIN_CATEGORIA) ?? 0}
                  href={`/dashboard?cat=${SIN_CATEGORIA}`}
                  muted
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white mb-3">Productos</h2>

          {busy ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              categoryId={selected && selected.id !== SIN_CATEGORIA ? selected.id : undefined}
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {visible.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onDelete={remove}
                  onDuplicate={(prod) => void duplicate(prod)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diálogos de categoría */}
      <PromptDialog
        open={creating}
        title="Nueva categoría"
        description="Agrupá tus productos para encontrarlos más rápido."
        label="Nombre"
        placeholder="Ej: Llaveros"
        confirmLabel="Crear"
        onCancel={() => setCreating(false)}
        onConfirm={async (name) => {
          if (await create(name)) setCreating(false);
        }}
      />

      <PromptDialog
        open={renaming}
        title="Renombrar categoría"
        label="Nombre"
        initialValue={selected?.name ?? ""}
        onCancel={() => setRenaming(false)}
        onConfirm={async (name) => {
          if (selected && (await rename(selected.id, name))) setRenaming(false);
        }}
      />

      <ConfirmDialog
        open={deleting}
        title={`Eliminar "${selected?.name ?? ""}"`}
        description={
          selectedCount > 0
            ? `Sus ${selectedCount} producto${selectedCount !== 1 ? "s" : ""} no se borran: quedan como "Sin categoría".`
            : "Esta categoría no tiene productos."
        }
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          setDeleting(false);
          if (!selected) return;
          if (await removeCategory(selected.id)) {
            await refetch();
            router.push("/dashboard");
          }
        }}
      />
    </div>
  );
}

function CategoryTile({
  name,
  count,
  href,
  muted,
}: {
  name: string;
  count: number;
  href: string;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
    >
      <div
        className={`p-2 rounded-xl shrink-0 ${
          muted
            ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            : "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
        }`}
      >
        <Package className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 dark:text-white truncate">{name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {count} producto{count !== 1 ? "s" : ""}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-orange-500 transition-colors shrink-0" />
    </Link>
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

function EmptyState({ categoryId }: { categoryId?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="text-7xl">🖨️</div>
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Nada por aquí todavía</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {categoryId
            ? "Esta categoría todavía no tiene productos"
            : "Calculá el costo de tu primera pieza y guardala acá"}
        </p>
      </div>
      <Link
        href={categoryId ? `/calculadora?cat=${categoryId}` : "/calculadora"}
        className="mt-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl active:scale-95 transition-all"
      >
        {categoryId ? "Calcular una pieza acá" : "Hacer mi primer cálculo"}
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </AppShell>
  );
}
