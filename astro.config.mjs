// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

export default defineConfig({
  integrations: [react()],
  adapter: vercel(),
  // Listen on all interfaces and accept any Host header so the dev server is reachable over Tailscale.
  server: { host: true, port: 4321 },
  vite: { server: { allowedHosts: true } },
});
