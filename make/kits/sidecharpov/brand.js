// SIDE CHARACTER POV · brand constants. DOM-free ES module, no imports.
// Single source of truth for the kit (kit/*.js and index.html import from here) and for POVMaker,
// which copies this file + fonts/ unchanged. Font urls are relative to this file's folder.

export const BRAND = { id: "sidecharpov", name: "Side Character POV", handle: "@sidecharpov" };

export const PALETTE = {
  ink: "#111111",     // ink / text outline
  paper: "#FFFFFF",   // paper / main text
  pov: "#FFE14D",     // POV-tag yellow (signature)
  sent: "#3B82F6",    // chat bubble, sent
  recv: "#E5E7EB",    // chat bubble, received
  notif: "#FF3B30",   // notification red
  accent: "#FF4F8B",  // reactions / hearts
  grey: "#6B7280",    // UI secondary text
};

export const FONTS = [
  { family: "Anton", weight: 400, url: "fonts/Anton-400.woff2", use: "meme top-text, POV tag" },
  { family: "Inter", weight: 400, url: "fonts/Inter-400.woff2", use: "UI body" },
  { family: "Inter", weight: 600, url: "fonts/Inter-600.woff2", use: "UI labels" },
  { family: "Inter", weight: 800, url: "fonts/Inter-800.woff2", use: "UI titles" },
  // Noto Color Emoji (OFL), COLRv1 subset of ~440 common emoji (fonts/emoji-set.txt; rebuild with fonts/make-emoji-subset.sh).
  // Always list it right after the text font, e.g. "Anton, 'Noto Color Emoji'", so emoji never fall back to the system set.
  { family: "Noto Color Emoji", weight: 400, url: "fonts/NotoColorEmoji-subset.woff2", use: "every emoji (POV tag, bubbles)" },
];

/** Type + brand-mark geometry on the 1080×1920 canvas (px). */
export const TYPE = {
  topText: { family: "Anton", weight: 400, size: 88, stroke: 6, upper: true },     // brand range 72–96, 6 px black stroke
  povTag: { family: "Anton", weight: 400, size: 54, x: 72, y: 290, rotate: -6 },   // yellow sticker, on screen frame 0 → end (x 72: rotated corner stays ≥ 64)
  bubble: { family: "Inter", weight: 400, size: 40 },                               // ≥ 40 px for phone legibility
};

/** Platform UI safe zones (TikTok / Reels / Shorts at once). */
export const SAFE = {
  width: 1080, height: 1920,
  topNoText: 220,
  bottomNoText: 480,                          // no text below y 1440
  rightRail: { x: 940, y0: 700, y1: 1700 },   // like/comment/share rail
  leftMargin: 64,
  textBox: { x0: 64, x1: 940, y0: 220, y1: 1440 },
  keyBand: { y0: 260, y1: 1100 },
};

/** Draws the safe-zone overlay onto a 1080×1920 2D context: red = no text, green dashed = text-safe box. */
export function drawSafeOverlay(ctx, { labels = true } = {}) {
  const S = SAFE, W = S.width, H = S.height, b = S.textBox;
  ctx.save();
  ctx.fillStyle = "rgba(255,225,77,0.08)";
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
    ctx.fillStyle = "#FFFFFF"; ctx.font = "600 24px Inter, Arial, sans-serif"; ctx.textBaseline = "top";
    for (const [x, y, , , label] of zones) ctx.fillText(label, x + 12, y + 12);
    ctx.fillStyle = "#4ADE80"; ctx.fillText("TEXT-SAFE x 64–940 · y 220–1440", b.x0 + 12, b.y1 - 36);
  }
  ctx.restore();
}

// ---------- canvas-2D primitives (for POVMaker; the kit's HTML components are the reference look) ----------
// Every function is (ctx, ...args), draws in absolute 1080×1920 px, is pure (no Date / Math.random) and restores ctx state.
// Fonts must already be loaded (loadFonts() below, or your own FontFace loader). Emoji come from the bundled
// Noto Color Emoji subset (never the system set). Text auto-fits: it shrinks within the brand range, then wraps.
// Centred text uses x = 502 by default: the centre of the text-safe box (64–940), clear of the right rail, like the kit.

const EMOJI = "'Noto Color Emoji'";
const anton = (px) => `400 ${px}px Anton, ${EMOJI}, Impact, sans-serif`;
const tracking = (ctx, px) => { if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`; };

/** Loads FONTS into document.fonts (browser only). base = URL of the folder that holds brand.js, e.g. "kits/sidecharpov/". */
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
function fitWrap(ctx, text, font, max, min, maxW, maxLines, track = 0) {
  let size = max, lines;
  for (; size >= min; size -= 2) {
    ctx.font = font(size); tracking(ctx, track * size); lines = wrapText(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) break;
  }
  return { size: Math.max(size, min), lines };
}

/** Meme text: white Anton fill over a 12 px ink stroke (6 px shows outside the glyph), centred lines. */
function memeLines(ctx, lines, x, y, size, lh) {
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round"; ctx.miterLimit = 2;
  ctx.lineWidth = 12; ctx.strokeStyle = PALETTE.ink; ctx.fillStyle = PALETTE.paper;
  lines.forEach((l, i) => ctx.strokeText(l, x, y + 0.95 * size + i * lh));
  lines.forEach((l, i) => ctx.fillText(l, x, y + 0.95 * size + i * lh));
}

/**
 * The POV tag sticker (brand mark): yellow, 5 px ink border, tail, hard ink drop shadow, rotated −6° about its
 * bottom-left corner. Anton 54 px, shrinks to 40 px so the rotated sticker stays inside x ≤ 940.
 * drawPovTag(ctx, "POV: you're the fish 🐟") → bottom y (tip of the tail)
 */
export function drawPovTag(ctx, text, { x = TYPE.povTag.x, y = TYPE.povTag.y, size = TYPE.povTag.size, rotate = TYPE.povTag.rotate, maxW = 940 - TYPE.povTag.x } = {}) {
  ctx.save();
  let s = size, tw;
  for (; s > 40; s -= 2) { ctx.font = anton(s); tracking(ctx, 0.005 * s); tw = ctx.measureText(String(text)).width; if (tw + 62 <= maxW) break; }
  const w = Math.min(maxW, tw + 62), h = 1.12 * s + 26;          // padding 10/26/6 + 5 px border, like the CSS sticker
  ctx.translate(x, y + h); ctx.rotate(rotate * Math.PI / 180);   // pivot: bottom-left, so the left edge never drifts
  const body = (d) => { ctx.beginPath(); ctx.roundRect(d + 2.5, d - h + 2.5, w - 5, h - 5, 16); };   // 5 px border inside the box
  const tail = (d) => { ctx.beginPath(); ctx.moveTo(d + 38, d - 5.5); ctx.lineTo(d + 33, d + 34); ctx.lineTo(d + 72, d - 5.5); ctx.closePath(); };
  ctx.lineWidth = 5; ctx.lineJoin = "round"; ctx.strokeStyle = PALETTE.ink; ctx.fillStyle = PALETTE.ink;
  for (const shape of [body, tail]) { shape(7); ctx.fill(); ctx.stroke(); }                   // hard 7 px ink shadow
  ctx.fillStyle = PALETTE.pov; body(0); ctx.fill(); ctx.stroke();
  tail(0); ctx.fill();                                                                         // opens the bottom border
  ctx.beginPath(); ctx.moveTo(38, -5); ctx.lineTo(33, 34); ctx.lineTo(72, -5); ctx.stroke();
  ctx.fillStyle = PALETTE.ink; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(String(text), 31, -h + 15 + 0.95 * s, w - 62);
  ctx.restore();
  return y + h + 34;
}

/**
 * Meme top-text: Anton, UPPERCASE, white with 6 px ink stroke, centred. 88 px (brand 72–96), shrinks to 64, ≤ 3 lines.
 * drawTopText(ctx, "It's 8:01. No food.", { y: 418 }) → bottom y
 */
export function drawTopText(ctx, text, { x = 502, y = 418, maxW = 876, size = TYPE.topText.size, maxLines = 3 } = {}) {
  ctx.save();
  const { size: s, lines } = fitWrap(ctx, String(text).toUpperCase(), anton, size, 64, maxW, maxLines, 0.04);
  const lh = 1.04 * s;
  memeLines(ctx, lines, x, y, s, lh);
  ctx.restore();
  return y + lines.length * lh;
}

/**
 * Side Character's frame is the phone: ink shell (radius 76, 14 px bezel) with a soft drop shadow and a white screen.
 * drawHudFrame(ctx, { x: 90, y: 548, w: 820, h: 920 }) → the screen rect { x, y, w, h, r } to draw the UI into
 */
export function drawHudFrame(ctx, { x = 90, y = 548, w = 820, h = 920, screen = PALETTE.paper, shadow = true } = {}) {
  ctx.save();
  if (shadow) { ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30; }
  ctx.fillStyle = PALETTE.ink; ctx.beginPath(); ctx.roundRect(x, y, w, h, 76); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 74.5); ctx.stroke();
  const r = { x: x + 14, y: y + 14, w: w - 28, h: h - 28, r: 62 };
  ctx.fillStyle = screen; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, r.r); ctx.fill();
  ctx.restore();
  return r;
}

/**
 * Meme counter: optional yellow Anton label above ("DAYS IGNORED"), then a big white Anton number with the ink stroke.
 * value is already formatted ("47", "3,000"); shrinks from 120 px to fit maxW.
 * drawCounter(ctx, "47", { label: "Days on read", y: 620 }) → bottom y
 */
export function drawCounter(ctx, value, { x = 502, y = 620, maxW = 876, size = 120, label = "" } = {}) {
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
  if (label) {
    ctx.font = anton(48); tracking(ctx, 1.9);
    ctx.lineWidth = 10; ctx.strokeStyle = PALETTE.ink; ctx.fillStyle = PALETTE.pov;
    const l = String(label).toUpperCase();
    ctx.strokeText(l, x, y + 46, maxW); ctx.fillText(l, x, y + 46, maxW);
    y += 62;
  }
  let s = size;
  for (; s > 56; s -= 4) { ctx.font = anton(s); tracking(ctx, 0.02 * s); if (ctx.measureText(String(value)).width <= maxW) break; }
  memeLines(ctx, [String(value)], x, y, s, s);
  ctx.restore();
  return y + 1.04 * s;
}

/**
 * Lower meme caption: same Anton + stroke look as the top-text, 64 px (shrinks to 52), ≤ 2 lines. Slot y 1262–1400.
 * drawCaption(ctx, "He blocked me.", { y: 1262 }) → bottom y
 */
export function drawCaption(ctx, text, { x = 502, y = 1262, maxW = 840, size = 64, maxLines = 2 } = {}) {
  ctx.save();
  const { size: s, lines } = fitWrap(ctx, String(text).toUpperCase(), anton, size, 52, maxW, maxLines, 0.04);
  const lh = 1.04 * s;
  memeLines(ctx, lines, x, y, s, lh);
  ctx.restore();
  return y + lines.length * lh;
}
