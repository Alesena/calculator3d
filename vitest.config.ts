import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig: "@/*" apunta a la raíz del proyecto.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // La capa de cálculo es pura: no necesita DOM.
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
