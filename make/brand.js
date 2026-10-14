// Brand constants from shared/brands.md (final). Same shape as the kits' brand.js; swap in the kit modules when they land.
export const W = 1080, H = 1920;
export const SAFE = { topNoText: 220, bottomNoText: 480, rightRail: { x: 940, y0: 700, y1: 1700 }, textBox: { x0: 64, x1: 940, y0: 220, y1: 1440 } };
export const SIM = { bg: "#0A0E14", line: "#1E2A3A", text: "#F2F4F7", amber: "#FFB020", cyan: "#3DD6F5", red: "#FF4D4D", green: "#4ADE80" };
export const MEME = { ink: "#111111", paper: "#FFFFFF", yellow: "#FFE14D", blue: "#3B82F6", grey: "#E5E7EB", red: "#FF3B30", pink: "#FF4F8B" };
export const FONTS = [
  { family: "Space Grotesk", weight: 700, url: "fonts/SpaceGrotesk-700.woff2" },
  { family: "JetBrains Mono", weight: 700, url: "fonts/JetBrainsMono-700.woff2" },
  { family: "Anton", weight: 400, url: "fonts/Anton-400.woff2" },
  { family: "Inter", weight: 400, url: "fonts/Inter-400.woff2" },
  { family: "Inter", weight: 600, url: "fonts/Inter-600.woff2" },
  { family: "Inter", weight: 800, url: "fonts/Inter-800.woff2" },
];
export async function loadFonts() {
  await Promise.all(FONTS.map(async (f) => {
    const ff = new FontFace(f.family, `url(${f.url})`, { weight: String(f.weight) });
    document.fonts.add(await ff.load());
  }));
}
export function drawSafeOverlay(ctx) {
  const s = SAFE;
  ctx.save();
  ctx.fillStyle = "rgba(255,0,60,.28)";
  ctx.fillRect(0, 0, W, s.topNoText);
  ctx.fillRect(0, H - s.bottomNoText, W, s.bottomNoText);
  ctx.fillRect(s.rightRail.x, s.rightRail.y0, W - s.rightRail.x, s.rightRail.y1 - s.rightRail.y0);
  ctx.fillRect(0, s.topNoText, s.textBox.x0, H - s.topNoText - s.bottomNoText);
  ctx.restore();
}
