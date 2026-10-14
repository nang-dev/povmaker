// Edit this file only (plus NAME in build.mjs for the legal pages).
window.SITE_CONFIG = {
  productName: "POVMaker",
  // Lemon Squeezy checkout links (Share > checkout link). Empty = Get Pro falls back to the waitlist.
  // GO LIVE = set mode to "live" (and fill checkoutUrls.live). Test-mode keys are rejected in live mode.
  mode: "test",
  checkoutUrls: { test: "", live: "" },
  paymentUrl: "", // derived from mode+checkoutUrls by upgrade.js; leave empty
  ctaLabel: "Get early access",
  priceLabel: "$9/mo", // shown on the Upgrade button and in the plan box (keep in sync with the LS product + terms)
  // Funnel analytics (no backend). Cookie-less Umami Cloud script; EMPTY websiteId = analytics off, nothing is loaded.
  // Events: visit_bio, visit_make, template_select, export_done, upgrade_click.
  analytics: { provider: "umami", websiteId: "", src: "https://cloud.umami.is/script.js" },
  api: "", // no backend on GitHub Pages; waitlist = mailto, UTMs ride to checkout.
  waitlistEmail: "studionorthline88@gmail.com",
  lsStoreId: "", // Lemon Squeezy store id (Settings > Stores); licence keys from other stores are rejected
  lsProductId: "", // optional: POVMaker Pro product id (strict licence check)
  defaultBrand: "ranthesim",
  // One page, brand picked by ?brand= or utm_campaign=. Bio links: /?utm_source=instagram&utm_campaign=ranthesim
  brands: {
    ranthesim: {
      title: "Ran The Sim",
      tagline: "What if…? We ran the sim.",
      sub: "Real numbers. Simulated worlds. New sim every day.",
      cta: "Make videos like this → POVMaker",
      socials: [
        // { label: "TikTok", url: "https://www.tiktok.com/@ranthesim" },
      ],
      videos: [
        // { title: "What if the Moon vanished?", url: "https://...", tag: "SIM #001" },
      ],
    },
    sidecharpov: {
      title: "Side Character POV",
      tagline: "Every meme, from the side character's POV.",
      sub: "Whose POV next? Comment it.",
      cta: "Make your own POV → POVMaker",
      socials: [],
      videos: [],
    },
  },
};
