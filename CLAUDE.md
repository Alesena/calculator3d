# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Objetivo
App web **ImpriCost**: calculadora de costos de impresión 3D con autenticación Google y persistencia por usuario en Firestore.

## Comandos

```bash
npm run dev      # Servidor de desarrollo (http://localhost:3000)
npm run build    # Build de producción
npm run lint     # ESLint
npm test         # Vitest (capa de cálculo + parsers, sin DOM salvo integración)
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
  dashboard/page.tsx     → Sólo categorías; los productos aparecen al entrar en una
                           (?cat=<id>, ?cat=none = sin categoría)
  calculadora/page.tsx   → Formulario de cálculo + resultado
  productos/[id]/page.tsx→ Detalle de producto
  configuracion/page.tsx → Valores por defecto del usuario
  (app)/                 → Carpeta vacía (no usar — el auth está en AppShell)

src/
  types/index.ts         → Tipos: Product, Category, UserSettings, CalculationParams, CalculatedPrices
  lib/
    firebase.ts          → Init de Firebase (lee env vars NEXT_PUBLIC_FIREBASE_*)
    firestore.ts         → CRUD: getProducts, createProduct, updateProduct, deleteProduct, duplicateProduct, getUserSettings, saveUserSettings
    calculations.ts      → calculatePrice() (función pura), formatARS(), formatHours()
    inputFormat.ts       → parsePrintTime() "1.30" = 1h30min, parseGrams() gramos enteros
    parse3mf.ts          → Lee el ZIP .3mf: malla, perfil del laminador, slice_info
    print/               → Capa de importación/estimación (ver abajo)
  contexts/
    AuthContext.tsx       → useAuth() → { user, loading, signInWithGoogle, logout }
  hooks/
    useProducts.ts       → useProducts(uid) → { products, loading, refetch, remove, duplicate }
    useSettings.ts       → useSettings(uid) → { settings, loading, save }
    useCategories.ts     → useCategories(uid) → { categories, loading, refetch, create, rename, remove }
  components/
    layout/
      AppShell.tsx       → Wrapper de auth: redirige a /login si no hay sesión, muestra Header + FAB móvil
      Header.tsx         → Nav: Dashboard / Calcular / Config + avatar + logout
    calculator/
      CalculatorForm.tsx → Formulario completo con secciones: básicos, material, electricidad, repuestos, mano de obra, ganancia
      ThreeMFImporter.tsx→ Importa .3mf/.gcode y precarga peso y tiempo en el formulario
    categories/
      CategorySelect.tsx → Select de categoría + creación al vuelo (usado en el formulario)
    products/
      ProductCard.tsx    → Tarjeta con acciones: editar, duplicar, eliminar (con confirm dialog)
      PriceBreakdown.tsx → Desglose de costos con precio final destacado
    ui/
      Skeleton.tsx       → Skeleton loaders para cards y stats
      ConfirmDialog.tsx  → Modal de confirmación para eliminar
      PromptDialog.tsx   → Modal con un input (crear/renombrar categoría). Va por portal:
                           trae su propio <form> y se usa dentro del form de la calculadora
```

## Capa de impresión (`src/lib/print/`)

Separada en tres niveles; `geometry`/`estimate` no importan React ni JSZip.

```
types.ts        → EstimateSource, SlicerReport, FilamentUsage, MeshAreas
materials.ts    → Tabla de densidades (sólo fallback) + resolveDensity()
transform.ts    → Matrices 3MF en convención de vector-fila (p' = p · M)
shell.ts        → estimateMaterialVolume(): cáscara + núcleo. Puro.
sliceInfo.ts    → parseSliceInfo(): Metadata/slice_info.config de BambuStudio
gcodeSummary.ts → parseGcodeSummary(): comentarios de resumen (Bambu / Orca / Prusa)
importFile.ts   → importPrintFile(): despacha por extensión y normaliza a PrintImport
```

### Jerarquía de precisión

El importador NO estima si el archivo ya trae la respuesta. Por orden:

1. **`slice_info.config`** (.3mf exportado *después* de laminar) → peso y tiempo exactos,
   purga y soportes incluidos. Los `<resources>` de un .3mf laminado vienen **vacíos**:
   la ausencia de malla no es un error.
2. **Resumen del G-code** (.gcode suelto, o embebido en el .3mf) → exacto también.
3. **Malla + modelo de cáscara** (.3mf de proyecto, sin laminar) → estimación.
   La fracción de material NO es `0.2 + infill·0.8`: depende de la superficie.
   Ver `shell.ts`.

La UI marca la procedencia de cada número. El tiempo estimado desde la malla usa un
factor de eficiencia sin calibrar (`TIME_ESTIMATE_EFFICIENCY`) y se presenta como orden
de magnitud, no como dato.

## Flujo de datos

1. `AppShell` verifica auth en cliente → si no hay user, redirige a `/login`
2. `useAuth()` expone el usuario de Firebase Auth
3. Cada hook (`useProducts`, `useSettings`, `useCategories`) recibe `uid` y opera sobre `users/{uid}/products`, `users/{uid}/data/settings` y `users/{uid}/categories` en Firestore
4. `calculatePrice(params)` es una función pura en `lib/calculations.ts` que devuelve `CalculatedPrices`
5. Al guardar, se llama `createProduct` / `updateProduct` en Firestore con los params y los precios calculados

## Estructura de Firestore

```
users/{uid}/
  categories/{id}   → Category { name, createdAt, updatedAt }
  data/settings     → UserSettings { electricityPrice, printerWatts, profitPercentage, vidaUtilHoras, precioRepuestos, margenErrorPct, packaging, laborCostPerHour, postProcessMinutes }
  products/{id}     → Product { name, description?, categoryId?, cantidad, printTimeHours, printTimeMinutes, filamentWeight, filamentType, filamentTypeCustom?, filamentPricePerKg, printerWatts, electricityPrice, vidaUtilHoras, precioRepuestos, packaging, laborCostPerHour, postProcessMinutes, margenErrorPct, profitPercentage, shippingCost, calculatedPrices: {...}, month, year, createdAt, updatedAt }
```

`categoryId` es opcional a propósito: los productos guardados antes de que existieran las
categorías, y los de una categoría borrada, no lo tienen. En la UI son "Sin categoría"
(`?cat=none` en el dashboard), no un error. Borrar una categoría **no borra sus productos**:
`deleteCategory()` les saca el campo con `deleteField()` en un batch. Por eso `updateProduct()`
escribe `categoryId: deleteField()` cuando el form no manda ninguna — `cleanParams` descarta
los `undefined` y, sin eso, sacarle la categoría a un producto no tendría efecto.

`getUserSettings()` mergea sobre `DEFAULT_SETTINGS`: las cuentas creadas antes de que
existiera un campo no lo tienen guardado y llegaría `undefined`.

## Cotizador público para misintenciones3d.com (`/api/v1`)

Spec: `INTEGRACION_IMPRICOST.md` (en el repo de la web, carpeta `ejemplos/`). La web
analiza la malla en el navegador y manda sólo números; el precio se calcula acá.

```
src/lib/pricing/          → PURO (sin I/O, la fecha entra por parámetro)
  types.ts               → PricingParams, QuoteInput, QuoteResult (con desglose interno)
  calculate.ts           → calculateQuote(). Motor APARTE de calculatePrice(): no se tocan
  defaults.ts            → versión 1 que se siembra si no hay parámetros
  confirm.ts             → regla del tope (applyConfirmation) + control de precisión
  public.ts              → StoredQuote + toPublicQuote/Tracking/Catalog (lista PERMITIDA)
  validation.ts          → zod + catálogo, WhatsApp → E.164, CUIT, parámetros
  time.ts                → horas hábiles y fechas en Buenos Aires (UTC−3 fijo)
  messages.ts            → mensaje de WhatsApp que copia el admin
src/lib/server/           → firebase-admin, pricingStore, quotesStore, ratelimit, http (CORS/errores), adminAuth
app/api/v1/               → catalog · quotes · quotes/[id] (+request/accept/cancel) · admin/*
app/cotizaciones/         → pedidos de la web, detalle + confirmar, precisión
app/parametros/           → parámetros versionados (incluye el CRUD de materiales y colores)
```

- **Material**: si la web manda `areas_cm2` (lateral/techo/piso), la fracción sale del
  modelo de cáscara (`shell.ts`); si no, de la fórmula de referencia de la spec
  (`wall_fraction + (1 − wall_fraction)·infill`). Con esa, el caso 4.4 da exacto.
- **Nunca** exponer desglose, costos, horas ni peso: toda respuesta pública pasa por
  `toPublicQuote/Tracking/Catalog`, que arman el objeto campo por campo.
- **Tope**: lo aplica el backend en `admin/quotes/:id/confirm` contra el `max_guaranteed`
  guardado en la cotización (el que vio el cliente), no uno recalculado.
- **Parámetros versionados**: `pricing_params/{version}` + `config/pricing`. Guardar crea
  versión nueva; cada cotización guarda `pricing_version`. Cache de 60 s en memoria.
- Firestore raíz (`quotes`, `pricing_params`, `config`): sólo Admin SDK. `firestore.rules`
  no les da acceso de cliente (default deny) — no agregar reglas para ellas.
- Datos personales de pedidos no concretados: se borran a los 90 días (cron diario en `vercel.json`).
- Admin: Google login del dashboard → `Authorization: Bearer <idToken>` → UID en `IMPRICOST_ADMIN_UIDS`.

## Variables de entorno

Completar en `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Cotizador público (/api/v1) — ver sección de arriba
FIREBASE_ADMIN_PROJECT_ID=        # calculator3d-cabc4
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=       # una línea con 
 literales, entre comillas
IMPRICOST_ADMIN_UIDS=             # UIDs de Firebase Auth con acceso a /cotizaciones (coma)
ALLOWED_ORIGINS=                  # https://misintenciones3d.com,https://www.misintenciones3d.com
UPSTASH_REDIS_REST_URL=           # el mismo Upstash que la web (prefijo impricost:)
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=                      # Vercel Cron → /api/v1/admin/cron/anonymize
NEXT_PUBLIC_WEB_TRACKING_URL=     # default https://misintenciones3d.com/impresion-3d
```

Las reglas de seguridad de Firestore están en `firestore.rules`.

## Notas importantes

- Tailwind v4: usar `@theme inline` en `globals.css` para customizar, no `tailwind.config.js`
- El path alias `@/*` apunta a la raíz del proyecto (no a `src/`)
- Todas las páginas usan `"use client"` y están envueltas en `<AppShell>`
- La carpeta `app/(app)/` existe pero sus page.tsx son stubs vacíos — no agregar páginas ahí
- El tiempo se carga como `horas.minutos` (`1.30` = 1h 30min), NO como decimal de horas.
  Por eso nunca se muestran horas decimales en la UI: usar `formatDecimalHours()`, o
  "1.83hs" se lee como si el cálculo estuviera roto
- `filamentWeight` son **gramos enteros**. El rollo viene por 1000 g y el costo sale de
  esa regla de tres; el importador .3mf redondea sus decimales **hacia arriba** al
  cargar el formulario (12,61 g → 13 g): quedarse corto de material subestima el costo
- `filamentWeight` es el peso **total**: objeto + soportes + purga. En AMS la purga puede
  superar a la pieza (el mismo llavero: 12,61 g en la A1 contra 8,09 g en la U1)
- Los datos que declara el archivo del laminador ganan sobre cualquier tabla hardcodeada
- `script.js` en la raíz es un prototipo previo y duplica `calculations.ts` — pendiente de borrar
