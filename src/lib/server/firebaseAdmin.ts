import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Admin SDK: sólo lo usan los endpoints /api/v1. Las colecciones de la
// cotización pública (pricing_params, quotes, config) no tienen reglas de
// cliente — se leen y escriben únicamente desde acá.
//
// FIREBASE_ADMIN_PRIVATE_KEY: una línea con \n literales (como en la web).

function app() {
  if (getApps().length) return getApps()[0];
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ?.replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "");
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

let db: ReturnType<typeof getFirestore> | null = null;

export function adminDb() {
  if (!db) {
    db = getFirestore(app());
    // Los campos opcionales (areas_cm2, default…) pueden venir como undefined.
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}
export const adminAuth = () => getAuth(app());
