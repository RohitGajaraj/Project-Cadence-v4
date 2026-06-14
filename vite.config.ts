// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const loadedEnv = {
  ...loadEnv("development", process.cwd(), ""),
  ...loadEnv("production", process.cwd(), ""),
  ...process.env,
};

const publicBackendUrl = loadedEnv.VITE_SUPABASE_URL ?? loadedEnv.SUPABASE_URL ?? "https://ysszyrczxanuzhiohygx.supabase.co";
const publicBackendKey =
  loadedEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  loadedEnv.SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc3p5cmN6eGFudXpoaW9oeWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjMzMzcsImV4cCI6MjA5NTk5OTMzN30._ruIjuZjNNfN24oKlxFtG2HOxi6QMnpfTAymxkidMc0";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        publicBackendUrl,
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        publicBackendKey,
      ),
    },
    optimizeDeps: {
      exclude: ["@tanstack/start-client-core", "@tanstack/react-start"],
    },
  },
});
