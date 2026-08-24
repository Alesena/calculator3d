import { useState, useEffect, useCallback } from "react";
import { Category } from "@/types";
import {
  getCategories,
  createCategory,
  renameCategory,
  deleteCategory,
} from "@/lib/firestore";
import toast from "react-hot-toast";

function norm(name: string) {
  return name.trim().toLocaleLowerCase("es-AR");
}

export function useCategories(uid: string | undefined) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      setCategories(await getCategories(uid));
    } catch {
      toast.error("Error al cargar categorías");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  /** Devuelve el id de la categoría creada, o null si el nombre no sirve. */
  const create = async (name: string): Promise<string | null> => {
    if (!uid) return null;
    const clean = name.trim();
    if (!clean) {
      toast.error("Poné un nombre");
      return null;
    }
    const dup = categories.find((c) => norm(c.name) === norm(clean));
    if (dup) {
      toast.error(`Ya existe "${dup.name}"`);
      return null;
    }
    try {
      const id = await createCategory(uid, clean);
      // Insertamos ordenado por nombre, igual que viene de Firestore, para no
      // hacer un refetch entero por una categoría.
      setCategories((prev) =>
        [...prev, { id, name: clean, createdAt: new Date(), updatedAt: new Date() }].sort((a, b) =>
          a.name.localeCompare(b.name, "es-AR")
        )
      );
      toast.success(`Categoría "${clean}" creada`);
      return id;
    } catch {
      toast.error("Error al crear la categoría");
      return null;
    }
  };

  const rename = async (categoryId: string, name: string): Promise<boolean> => {
    if (!uid) return false;
    const clean = name.trim();
    if (!clean) {
      toast.error("Poné un nombre");
      return false;
    }
    const dup = categories.find((c) => c.id !== categoryId && norm(c.name) === norm(clean));
    if (dup) {
      toast.error(`Ya existe "${dup.name}"`);
      return false;
    }
    try {
      await renameCategory(uid, categoryId, clean);
      setCategories((prev) =>
        prev
          .map((c) => (c.id === categoryId ? { ...c, name: clean } : c))
          .sort((a, b) => a.name.localeCompare(b.name, "es-AR"))
      );
      toast.success("Categoría renombrada");
      return true;
    } catch {
      toast.error("Error al renombrar");
      return false;
    }
  };

  const remove = async (categoryId: string): Promise<boolean> => {
    if (!uid) return false;
    try {
      const sueltos = await deleteCategory(uid, categoryId);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      toast.success(
        sueltos > 0
          ? `Categoría eliminada — ${sueltos} producto${sueltos !== 1 ? "s" : ""} sin categoría`
          : "Categoría eliminada"
      );
      return true;
    } catch {
      toast.error("Error al eliminar la categoría");
      return false;
    }
  };

  return { categories, loading, refetch: fetchCategories, create, rename, remove };
}
