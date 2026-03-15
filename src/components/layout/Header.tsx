"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Settings, LayoutDashboard, Calculator } from "lucide-react";
import Image from "next/image";

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
    { href: "/calculadora", label: "Calcular", icon: Calculator },
    { href: "/configuracion", label: "Config", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <span className="text-2xl">🖨️</span>
          <span className="text-gray-900 dark:text-white hidden sm:block">ImpriCost</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:block">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="flex items-center gap-2 shrink-0">
          {user?.photoURL && (
            <Image
              src={user.photoURL}
              alt={user.displayName ?? ""}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <button
            onClick={logout}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
