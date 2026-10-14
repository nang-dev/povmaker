// RAN THE SIM · brand constants. DOM-free ES module, no imports.
// Single source of truth for the kit (kit/*.js and index.html import from here) and for POVMaker,
// which copies this file + fonts/ unchanged. Font urls are relative to this file's folder.

export const BRAND = { id: "ranthesim", name: "Ran The Sim", handle: "@ranthesim" };

export const PALETTE = {
  bg: "#0A0E14",      // console background / night sky
  line: "#1E2A3A",    // grid / panel lines
  text: "#F2F4F7",    // primary text
  amber: "#FFB020",   // counter / data accent (signature)
  cyan: "#3DD6F5",    // sim / UI
  alert: "#FF4D4D",   // threshold crossed
  nominal: "#4ADE80", // safe / nominal
  grass: "#6AA84F", water: "#2F6F9F", rock: "#8A8F98", sand: "#E2C893", // low-poly world naturals
};

export const FONTS = [
  { family: "Space Grotesk", weight: 700, url: "fonts/SpaceGrotesk-700.woff2", use: "questions, captions" },
  { family: "JetBrains Mono", weight: 700, url: "fonts/JetBrainsMono-700.woff2", use: "counters, timestamps, labels (uppercase, +0.08em)" },
];

/** Type scale on the 1080×1920 canvas (px). */
export const TYPE = {
  caption: { family: "Space Grotesk", weight: 700, size: 62, lineHeight: 1.12 },
  title: { family: "Space Grotesk", weight: 700, size: 60, lineHeight: 1.05 },
  counter: { family: "JetBrains Mono", weight: 700, size: 120, tracking: -0.02 },   // brand range 120–180
  label: { family: "JetBrains Mono", weight: 700, size: 26, tracking: 0.08, upper: true },
};

/** Platform UI safe zones (TikTok / Reels / Shorts at once). */
export const SAFE = {
  width: 1080, height: 1920,
  topNoText: 220,
  bottomNoText: 480,                          // no text below y 1440
  rightRail: { x: 940, y0: 700, y1: 1700 },   // like/comment/share rail
  leftMargin: 64,
  textBox: { x0: 64, x1: 940, y0: 220, y1: 1440 },
  keyBand: { y0: 260, y1: 1100 },             // key text reads here before the eye drops to the UI
};

/** Draws the safe-zone overlay onto a 1080×1920 2D context: red = no text, green dashed = text-safe box. */
export function drawSafeOverlay(ctx, { labels = true } = {}) {
  const S = SAFE, W = S.width, H = S.height, b = S.textBox;
  ctx.save();
  ctx.fillStyle = "rgba(255,176,32,0.08)";
  ctx.fillRect(b.x0, S.keyBand.y0, b.x1 - b.x0, S.keyBand.y1 - S.keyBand.y0);
  const zones = [
    [0, 0, W, S.topNoText, "NO TEXT · TOP 220"],
    [0, H - S.bottomNoText, W, S.bottomNoText, "NO TEXT · BOTTOM 480 (y > 1440)"],
    [S.rightRail.x, S.rightRail.y0, W - S.rightRail.x, S.rightRail.y1 - S.rightRail.y0, "RAIL"],
  ];
  for (const [x, y, w, h] of zones) {
    ctx.fillStyle = "rgba(255,40,40,0.33)"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,40,40,0.9)"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  ctx.fillStyle = "rgba(255,40,40,0.15)";
  ctx.fillRect(0, S.topNoText, S.leftMargin, H - S.topNoText - S.bottomNoText);
  ctx.setLineDash([16, 10]); ctx.strokeStyle = "#4ADE80"; ctx.lineWidth = 4;
  ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.setLineDash([]);
  if (labels) {
    ctx.fillStyle = "#FFFFFF"; ctx.font = "700 24px 'JetBrains Mono', Menlo, monospace"; ctx.textBaseline = "top";
    for (const [x, y, , , label] of zones) ctx.fillText(label, x + 12, y + 12);
    ctx.fillStyle = "#4ADE80"; ctx.fillText("TEXT-SAFE x 64–940 · y 220–1440", b.x0 + 12, b.y1 - 36);
  }
  ctx.restore();
}

// ---------- canvas-2D primitives (for POVMaker; the kit's HTML HUD is the reference look) ----------
// Every function is (ctx, ...args), draws in absolute 1080×1920 px, is pure (no Date / Math.random) and restores ctx state.
// Fonts must already be loaded (loadFonts() below, or your own FontFace loader). Text auto-fits: it shrinks within the
// brand range, then wraps, and never leaves the text-safe box (x 64–940). Centred text defaults to x = 502, the box centre.

const mono = (px) => `700 ${px}px 'JetBrains Mono', Menlo, monospace`;
const sans = (px) => `700 ${px}px 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif`;
const tracking = (ctx, px) => { if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`; };
const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, "0");

/** Loads FONTS into document.fonts (browser only). base = URL of the folder that holds brand.js, e.g. "kits/ranthesim/". */
export async function loadFonts(base = "") {
  const FF = globalThis.FontFace, set = globalThis.document?.fonts;
  if (!FF || !set) return;
  await Promise.all(FONTS.map(async (f) => set.add(await new FF(f.family, `url(${base}${f.url})`, { weight: String(f.weight) }).load())));
}

/** Greedy word wrap with the current ctx.font. Returns an array of lines (a single long word stays whole). */
export function wrapText(ctx, text, maxW) {
  const out = [];
  let cur = "";
  for (const w of String(text).split(/\s+/).filter(Boolean)) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(test).width > maxW) { out.push(cur); cur = w; } else cur = test;
  }
  if (cur) out.push(cur);
  return out;
}

/** Largest size in [min, max] (step 2) whose wrap fits in maxLines lines of maxW. Leaves ctx.font set. */
function fitWrap(ctx, text, font, max, min, maxW, maxLines) {
  let size = max, lines;
  for (; size >= min; size -= 2) {
    ctx.font = font(size); lines = wrapText(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) break;
  }
  return { size: Math.max(size, min), lines };
}

/**
 * The brand's tag row (Ran The Sim's "POV tag"): amber square + "SIM #001" left, optional clock right.
 * drawPovTag(ctx, "SIM #001", { right: "T+00:08", y: 232 }) → bottom y
 */
export function drawPovTag(ctx, text, { x = 64, y = 232, right = "", rightX = 940, color = PALETTE.text, square = PALETTE.amber } = {}) {
  ctx.save();
  ctx.font = mono(30); tracking(ctx, 2.4); ctx.textBaseline = "alphabetic"; ctx.fillStyle = square;
  ctx.fillRect(x, y + 10, 16, 16);
  ctx.fillStyle = color; ctx.textAlign = "left";
  ctx.fillText(String(text).toUpperCase(), x + 30, y + 29, rightX - x - 30 - (right ? 200 : 0));
  if (right) { ctx.textAlign = "right"; ctx.fillText(String(right).toUpperCase(), rightX, y + 29); }
  ctx.restore();
  return y + 36;
}

/**
 * The question / title: Space Grotesk 700, one line at 60 px; shrinks to 44 px, then wraps to 2 lines.
 * drawTopText(ctx, "Moon pulled 10× closer", { y: 284 }) → bottom y
 */
export function drawTopText(ctx, text, { x = 64, y = 284, maxW = 876, size = 60, align = "left", color = PALETTE.text } = {}) {
  ctx.save();
  let fit = fitWrap(ctx, text, sans, size, 44, maxW, 1);
  if (fit.lines.length > 1 || ctx.measureText(fit.lines[0] ?? "").width > maxW) fit = fitWrap(ctx, text, sans, 52, 40, maxW, 2);
  tracking(ctx, -0.01 * fit.size); ctx.textBaseline = "alphabetic"; ctx.fillStyle = color; ctx.textAlign = align;
  const ax = align === "center" ? x + maxW / 2 : align === "right" ? x + maxW : x, lh = 1.05 * fit.size;
  fit.lines.forEach((l, i) => ctx.fillText(l, ax, y + 0.8 * fit.size + i * lh, maxW));
  ctx.restore();
  return y + fit.lines.length * lh + 6;
}

/**
 * Console frame: near-solid scrim behind the HUD block (y 0 → scrimBottom) + corner brackets that mark the text-safe box.
 * drawHudFrame(ctx, { scrim: true, brackets: true }) → bottom y of the scrim (where the hero area starts)
 */
export function drawHudFrame(ctx, { scrim = true, scrimBottom = 700, brackets = true, color = PALETTE.text } = {}) {
  ctx.save();
  if (scrim) {
    const g = ctx.createLinearGradient(0, 0, 0, scrimBottom);
    g.addColorStop(0, alpha(PALETTE.bg, 0.94)); g.addColorStop(0.84, alpha(PALETTE.bg, 0.9)); g.addColorStop(1, alpha(PALETTE.bg, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, SAFE.width, scrimBottom);
  }
  if (brackets) {
    ctx.strokeStyle = alpha(color, 0.62); ctx.lineWidth = 3; ctx.lineCap = "butt";
    const L = 58, x0 = 41.5, x1 = 962.5, y0 = 197.5, y1 = 1462.5;
    for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x + dx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * L); ctx.stroke();
    }
  }
  ctx.restore();
  return scrim ? scrimBottom : SAFE.topNoText;
}

/**
 * The hero counter block. value is already formatted ("38,440"); it shrinks from `size` (brand 120–180) to fit maxW.
 *   label  small caps line above (DISTANCE TO MOON)    unit   after the number (KM)
 *   units2 dual-unit line below (23,886 MI)             desc   cyan comparison descriptor (≈ 30 EARTHS AWAY)
 * drawCounter(ctx, "38,440", { label: "Distance to Moon", unit: "km", units2: "23,886 mi", desc: "≈ 30 Earths away" }) → bottom y
 */
export function drawCounter(ctx, value, { x = 64, y = 366, maxW = 876, size = 120, label = "", unit = "", units2 = "", desc = "",
  color = PALETTE.amber, glow = true } = {}) {
  ctx.save();
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  if (label) {
    ctx.font = mono(28); tracking(ctx, 2.24); ctx.fillStyle = alpha(PALETTE.text, 0.78);
    ctx.fillText(String(label).toUpperCase(), x, y + 25, maxW); y += 36;
  }
  ctx.font = mono(40); tracking(ctx, 3.2);
  const unitW = unit ? ctx.measureText(String(unit).toUpperCase()).width + 14 : 0;
  let s = size;
  for (; s > 56; s -= 4) { ctx.font = mono(s); tracking(ctx, -0.02 * s); if (ctx.measureText(String(value)).width + unitW <= maxW) break; }
  const base = y + 0.8 * s, w = ctx.measureText(String(value)).width;
  ctx.fillStyle = color;
  if (glow) { ctx.shadowColor = alpha(color, 0.28); ctx.shadowBlur = 36; }
  ctx.fillText(String(value), x, base);
  if (unit) { ctx.font = mono(Math.round(s / 3)); tracking(ctx, 0.08 * s / 3); ctx.fillText(String(unit).toUpperCase(), x + w + 14, base); }
  ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
  y += 1.05 * s;
  ctx.font = mono(30); tracking(ctx, 2.4);
  if (units2) { ctx.fillStyle = alpha(PALETTE.text, 0.72); ctx.fillText(String(units2).toUpperCase(), x, y + 27, maxW); y += 40; }
  if (desc) { ctx.fillStyle = PALETTE.cyan; ctx.fillText(String(desc).toUpperCase(), x, y + 27, maxW); y += 40; }
  ctx.restore();
  return y;
}

/**
 * Caption: Space Grotesk 700 white, centred, ≤ 2 lines (62 px, shrinks to 50), soft dark shadow. Brand slot y 1262–1400.
 * drawCaption(ctx, "We ran the sim.", { y: 1262 }) → bottom y
 */
export function drawCaption(ctx, text, { x = 502, y = 1262, maxW = 840, size = 62, maxLines = 2, color = "#FFFFFF" } = {}) {
  ctx.save();
  const { size: s, lines } = fitWrap(ctx, text, sans, size, 50, maxW, maxLines);
  tracking(ctx, -0.005 * s); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = color;
  const lh = 1.12 * s;
  for (const [blur, oy, a] of [[28, 4, 0.85], [4, 2, 0.7]]) {      // the HUD's two-layer text-shadow
    ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy;
    lines.forEach((l, i) => ctx.fillText(l, x, y + 0.84 * s + i * lh, maxW));
  }
  ctx.restore();
  return y + lines.length * lh;
}
