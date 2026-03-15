# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Objetivo
App web **ImpriCost**: calculadora de costos de impresión 3D con autenticación Google y persistencia por usuario en Firestore.

## Comandos

```bash
npm run dev      # Servidor de desarrollo (http://localhost:3000)
npm run build    # Build de producción
npm run lint     # ESLint
```

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** (config via `@theme` en `globals.css`, sin `tailwind.config.js`)
- **Firebase**: Auth (Google Sign-In) + Firestore
- **React Hook Form** + **Zod** para formularios
- **Lucide-react** para íconos, **react-hot-toast** para notificaciones

## Arquitectura

```
app/
  page.tsx               → Redirect a /login o /dashboard según auth
  login/page.tsx         → Pantalla de login con Google
  dashboard/page.tsx     → Lista de productos + estadísticas
  calculadora/page.tsx   → Formulario de cálculo + resultado
  productos/[id]/page.tsx→ Detalle de producto
  configuracion/page.tsx → Valores por defecto del usuario
  (app)/                 → Carpeta vacía (no usar — el auth está en AppShell)

src/
  types/index.ts         → Tipos: Product, UserSettings, CalculationParams, CalculatedPrices
  lib/
    firebase.ts          → Init de Firebase (lee env vars NEXT_PUBLIC_FIREBASE_*)
    firestore.ts         → CRUD: getProducts, createProduct, updateProduct, deleteProduct, duplicateProduct, getUserSettings, saveUserSettings
    calculations.ts      → calculatePrice() (función pura), formatARS(), formatHours()
  contexts/
    AuthContext.tsx       → useAuth() → { user, loading, signInWithGoogle, logout }
  hooks/
    useProducts.ts       → useProducts(uid) → { products, loading, refetch, remove, duplicate }
    useSettings.ts       → useSettings(uid) → { settings, loading, save }
  components/
    layout/
      AppShell.tsx       → Wrapper de auth: redirige a /login si no hay sesión, muestra Header + FAB móvil
      Header.tsx         → Nav: Dashboard / Calcular / Config + avatar + logout
    calculator/
      CalculatorForm.tsx → Formulario completo con secciones: básicos, material, electricidad, mano de obra, ganancia
    products/
      ProductCard.tsx    → Tarjeta con acciones: editar, duplicar, eliminar (con confirm dialog)
      PriceBreakdown.tsx → Desglose de costos con precio final destacado
    ui/
      Skeleton.tsx       → Skeleton loaders para cards y stats
      ConfirmDialog.tsx  → Modal de confirmación para eliminar
```

## Flujo de datos

1. `AppShell` verifica auth en cliente → si no hay user, redirige a `/login`
2. `useAuth()` expone el usuario de Firebase Auth
3. Cada hook (`useProducts`, `useSettings`) recibe `uid` y opera sobre `users/{uid}/products` y `users/{uid}/data/settings` en Firestore
4. `calculatePrice(params)` es una función pura en `lib/calculations.ts` que devuelve `CalculatedPrices`
5. Al guardar, se llama `createProduct` / `updateProduct` en Firestore con los params y los precios calculados

## Estructura de Firestore

```
users/{uid}/
  data/settings     → UserSettings { electricityPrice, printerWatts, laborCostPerHour, profitPercentage }
  products/{id}     → Product { name, description?, printTimeHours, printTimeMinutes, filamentWeight, filamentType, filamentPricePerKg, printerWatts, electricityPrice, laborCostPerHour, postProcessMinutes, profitPercentage, extraCosts, shippingCost, calculatedPrices: {...}, month, year, createdAt, updatedAt }
```

## Variables de entorno

Completar en `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Las reglas de seguridad de Firestore están en `firestore.rules`.

## Notas importantes

- Tailwind v4: usar `@theme inline` en `globals.css` para customizar, no `tailwind.config.js`
- El path alias `@/*` apunta a la raíz del proyecto (no a `src/`)
- Todas las páginas usan `"use client"` y están envueltas en `<AppShell>`
- La carpeta `app/(app)/` existe pero sus page.tsx son stubs vacíos — no agregar páginas ahí
