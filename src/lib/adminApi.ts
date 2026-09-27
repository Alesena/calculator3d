import { auth } from "@/lib/firebase";

// Cliente del dashboard para /api/v1/admin/*: manda el ID token de Google del
// usuario logueado. El servidor verifica que el UID sea admin.

export class AdminApiError extends Error {
  constructor(message: string, public code?: string, public field?: string) {
    super(message);
    this.name = "AdminApiError";
  }
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new AdminApiError("Iniciá sesión.", "unauthorized");
  const res = await fetch(`/api/v1/admin${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AdminApiError(data?.error?.message ?? "Error inesperado.", data?.error?.code, data?.error?.field);
  }
  return data as T;
}
