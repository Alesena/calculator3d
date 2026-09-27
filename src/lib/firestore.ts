import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  deleteField,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Category, Product, UserSettings, DEFAULT_SETTINGS, ProductInput, CalculatedPrices } from "@/types";

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getUserSettings(uid: string): Promise<UserSettings> {
  const ref = doc(db, "users", uid, "data", "settings");
  const snap = await getDoc(ref);
  if (!snap.exists()) return DEFAULT_SETTINGS;
  // Merge sobre los defaults: una cuenta creada antes de que existiera un campo
  // no lo tiene guardado y llegaría como undefined.
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<UserSettings>) };
}

export async function saveUserSettings(uid: string, settings: UserSettings): Promise<void> {
  const ref = doc(db, "users", uid, "data", "settings");
  await setDoc(ref, settings);
}

// ── Products ──────────────────────────────────────────────────────────────────

function toProduct(id: string, data: Record<string, unknown>): Product {
  return {
    ...data,
    id,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  } as Product;
}

export async function getProducts(uid: string): Promise<Product[]> {
  const ref = collection(db, "users", uid, "products");
  const q = query(ref, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toProduct(d.id, d.data() as Record<string, unknown>));
}

export async function getProduct(uid: string, productId: string): Promise<Product | null> {
  const ref = doc(db, "users", uid, "products", productId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toProduct(snap.id, snap.data() as Record<string, unknown>);
}

// Elimina campos undefined que Firestore rechaza
function cleanParams<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export async function createProduct(
  uid: string,
  params: ProductInput,
  calculatedPrices: CalculatedPrices
): Promise<string> {
  const now = new Date();
  const ref = collection(db, "users", uid, "products");
  const docRef = await addDoc(ref, {
    ...cleanParams(params),
    calculatedPrices,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  return docRef.id;
}

export async function updateProduct(
  uid: string,
  productId: string,
  params: ProductInput,
  calculatedPrices: CalculatedPrices
): Promise<void> {
  const ref = doc(db, "users", uid, "products", productId);
  await updateDoc(ref, {
    ...cleanParams(params),
    // cleanParams descarta el undefined, así que sacar la categoría de un
    // producto que ya la tenía necesita el borrado explícito.
    categoryId: params.categoryId ?? deleteField(),
    calculatedPrices,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(uid: string, productId: string): Promise<void> {
  const ref = doc(db, "users", uid, "products", productId);
  await deleteDoc(ref);
}

export async function duplicateProduct(uid: string, product: Product): Promise<string> {
  const { id, createdAt, updatedAt, ...data } = product;
  void id; void createdAt; void updatedAt;
  const now = new Date();
  const ref = collection(db, "users", uid, "products");
  const docRef = await addDoc(ref, {
    ...cleanParams(data),
    name: `${data.name} (copia)`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  return docRef.id;
}

// ── Categorías ────────────────────────────────────────────────────────────────

function toCategory(id: string, data: Record<string, unknown>): Category {
  return {
    id,
    name: (data.name as string) ?? "",
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  };
}

export async function getCategories(uid: string): Promise<Category[]> {
  const ref = collection(db, "users", uid, "categories");
  const snap = await getDocs(query(ref, orderBy("name")));
  return snap.docs.map((d) => toCategory(d.id, d.data() as Record<string, unknown>));
}

export async function createCategory(uid: string, name: string): Promise<string> {
  const ref = collection(db, "users", uid, "categories");
  const docRef = await addDoc(ref, {
    name: name.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function renameCategory(uid: string, categoryId: string, name: string): Promise<void> {
  const ref = doc(db, "users", uid, "categories", categoryId);
  await updateDoc(ref, { name: name.trim(), updatedAt: serverTimestamp() });
}

/**
 * Borra la categoría y deja sin categoría a sus productos. Los productos NO se
 * borran: la categoría es una etiqueta, no un contenedor.
 * Devuelve cuántos productos quedaron sueltos.
 */
export async function deleteCategory(uid: string, categoryId: string): Promise<number> {
  const products = await getDocs(
    query(collection(db, "users", uid, "products"), where("categoryId", "==", categoryId))
  );
  const batch = writeBatch(db);
  products.docs.forEach((d) => batch.update(d.ref, { categoryId: deleteField() }));
  batch.delete(doc(db, "users", uid, "categories", categoryId));
  await batch.commit();
  return products.size;
}
