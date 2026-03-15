import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "ImpriCost — Calculadora de costos 3D",
  description: "Calcula el precio de tus impresiones 3D de forma rápida y precisa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geist.variable} font-sans antialiased bg-gray-50 dark:bg-gray-900 min-h-screen`}>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              className: "!rounded-xl !shadow-lg !text-sm",
              duration: 3000,
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
