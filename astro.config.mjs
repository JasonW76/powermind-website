import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.powermind.com.au",
  // Cloudflare Pages strips trailing slashes (redirects /app/ -> /app).
  // Match that here so canonical tags and sitemap URLs are the no-slash
  // form Cloudflare actually serves — otherwise Google hits a redirect
  // loop between /app/ (canonical) and /app (served) and reports a
  // "Redirect error" instead of indexing the page.
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [sitemap()],
});
