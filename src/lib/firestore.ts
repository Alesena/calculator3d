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
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Product, UserSettings, DEFAULT_SETTINGS, CalculationParams, CalculatedPrices } from "@/types";

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getUserSettings(uid: string): Promise<UserSettings> {
  const ref = doc(db, "users", uid, "data", "settings");
  const snap = await getDoc(ref);
  if (!snap.exists()) return DEFAULT_SETTINGS;
  return snap.data() as UserSettings;
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
  params: CalculationParams & { name: string; description?: string },
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
  params: CalculationParams & { name: string; description?: string },
  calculatedPrices: CalculatedPrices
): Promise<void> {
  const ref = doc(db, "users", uid, "products", productId);
  await updateDoc(ref, {
    ...cleanParams(params),
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
    ...data,
    name: `${data.name} (copia)`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  return docRef.id;
}
