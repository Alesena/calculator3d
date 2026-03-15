"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl shadow-2xl shadow-orange-100 dark:shadow-black/40 p-8 space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="text-6xl mb-4">🖨️</div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            ImpriCost
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Calculá el precio de tus impresiones 3D de forma rápida y precisa
          </p>
        </div>

        {/* Features */}
        <ul className="space-y-2.5 text-sm text-gray-600 dark:text-gray-300">
          {[
            "Calculá material, electricidad y mano de obra",
            "Guardá tus productos con precios calculados",
            "Estadísticas de tu negocio en tiempo real",
          ].map((feat) => (
            <li key={feat} className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">✓</span>
              {feat}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-gray-600 active:scale-95 transition-all shadow-sm"
        >
          <GoogleIcon />
          Iniciar sesión con Google
        </button>
      </div>

      <p className="mt-6 text-xs text-gray-400 dark:text-gray-600">
        Tus datos son privados y solo vos los ves
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
      <path fill="#34A853" d="m8.98 17 2.6-.13.02.13 2.6-2.04c-.88.59-2 .96-3.22.96-2.47 0-4.56-1.68-5.3-3.95H1.7V14a8 8 0 0 0 7.28 3z" />
      <path fill="#FBBC05" d="M3.68 10.97A4.84 4.84 0 0 1 3.43 9c0-.68.12-1.34.25-1.97V5.02H1.7A8 8 0 0 0 1 9c0 1.29.31 2.51.7 3.61z" />
      <path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 8.98 0A8 8 0 0 0 1.7 5.02l1.98 1.54c.74-2.27 2.83-2.98 5.3-2.98z" />
    </svg>
  );
}
