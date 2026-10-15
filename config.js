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
  checkoutUrls: { test: "", live: "https://northline61.gumroad.com/l/yhuccq" },
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
  defaultBrand: "ranthesim",
  // One page, brand picked by ?brand= or utm_campaign=. Bio links: /?utm_source=instagram&utm_campaign=ranthesim
  brands: {
    ranthesim: {
      title: "Ran The Sim",
      tagline: "What if…? We ran the sim.",
      sub: "Real numbers. Simulated worlds. New sims every day.",
      cta: "Make videos like this → POVMaker",
      socials: [
        // { label: "TikTok", url: "https://www.tiktok.com/@ranthesim" },
      ],
      videos: [
        // { title, url, thumb (frame 0, thumbs/*.jpg) }. Order = Muse's top 3 by views (#2828).
        { title: "What if the Moon got 1 km closer every second?", url: "https://www.instagram.com/reel/Ded_OL-lPc-/", thumb: "thumbs/moon.jpg" },
        { title: "What if oxygen dropped 1% every second?", url: "https://www.instagram.com/ranthesim/reel/DefWy1EiZi9/", thumb: "thumbs/oxygen.jpg" },
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
        { title: "POV: you're his car", url: "https://www.instagram.com/reel/DefiKD_iii-/", thumb: "thumbs/car.jpg" },
        { title: "POV: you're the goose", url: "https://www.instagram.com/reel/DeeI4vPj4ye/", thumb: "thumbs/goose.jpg" },
        { title: "POV: you're the worm", url: "https://www.instagram.com/reel/DeedfJ7kcad/", thumb: "thumbs/worm.jpg" },
      ],
    },
  },
};
