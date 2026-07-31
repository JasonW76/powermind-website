# Deploy — Astro → Cloudflare Pages (powermind.com.au)

This repo root is now an Astro project. It builds to `dist/`.

## 1. Cloudflare Pages (build the site)
Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → this repo.
- Framework preset: **Astro** (or set manually):
  - Build command: `npm run build`
  - Build output directory: `dist`
  - Root directory: leave blank (repo root)
Deploy. You get a `<project>.pages.dev` URL.

## 2. PROVE THE TESLA KEY FIRST (non-negotiable — do NOT flip DNS before this passes)
    curl -sI https://<project>.pages.dev/.well-known/appspecific/com.tesla.3p.public-key.pem
Expect HTTP 200, and the body byte-identical to the 178-byte PEM.
Carried in `public/.well-known/appspecific/com.tesla.3p.public-key.pem`
sha256 = 6541dd23f5bde1c782f63b41946d2948875b5d210286908f6992ad593b0ee67d

## 3. Cut over DNS (only after step 2 passes)
Pages project → Custom domains → add `powermind.com.au` (and `www`).
DNS is already on Cloudflare, so it auto-points the records at Pages,
replacing the GitHub Pages A records. Then re-prove on the real domain:
    curl -s https://powermind.com.au/.well-known/appspecific/com.tesla.3p.public-key.pem
Expect the exact PEM, 200, HTTPS. Confirm the homepage shows the Astro site.

## 4. Release GitHub Pages
GitHub repo → Settings → Pages → remove custom domain `powermind.com.au`.
(You can also delete the root CNAME file once cut over.)

## Notes
- Root `index.html` (placeholder), `.nojekyll`, `.well-known/` and `CNAME` are kept
  ONLY so GitHub Pages keeps serving the live key until cutover. Astro ignores them
  (it builds from `src/` + `public/`). After cutover they can be removed.
