"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "./Header";
import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log("[AppShell] loading:", loading, "| user:", user?.email ?? "null");
    if (!loading && !user) {
      console.log("[AppShell] → redirigiendo a /login");
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      {/* FAB móvil */}
      <Link
        href="/calculadora"
        className="fixed bottom-6 right-6 sm:hidden w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-xl shadow-orange-300/50 flex items-center justify-center text-2xl active:scale-90 transition-all z-30"
        title="Nuevo cálculo"
      >
        +
      </Link>
    </div>
  );
}
