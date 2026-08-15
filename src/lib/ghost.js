// Behind the Meter — Ghost Content API integration (headless).
// Posts are authored in Ghost; Astro pulls them at build time and renders them
// in our own templates. The real build runs on Cloudflare (which can reach Ghost);
// locally / in a locked sandbox the fetch fails and we fall back to MOCK posts so
// the templates can still be previewed.
//
// Config via env (set in Cloudflare Pages → Settings → Environment variables):
//   GHOST_URL           e.g. https://the-molonglo.ghost.io
//   GHOST_CONTENT_KEY   the Content API key (public by design — safe to embed)
// The defaults below let it work out-of-the-box; env overrides them for rotation.
//
// ⚠️ Use the .ghost.io host here, NOT news.powermind.com.au.
// Verified 2026-08-14: the Content API answers 200 directly on the-molonglo.ghost.io,
// while the same path on the custom domain 301s back to it. Harmless for a GET, but
// there's no reason to take the extra hop at build time.
// The members/subscribe endpoint is the OPPOSITE way round — see SubscribeForm.astro.

const GHOST_URL = (import.meta.env.GHOST_URL || "https://the-molonglo.ghost.io").replace(/\/$/, "");
const GHOST_KEY = import.meta.env.GHOST_CONTENT_KEY || "7c67d38c98873a280b988a0e07";

function mapPost(p) {
  return {
    slug: p.slug,
    title: p.title,
    dek: p.custom_excerpt || p.excerpt || "",
    html: p.html || "",
    feature_image: p.feature_image || null,
    published_at: p.published_at || null,
    reading_time: p.reading_time || null,
    featured: !!p.featured,
    tag: (p.primary_tag && p.primary_tag.name) || (p.tags && p.tags[0] && p.tags[0].name) || "Behind the Meter",
    author: (p.primary_author && p.primary_author.name) || (p.authors && p.authors[0] && p.authors[0].name) || "Powermind",
  };
}

async function fetchPosts() {
  const url = `${GHOST_URL}/ghost/api/content/posts/?key=${GHOST_KEY}&include=tags,authors&limit=all`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Ghost API " + res.status);
  const data = await res.json();
  return (data.posts || []).map(mapPost);
}

// The MOCK posts below are invented. They exist ONLY so the templates can be
// previewed offline, before Ghost is reachable.
//
// ⚠️ THEY MUST NEVER REACH THE LIVE SITE. Four fabricated articles on a
// publication whose whole position is honesty would be worse than a 404.
// So the fallback is gated on import.meta.env.DEV — true when running
// `astro dev` locally, false in every Cloudflare production build.
//
// In production, if Ghost returns nothing or errors, we return an empty array
// and the pages render an honest "first issue coming" state.
const ALLOW_MOCK = import.meta.env.DEV === true;

let _cache = null;
export async function getPosts() {
  if (_cache) return _cache;
  try {
    const posts = await fetchPosts();
    if (posts.length) { _cache = posts; return posts; }
    console.warn("[ghost] Ghost returned no posts.");
  } catch (e) {
    console.warn("[ghost] fetch failed: " + e.message);
  }
  if (ALLOW_MOCK) {
    console.warn("[ghost] DEV build — falling back to MOCK posts for preview.");
    _cache = MOCK;
    return MOCK;
  }
  console.warn("[ghost] PRODUCTION build — no mock. Rendering empty state.");
  _cache = [];
  return _cache;
}

export async function getPost(slug) {
  const posts = await getPosts();
  return posts.find((p) => p.slug === slug) || null;
}

// Format an ISO date as "8 August 2026"
export function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  } catch { return ""; }
}

// ---- MOCK posts (preview only; real posts come from Ghost on deploy) ----
const IMG = {
  feedin: "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?w=1500&q=75&auto=format&fit=crop",
  hotwater: "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?w=1400&q=75&auto=format&fit=crop",
  selfuse: "https://images.unsplash.com/photo-1748063578185-3d68121b11ff?w=1400&q=75&auto=format&fit=crop",
  battery: "https://images.unsplash.com/photo-1706164971309-fb4785fe6ceb?w=1400&q=75&auto=format&fit=crop",
};
const MOCK = [
  {
    slug: "feed-in-tariffs-are-disappearing", featured: true, tag: "The Grid", author: "Jason · Powermind",
    title: "Feed-in tariffs are quietly disappearing. Here's what it actually means for you.",
    dek: "The money you're paid to export solar is collapsing toward zero — and some retailers now charge you to send it. The good news: the value didn't vanish. It moved.",
    feature_image: IMG.feedin, published_at: "2026-08-08T00:00:00.000Z", reading_time: 6,
    html: `<p>For a decade, rooftop solar came with a simple deal: make more than you use, export the rest, get paid a feed-in tariff. That deal is ending — quietly, retailer by retailer.</p>
<p>Five years ago a typical feed-in tariff was 10–15c per kWh. Today many mainland plans pay <strong>2–6c</strong>, some pay nothing after a small cap, and a growing number add <strong>export charges</strong> — the "sun tax."</p>
<h2>Why it's happening</h2>
<p>So much rooftop solar floods the grid at midday that wholesale prices fall to zero. When everyone exports at once, that kilowatt-hour isn't worth much.</p>
<blockquote><p>A kilowatt-hour you use at home is worth five to ten times one you export. That gap is the whole game.</p></blockquote>
<p>The retail price you avoid by not buying from the grid is still <strong>28–48c</strong>. Every unit of your own sun you use at home is worth the full retail rate you didn't pay.</p>
<h2>What to do</h2>
<p>Shift the big flexible loads — hot water, EV, pool, pre-cooling — into the middle of the day, so they run on your surplus instead of exporting it for cents. That's exactly what our <a href="/calculator">calculator</a> shows you.</p>`,
  },
  {
    slug: "your-hot-water-tank-is-a-battery", featured: false, tag: "Hot Water", author: "Jason · Powermind",
    title: "Your hot water tank is a battery you already own.",
    dek: "Before you spend $10,000 on a home battery, look at the 300-litre one already bolted to your wall.",
    feature_image: IMG.hotwater, published_at: "2026-08-08T00:00:00.000Z", reading_time: 5,
    html: `<p>More than half of Australian homes already own a large, cheap, effective energy store: the electric hot water tank. It's a <strong>thermal battery</strong> — heat water with midday solar, use it that evening.</p>
<blockquote><p>A thermal battery that often stores more energy than a home battery — and you already paid for it.</p></blockquote>
<p>UNSW's SolarShift trial shifted hot-water heating to the daytime in <strong>18,000 SA homes</strong>. Nearly half of hot-water energy moved onto solar; only <strong>0.3%</strong> opted out.</p>
<h2>Why it works</h2>
<p>Hot water is a large, flexible load, and a tank barely loses heat overnight. It's the easiest big load to move onto your own sun. Heat pump or plain element, the trick is the same: heat when the sun is up — the job <a href="/app">Powermind</a> does automatically.</p>`,
  },
  {
    slug: "how-much-of-your-solar-do-you-use", featured: false, tag: "Self-consumption", author: "Jason · Powermind",
    title: "How much of your solar do you actually use?",
    dek: "Generation is only half the story. Self-consumption is the number that quietly decides your bill — and it's almost always lower than you'd think.",
    feature_image: IMG.selfuse, published_at: "2026-08-08T00:00:00.000Z", reading_time: 4,
    html: `<p>People talk about generation. But the number on your bill is <strong>self-consumption</strong> — the share of solar you actually used rather than exported. For a home empty during the day it's often just <strong>25–45%</strong>.</p>
<blockquote><p>You can have a perfectly-sized system and still send most of its power to the grid.</p></blockquote>
<p>Solar peaks midday; home use spikes morning and evening. The middle of the day, when panels roar, is when the house is emptiest.</p>
<h2>How to lift it</h2>
<p>Heat hot water midday, top up the EV on daytime sun, pre-cool while the sun's up, run pool and washing at noon. A few of these lift self-use from the low 30s toward 60%+ — no extra panels. Curious where your home sits? <a href="/calculator">Our calculator draws your solar day</a> and shows you.</p>`,
  },
  {
    slug: "are-home-batteries-worth-it-2026", featured: false, tag: "Batteries", author: "Jason · Powermind",
    title: "Are home batteries finally worth it? The 2026 numbers.",
    dek: "With rebates back and feed-in gone, the battery maths has shifted. Here's the honest version — no installer spin.",
    feature_image: IMG.battery, published_at: "2026-08-08T00:00:00.000Z", reading_time: 5,
    html: `<p>The battery question changed in 2026. Feed-in collapsed and new rebates cut the upfront cost. Both push the payback the right way — but not as far as the ads suggest.</p>
<blockquote><p>A battery isn't necessary to start. Shift your loads first — then a right-sized battery catches the surplus even that can't use.</p></blockquote>
<p>The honest order: use your surplus first (hot water, EV, pre-conditioning), then size a battery for what's left over — not the installer's maximum.</p>
<h2>Rule of thumb</h2>
<p>On the ACT tariff, a modestly-sized battery lands around a 6–8 year payback once you've shifted your flexible loads. Oversize it and the payback stretches fast. We'll always tell you when a battery earns its place — and when your hot water tank does the job for free.</p>`,
  },
];
