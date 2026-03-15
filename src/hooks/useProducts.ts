import { useState, useEffect, useCallback } from "react";
import { Product } from "@/types";
import { getProducts, deleteProduct, duplicateProduct } from "@/lib/firestore";
import toast from "react-hot-toast";

export function useProducts(uid: string | undefined) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const data = await getProducts(uid);
      setProducts(data);
    } catch {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const remove = async (productId: string) => {
    if (!uid) return;
    try {
      await deleteProduct(uid, productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      toast.success("Producto eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const duplicate = async (product: Product) => {
    if (!uid) return;
    try {
      const newId = await duplicateProduct(uid, product);
      await fetchProducts();
      toast.success("Producto duplicado");
      return newId;
    } catch {
      toast.error("Error al duplicar");
    }
  };

  return { products, loading, refetch: fetchProducts, remove, duplicate };
}
