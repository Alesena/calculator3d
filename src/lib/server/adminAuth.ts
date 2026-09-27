import type { NextRequest } from "next/server";
import { adminAuth } from "./firebaseAdmin";
import { ApiError } from "./http";

// Endpoints /api/v1/admin/*: el mismo login de Google del dashboard. El cliente
// manda su ID token (Authorization: Bearer <idToken>) y el UID tiene que estar
// en IMPRICOST_ADMIN_UIDS (lista separada por comas).

export async function requireAdmin(req: NextRequest): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new ApiError("unauthorized", "Iniciá sesión.");

  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    throw new ApiError("unauthorized", "La sesión venció. Volvé a iniciar sesión.");
  }

  const admins = (process.env.IMPRICOST_ADMIN_UIDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!admins.includes(uid)) throw new ApiError("unauthorized", "Tu cuenta no tiene acceso a las cotizaciones.");
  return uid;
}
