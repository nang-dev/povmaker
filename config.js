// Edit this file only (plus NAME in build.mjs for the legal pages).
window.SITE_CONFIG = {
  productName: "POVMaker",
  // Set to the payment link (Lemon Squeezy checkout URL) when live; empty = scroll to waitlist.
  paymentUrl: "",
  ctaLabel: "Get early access",
  api: "", // no backend on GitHub Pages; waitlist = mailto, UTMs ride to checkout.
  waitlistEmail: "studionorthline88@gmail.com",
  lsStoreId: "", // set to the Lemon Squeezy store id once approved (client-side licence check)
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
