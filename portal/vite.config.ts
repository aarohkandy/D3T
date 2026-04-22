import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const targets = new Set(["generic", "crazygames", "poki", "gamedistribution"]);

export default defineConfig(({ mode }) => {
  const target = targets.has(mode) ? mode : "generic";

  return {
    plugins: [react()],
    root: fileURLToPath(new URL(".", import.meta.url)),
    base: "./",
    publicDir: false,
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("../src", import.meta.url)),
      },
    },
    define: {
      __D3T_PORTAL_TARGET__: JSON.stringify(target),
    },
    build: {
      outDir: fileURLToPath(new URL(`../dist/portal/${target}`, import.meta.url)),
      emptyOutDir: true,
      sourcemap: false,
      target: "es2020",
    },
  };
});
