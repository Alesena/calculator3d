import { adminDb } from "./firebaseAdmin";
import { DEFAULT_PRICING_PARAMS } from "@/lib/pricing/defaults";
import type { PricingParams } from "@/lib/pricing/types";

// Parámetros versionados (spec A2):
//   pricing_params/{version} → { version, data, created_at, created_by, active }
//   config/pricing           → { active_version, latest_version }
// Editar crea una versión nueva; nunca se pisa una anterior. Si no hay ninguna,
// se siembra la 1 con DEFAULT_PRICING_PARAMS.

export interface ActivePricing {
  version: number;
  params: PricingParams;
}

export interface PricingVersionMeta {
  version: number;
  created_at: string;
  created_by: string;
  active: boolean;
}

const CACHE_MS = 60_000;
let cache: { at: number; value: ActivePricing } | null = null;

const configRef = () => adminDb().doc("config/pricing");
const versionRef = (v: number) => adminDb().doc(`pricing_params/${v}`);

export async function getActivePricing(): Promise<ActivePricing> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const cfg = await configRef().get();
  let value: ActivePricing;
  if (cfg.exists) {
    const version = cfg.get("active_version") as number;
    const doc = await versionRef(version).get();
    value = { version, params: doc.get("data") as PricingParams };
  } else {
    value = await seed();
  }
  cache = { at: Date.now(), value };
  return value;
}

async function seed(): Promise<ActivePricing> {
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const cfg = await tx.get(configRef());
    if (cfg.exists) {
      const version = cfg.get("active_version") as number;
      const doc = await tx.get(versionRef(version));
      return { version, params: doc.get("data") as PricingParams };
    }
    const now = new Date().toISOString();
    tx.set(versionRef(1), { version: 1, data: DEFAULT_PRICING_PARAMS, created_at: now, created_by: "seed", active: true });
    tx.set(configRef(), { active_version: 1, latest_version: 1 });
    return { version: 1, params: DEFAULT_PRICING_PARAMS };
  });
}

/** Parámetros de una versión puntual (el detalle de una cotización vieja). */
export async function getPricingVersion(version: number): Promise<PricingParams | null> {
  const doc = await versionRef(version).get();
  return doc.exists ? (doc.get("data") as PricingParams) : null;
}

export async function savePricingVersion(params: PricingParams, uid: string): Promise<number> {
  await getActivePricing(); // garantiza que exista la versión 1
  const db = adminDb();
  const version = await db.runTransaction(async (tx) => {
    const cfg = await tx.get(configRef());
    const prev = cfg.get("active_version") as number;
    const next = ((cfg.get("latest_version") as number) ?? prev) + 1;
    tx.set(versionRef(next), { version: next, data: params, created_at: new Date().toISOString(), created_by: uid, active: true });
    tx.update(versionRef(prev), { active: false });
    tx.set(configRef(), { active_version: next, latest_version: next });
    return next;
  });
  cache = null;
  return version;
}

export async function listPricingVersions(limit = 30): Promise<PricingVersionMeta[]> {
  const snap = await adminDb().collection("pricing_params").orderBy("version", "desc").limit(limit).get();
  return snap.docs.map((d) => ({
    version: d.get("version"),
    created_at: d.get("created_at"),
    created_by: d.get("created_by"),
    active: d.get("active"),
  }));
}
