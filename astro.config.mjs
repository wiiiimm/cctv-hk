// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

export default defineConfig({
  // Public address: makes canonical / og:url / og:image / sitemap absolute.
  site: globalThis.process?.env.SITE_URL || "https://hk-monitor.wiiiimm.codes",
  integrations: [react()],
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  // Listen on all interfaces and accept any Host header so the dev server is reachable over Tailscale.
  server: { host: true, port: 4321 },
  vite: { server: { allowedHosts: true } },
});
