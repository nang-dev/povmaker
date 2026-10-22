// Edit this file only (plus NAME in build.mjs for the legal pages).
window.SITE_CONFIG = {
  productName: "POVMaker",
  // Checkout link (Gumroad product page). Empty = Get Pro falls back to the waitlist (site not on sale).
  // GO LIVE = fill checkoutUrls.live, node build.mjs, ./publish.sh (see povmaker/GUMROAD-GO.md).
  mode: "live",
  // Payment provider: "gumroad" (live path, CEO #2688) or "lemonsqueezy" (old plan, see povmaker/gumroad-fallback.md).
  // Gumroad has no test mode: switch = provider "gumroad" + mode "live" + checkoutUrls.live (product page) + gumroadProductId,
  // then `node build.mjs` (legal pages pick the provider up from this file) and ./publish.sh.
  provider: "gumroad",
  // pass = one-time $9 "30-Day Pass" Gumroad product (CEO #7117/trial #32), no subscription. Empty = the second
  // "or $9 once" button stays hidden everywhere. Fill both this and gumroadPassProductId below once Keys sends them.
  checkoutUrls: { test: "", live: "https://northline61.gumroad.com/l/yhuccq", pass: "https://northline61.gumroad.com/l/yidtmr" },
  paymentUrl: "", // derived from mode+checkoutUrls by upgrade.js; leave empty
  ctaLabel: "Get early access",
  priceLabel: "$9/mo", // shown on the Upgrade button and in the plan box (keep in sync with the LS product + terms)
  // Funnel analytics (no backend). Cookie-less Umami Cloud script; EMPTY websiteId = analytics off, nothing is loaded.
  // Events: visit_bio, visit_make, template_select, export_done, upgrade_click.
  analytics: { provider: "umami", websiteId: "20f5089b-ce29-43e2-bd37-a096bf25050f", src: "https://cloud.umami.is/script.js" },
  api: "", // no backend on GitHub Pages; waitlist = mailto, UTMs ride to checkout.
  waitlistEmail: "studionorthline88@gmail.com",
  // Waitlist capture with no backend: FormSubmit emails each signup to the address above (one-time activation click needed).
  // Empty = mailto fallback only. Any failure also falls back to mailto, so a signup is never silently lost.
  waitlistEndpoint: "https://formsubmit.co/ajax/studionorthline88@gmail.com",
  lsStoreId: "", // Lemon Squeezy store id (Settings > Stores); licence keys from other stores are rejected
  lsProductId: "", // optional: POVMaker Pro product id (strict licence check)
  gumroadProductId: "hFwO80Xuaa5EjkGxut-OmQ==", // Gumroad product id (needed by the licence verify API; only used when provider = "gumroad")
  gumroadPassProductId: "yy64NDnSA5xhYXzk3Vz89Q==", // Gumroad product id for the one-time 30-Day Pass (separate product from the membership above)
  // Gallery tiles (gallery.js): our real posted Shorts -> the matching /make/ ?demo= preset. Order = tile order.
  gallery: [
    { demo: "moon3d", title: "What if the Moon got 1 km closer every second?", thumb: "thumbs/moon.jpg", cta: "Make a simpler 3D version of this one, free →" },
    { demo: "oxygen", title: "What if oxygen dropped 1% every second?", thumb: "thumbs/oxygen.jpg", cta: "Make a simpler 2D version of this one, free →" },
    { demo: "goose", title: "POV: you're the goose", thumb: "thumbs/goose.jpg", cta: "Make a simpler chat version of this one, free →" },
    { demo: "hand", title: "POV: you're his car", thumb: "thumbs/car.jpg", cta: "Make a simpler version of this one, free →" },
    { demo: "driver", title: "LOSER #1: you're the driver", thumb: "thumbs/driver.jpg", cta: "Make a simpler version of this one, free →" },
    { demo: "commute", title: "What if your commute went straight up?", thumb: "thumbs/commute.jpg", cta: "Make a simpler 2D version of this one, free →" },
  ],
  defaultBrand: "ranthesim",
  // One page, brand picked by ?brand= or utm_campaign=. Bio links: /?utm_source=instagram&utm_campaign=ranthesim
  brands: {
    ranthesim: {
      title: "Ran The Sim",
      tagline: "What if…? We ran the sim.",
      sub: "Real numbers. Simulated worlds. New sims every day.",
      cta: "Make your own What If video, free →",
      socials: [
        // { label: "TikTok", url: "https://www.tiktok.com/@ranthesim" },
      ],
      videos: [
        // CEO #5274: ranthesim's IG restart lineup, newest post first. Each card has a hard-coded `live`
        // UTC go-live time (ISO) so app.js hides it until that post is actually up; no IG permalink yet
        // (`url` stays unset until poster has it — card renders with a plain-text title until then).
        // CTA/caption/utm per CEO: "Make this one, free →", utm_source=bio&utm_campaign=ranthesim&utm_content=<preset>
        // (app.js already appends utm_medium=latest + those params from v.make.demo).
        { title: "What if your car accelerated 10 km/h every second?", live: "2026-10-18T01:20:00Z", thumb: "thumbs/carreentry.jpg", make: { demo: "carreentry", cta: "Make this one, free →" } },
        { title: "What if coffee got 5°C hotter every second?", live: "2026-10-17T20:40:00Z", thumb: "thumbs/coffee.jpg", make: { demo: "coffee", cta: "Make this one, free →" } },
        { title: "What if your heart rate rose 5 bpm every second?", live: "2026-10-17T16:10:00Z", thumb: "thumbs/heartrate.jpg", make: { demo: "heartrate", cta: "Make this one, free →" } },
        { title: "What if the nearest star moved 1% closer every second?", live: "2026-10-16T16:10:00Z", thumb: "thumbs/neareststar.jpg", make: { demo: "neareststar", cta: "Make this one, free →" } },
        { title: "What if a new moon appeared every second?", live: "2026-10-16T03:30:00Z", thumb: "thumbs/newmoon.jpg", make: { demo: "newmoon", cta: "Make this one, free →" } },
        // { title, url, thumb (frame 0, thumbs/*.jpg) }. Order = Muse's top 3 by views (#2828).
        { title: "What if the Moon got 1 km closer every second?", url: "https://www.instagram.com/reel/Ded_OL-lPc-/", thumb: "thumbs/moon.jpg", make: { demo: "moon3d", cta: "Make a simpler 3D version of this one, free →" } },
        { title: "What if oxygen dropped 1% every second?", url: "https://www.instagram.com/ranthesim/reel/DefWy1EiZi9/", thumb: "thumbs/oxygen.jpg", make: { demo: "oxygen", cta: "Make a simpler 2D version of this one, free →" } },
        { title: "What if zombies broke out across the US?", url: "https://www.instagram.com/reel/DeeqEysjawm/", thumb: "thumbs/zombies.jpg" },
      ],
    },
    sidecharpov: {
      title: "Side Character POV",
      tagline: "Every meme, from the side character's POV.",
      sub: "Whose POV next? Comment it.",
      cta: "Make your own POV → POVMaker",
      socials: [],
      videos: [
        { title: "POV: you're his car", url: "https://www.instagram.com/reel/DefiKD_iii-/", thumb: "thumbs/car.jpg", make: { demo: "hand", cta: "Make a simpler version of this one, free →" } },
        { title: "POV: you're the goose", url: "https://www.instagram.com/reel/DeeI4vPj4ye/", thumb: "thumbs/goose.jpg", make: { demo: "goose", cta: "Make a simpler chat version of this one, free →" } },
        { title: "POV: you're the worm", url: "https://www.instagram.com/reel/DeedfJ7kcad/", thumb: "thumbs/worm.jpg" },
      ],
    },
  },
};
