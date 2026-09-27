import { randomBytes } from "node:crypto";
import { adminDb } from "./firebaseAdmin";
import { ApiError } from "./http";
import { localToday } from "@/lib/pricing/time";
import type { QuoteStatus, StoredQuote } from "@/lib/pricing/public";

// Colección `quotes/{id}` (spec A5). Las transiciones de estado van en
// transacción: dos "request" simultáneos no pueden pasar los dos.

const col = () => adminDb().collection("quotes");

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // sin 0/o/1/l: se dictan por WhatsApp

function randomString(n: number, alphabet = ALPHABET): string {
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const newPublicToken = () =>
  randomString(32, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_");

/** Crea la cotización con un id `q_xxxxxxx` que no exista. */
export async function insertQuote(data: Omit<StoredQuote, "id">): Promise<StoredQuote> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = `q_${randomString(7)}`;
    try {
      await col().doc(id).create(data);
      return { id, ...data };
    } catch (err) {
      // ALREADY_EXISTS = 6: colisión de id, se reintenta con otro.
      if ((err as { code?: number }).code !== 6) throw err;
    }
  }
  throw new Error("No se pudo generar un id de cotización único");
}

/** Una cotización `estimated` con valid_until pasado cuenta como vencida. */
export function effectiveStatus(q: StoredQuote, now: Date): QuoteStatus {
  if (q.status === "estimated" && localToday(now) > q.valid_until) return "expired";
  return q.status;
}

function withExpiry(q: StoredQuote, now: Date): StoredQuote {
  const status = effectiveStatus(q, now);
  return status === q.status ? q : { ...q, status };
}

export async function getQuote(id: string, now = new Date()): Promise<StoredQuote | null> {
  if (!/^q_[a-z0-9]{5,8}$/.test(id)) return null;
  const doc = await col().doc(id).get();
  return doc.exists ? withExpiry({ id: doc.id, ...(doc.data() as Omit<StoredQuote, "id">) }, now) : null;
}

/** Busca por id + token público. Mismo 404 si no existe o el token no coincide. */
export async function getQuoteWithToken(id: string, token: string | null): Promise<StoredQuote> {
  const q = await getQuote(id);
  if (!q || !token || q.public_token !== token) {
    throw new ApiError("not_found", "No encontramos esa cotización.");
  }
  return q;
}

/**
 * Lee, valida y escribe en una transacción. `fn` recibe la cotización con el
 * vencimiento ya aplicado y devuelve los campos a cambiar (o tira ApiError).
 */
export async function mutateQuote(
  id: string,
  fn: (q: StoredQuote, now: Date) => Partial<StoredQuote>,
): Promise<StoredQuote> {
  const ref = col().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new ApiError("not_found", "No encontramos esa cotización.");
    const now = new Date();
    const q = withExpiry({ id: doc.id, ...(doc.data() as Omit<StoredQuote, "id">) }, now);
    const patch = fn(q, now);
    tx.update(ref, patch);
    return { ...q, ...patch };
  });
}

export async function listQuotesByStatus(statuses: QuoteStatus[], limit = 200): Promise<StoredQuote[]> {
  const snap = await col().where("status", "in", statuses).limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredQuote, "id">) }));
}

/** Cotizaciones con precio final cargado: la base del control de precisión. */
export async function listConfirmedQuotes(limit = 1000): Promise<StoredQuote[]> {
  const snap = await col().where("final_total", "!=", null).limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredQuote, "id">) }));
}

/** Cotizaciones con datos personales creadas antes de `beforeIso`. */
export async function listQuotesCreatedBefore(beforeIso: string, limit = 500): Promise<StoredQuote[]> {
  const snap = await col().where("created_at", "<", beforeIso).limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredQuote, "id">) }));
}

export async function patchQuote(id: string, patch: Partial<StoredQuote>): Promise<void> {
  await col().doc(id).update(patch);
}
