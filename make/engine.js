// Templates are pure functions of (ctx, t, params): deterministic, so preview and export share one code path.
// Look & layout come from the brand kits' primitives (kits/<brand>/brand.js); this file only does timing and animation.
import { W, H, SAFE, RTS, SC, SITE } from "./brand.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeBack = (x) => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const rows = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const EMO = ', "Noto Color Emoji"';
const mono = (px) => `700 ${px}px "JetBrains Mono", monospace`;
const grot = (px) => `700 ${px}px "Space Grotesk", system-ui, sans-serif`;
const inter = (px, w = 600) => `${w} ${px}px Inter${EMO}, system-ui, sans-serif`;
const P = RTS.PALETTE, M = SC.PALETTE;
const wrap = RTS.wrapText;
const TB = SAFE.textBox, TW = TB.x1 - TB.x0;
const num = (v, d) => { const n = Number(String(v).replace(/[, _]/g, "")); return Number.isFinite(n) ? n : d; };
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const clock = (t) => `T+${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
// Sim-time clock: the counter's progress divided by the stated rate, so the HUD clock and the premise never disagree.
function simClock(s, yrs) {
  s = Math.max(0, Math.round(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d >= 3650 || (yrs && d >= 365)) return `T+${(s / 31557600).toFixed(s / 31557600 < 100 ? 1 : 0)} YR`;   // 10+ years: keeps the HUD tag row legible
  if (d >= 1000) return `T+${d.toLocaleString("en-US")} D`;
  if (d) return `T+${d}D ${String(h).padStart(2, "0")}H ${String(m).padStart(2, "0")}M`;
  if (h) return `T+${h}H ${String(m).padStart(2, "0")}M`;
  return clock(s);
}
function simSpan(s) { // "7 H", "3 M", "2 D", "11 Y": the nearest whole unit
  const u = s >= 31557600 * 0.95 ? [31557600, "Y"] : s >= 86400 * 1.5 ? [86400, "D"] : s >= 3600 * 1.5 ? [3600, "H"] : s >= 90 ? [60, "M"] : [1, "S"];
  const v = Math.max(1, Math.round(s / u[0]));
  return `${v} ${u[1]}`;
}

const epi = (p) => "SIM #" + String(p.episode || "001").padStart(3, "0");
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// Caption in the brand slot (same look as the kit's drawCaption: Space Grotesk 62 -> 50, two soft shadows) with a BALANCED wrap:
// when it needs two lines, split at the word boundary nearest half the text width, so there is never a one-word last line.
function captionBal(ctx, text, { x = 502, y = 1262, maxW = 840, size = 62, minSize = 50, maxLines = 2 } = {}) {
  text = String(text || "").trim(); if (!text) return y;
  ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#FFFFFF";
  let sz = size, lines = [];
  for (; sz >= minSize; sz -= 2) { ctx.font = grot(sz); track(ctx, -0.005 * sz); lines = wrap(ctx, text, maxW); if (lines.length <= maxLines) break; }
  if (lines.length === 2) {
    const w = text.split(/\s+/); let best = null, bd = 1e9;
    for (let i = 1; i < w.length; i++) {
      const a = w.slice(0, i).join(" "), b = w.slice(i).join(" "), wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
      if (wa <= maxW && wb <= maxW && Math.abs(wa - wb) < bd) { bd = Math.abs(wa - wb); best = [a, b]; }
    }
    if (best) lines = best;
  }
  lines = lines.slice(0, maxLines);
  const lh = 1.12 * sz;
  for (const [blur, oy, a] of [[28, 4, 0.85], [4, 2, 0.7]]) {
    ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy;
    lines.forEach((l, i) => ctx.fillText(l, x, y + 0.84 * sz + i * lh, maxW));
  }
  ctx.restore();
  return y + lines.length * lh;
}

// ---------- Ran The Sim look: grid background + HUD brackets ----------
function simBg(ctx, t) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = P.line; ctx.lineWidth = 2;
  const off = (t * 20) % 80;
  for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = -80 + off; y <= H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}
function simFrame(ctx, t, p) {
  simBg(ctx, t);
  RTS.drawHudFrame(ctx, { scrim: false });
  RTS.drawPovTag(ctx, epi(p), { right: clock(t) });
}

// ---------- 1. What If sim (premise hook per shared/whatif/hook-spec.md, then HUD + counter + captions) ----------
const HOLD = 3.0; // premise hold, seconds (hook-spec: 3.0-3.5 s; sim keeps moving underneath)
const track = (ctx, px) => { if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px"; };
const premiseLines = (p) => {
  let ls = rows(p.premise).map((l) => l.replace(/^what if\s+/i, "").toUpperCase());
  if (!ls.length) ls = ["SOMETHING WEIRD HAPPENED?"];
  return ls;
};
// The block: kicker "■ WHAT IF" + premise (<=3 lines, caps, amber "?" + blinking block cursor). Returns bottom y.
function premiseHook(ctx, t, lines, { y = 236 } = {}) {
  const X = 64, PW = 952, PAD = 36, IW = PW - 2 * PAD;
  ctx.save(); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  let ls = lines.slice(0, 3), size = 84;
  const fits = () => { ctx.font = grot(size); track(ctx, -0.01 * size); return ls.every((l) => ctx.measureText(l + "▮").width <= IW); };
  if (ls.length === 1) { ctx.font = grot(72); track(ctx, -0.72); ls = wrap(ctx, ls[0], IW - 60).slice(0, 3); }
  while (size > 48 && !fits()) size -= 4;
  if (ls.length === 3) size = Math.min(size, 80);
  const lh = Math.round(size * 1.02), kick = 56;
  const h = PAD + kick + ls.length * lh + PAD - 8;
  ctx.fillStyle = "rgba(11,15,20,.72)"; rrect(ctx, X, y, PW, h, 18); ctx.fill();
  ctx.strokeStyle = "rgba(255,176,32,.6)"; ctx.lineWidth = 2;
  const L = 44;
  for (const [cx, cy, dx, dy] of [[X, y, 1, 1], [X + PW, y, -1, 1], [X, y + h, 1, -1], [X + PW, y + h, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + dx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * L); ctx.stroke();
  }
  ctx.fillStyle = P.amber; ctx.fillRect(X + PAD, y + PAD + 6, 26, 26);
  ctx.font = mono(52); track(ctx, 3.1); ctx.fillText("WHAT IF", X + PAD + 44, y + PAD + 38);
  ctx.font = grot(size); track(ctx, -0.01 * size);
  ls.forEach((l, i) => {
    const by = y + PAD + kick + (i + 0.82) * lh - 4, last = i === ls.length - 1;
    const q = last && /\?$/.test(l), body = q ? l.slice(0, -1) : l;
    ctx.fillStyle = P.text; ctx.fillText(body, X + PAD, by);
    let x = X + PAD + ctx.measureText(body).width;
    if (q) { ctx.fillStyle = P.amber; ctx.fillText("?", x, by); x += ctx.measureText("?").width; }
    if (last && Math.floor(t / 0.5) % 2 === 0) { ctx.fillStyle = P.amber; ctx.fillRect(x + 10, by - size * 0.74, size * 0.42, size * 0.78); }
  });
  ctx.restore();
  return y + h;
}
// The moving sim behind everything: a body that spirals in to Earth's limb as the counter runs (w 0..1), growing 1x to 3x.
function simHero(ctx, t, w, hot, cam) {
  const cx = 540, cy = 960, EARTH = 104, R0 = 440;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(cam, cam); ctx.translate(-cx, -cy);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = "rgba(61,214,245,.18)"; ctx.lineWidth = 2;
  for (const r of [200, 320, 440]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  const g = ctx.createRadialGradient(cx - 40, cy - 40, 20, cx, cy, 150);
  g.addColorStop(0, "#5FA8D8"); g.addColorStop(1, "#14304A");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, EARTH, 0, 7); ctx.fill();
  const mr = 24 * (1 + 2 * w), limb = EARTH + mr - 4;
  const orbR = limb + (R0 - limb) * (1 - w), sq = 0.8 + 0.2 * w, ang = t * (0.45 + 0.8 * w);
  const ox = cx + Math.cos(ang) * orbR, oy = cy + Math.sin(ang) * orbR * sq;
  for (let i = 1; i <= 14; i++) {
    const a = ang - i * 0.04;
    ctx.fillStyle = `rgba(255,176,32,${0.32 * (1 - i / 14)})`;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * orbR, cy + Math.sin(a) * orbR * sq, Math.max(2, mr * (1 - i / 14) * 0.85), 0, 7); ctx.fill();
  }
  ctx.fillStyle = hot ? P.alert : P.amber; ctx.beginPath(); ctx.arc(ox, oy, mr, 0, 7); ctx.fill();
  for (let i = 0; i < 26; i++) {
    const k = (i * 0.618) % 1, a = i * 2.4 + t * (0.1 + k * 0.25), r = 150 + ((i * 97) % 300) * (1 - 0.3 * w);
    ctx.fillStyle = `rgba(242,244,247,${0.12 + 0.3 * k})`;
    ctx.fillRect(cx + Math.cos(a) * r - 3, cy + Math.sin(a) * r * 0.8 - 3, 6, 6);
  }
  ctx.restore();
  return [ox, oy];
}
const TAIL = 1.5; // contact hold: counter red + flash before the end card
const tailOf = (p) => clamp(num(p.tail, TAIL), 0.5, 4);   // hidden preset param: a longer hold for a caption that has to be read
// Caption plan. "text @5.5" pins a beat to 5.5 s (every line must carry it); otherwise the beats are spaced evenly after the hold.
function stagePlan(p, D) {
  const raw = rows(p.stages), tEnd = D - tailOf(p);
  const m = raw.map((l) => /^(.*\S)\s*@\s*(\d+(?:\.\d+)?)\s*$/.exec(l));
  const texts = raw.map((l, i) => (m[i] ? m[i][1] : l)), n = Math.max(1, texts.length);
  const starts = raw.length && m.every(Boolean) ? m.map((x) => clamp(Number(x[2]), HOLD, tEnd))
    : Array.from({ length: n }, (_, i) => HOLD + (i * (tEnd - HOLD)) / n);
  return { texts, starts, n, tEnd };
}
// ---- per-preset heroes for the 2D sim (Muse presets review): `hero` = sun | dots | atmosphere (default = the orbit-into-Earth) ----
// All are pure functions of the counter, drawn in the 650-1250 hero band under the same camera push (cam).
function heroSun(ctx, t, w, hot, cam) { // "commute": you fly in to a big amber Sun that swells as the distance drops; the counter is the distance to it
  const cx = 540, cy = 960, k = smoothstep(w), sr = 122 * (1 + 0.8 * k) + 3 * Math.sin(t * 2.4);   // 1x -> 1.8x (the hero band ends at the caption bar)
  ctx.save(); ctx.translate(cx, cy); ctx.scale(cam, cam); ctx.translate(-cx, -cy);
  ctx.strokeStyle = "rgba(61,214,245,.18)"; ctx.lineWidth = 2;
  for (const r of [200, 320, 440]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  const gl = ctx.createRadialGradient(cx, cy, sr * 0.6, cx, cy, sr * 2.4);
  gl.addColorStop(0, "rgba(255,176,32,.5)"); gl.addColorStop(1, "rgba(255,176,32,0)");
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, sr * 2.4, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(cx - sr * 0.28, cy - sr * 0.28, sr * 0.08, cx, cy, sr * 1.08);
  g.addColorStop(0, "#FFE2A0"); g.addColorStop(0.55, "#FFB020"); g.addColorStop(1, "#E07A00");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, sr, 0, 7); ctx.fill();
  const orbR = 250 + 190 * (1 - w), ang = t * (0.5 + 0.9 * w) + 0.8, sq = 0.8 + 0.2 * w;   // ends on the Sun's limb (1.8x radius 220 + you)
  for (let i = 1; i <= 14; i++) {
    const a = ang - i * 0.045;
    ctx.fillStyle = `rgba(61,214,245,${0.34 * (1 - i / 14)})`;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * orbR, cy + Math.sin(a) * orbR * sq, Math.max(2, 17 - i), 0, 7); ctx.fill();
  }
  ctx.fillStyle = hot ? P.alert : P.cyan; ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * orbR, cy + Math.sin(ang) * orbR * sq, 18, 0, 7); ctx.fill();
  ctx.restore();
}
function heroDots(ctx, t, v, end, contact, ct, cam) { // "birthday": one dot per person pops in; at the end two flash amber and match
  const cx = 540, cy = 960, COLS = 6, GAP = 118, n = Math.max(1, Math.round(end)), A = 6, B = Math.min(n - 1, 17);
  const pos = (i) => [cx + ((i % COLS) - (COLS - 1) / 2) * GAP, cy + (Math.floor(i / COLS) - 1.5) * GAP];
  ctx.save(); ctx.translate(cx, cy); ctx.scale(cam, cam); ctx.translate(-cx, -cy);
  for (let i = 0; i < n; i++) {
    const k = easeBack(clamp(v - i)); if (k <= 0) continue;
    const [x, y] = pos(i), m = contact && (i === A || i === B);
    const a = contact && !m ? 0.28 : 0.9;
    ctx.fillStyle = m ? P.amber : `rgba(61,214,245,${a})`;
    ctx.beginPath(); ctx.arc(x, y, 30 * k * (m ? 1 + 0.18 * Math.sin(ct * 18) : 1), 0, 7); ctx.fill();
    if (m) { ctx.strokeStyle = "rgba(255,176,32,.7)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 46 + 34 * clamp(ct / 0.5), 0, 7); ctx.stroke(); }
  }
  if (contact) {
    const [x1, y1] = pos(A), [x2, y2] = pos(B), k = clamp(ct / 0.35);
    ctx.strokeStyle = P.amber; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k); ctx.stroke();
  }
  ctx.restore();
}
function heroAtmos(ctx, t, frac, hot, cam) { // "oxygen": Earth with a halo that thins to nothing as the counter runs down
  const cx = 540, cy = 960;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(cam, cam); ctx.translate(-cx, -cy);
  const f = clamp(frac), th = 40 + 170 * f;
  const g = ctx.createRadialGradient(cx, cy, 150, cx, cy, 150 + th);
  g.addColorStop(0, `rgba(61,214,245,${(0.55 * f).toFixed(3)})`); g.addColorStop(1, "rgba(61,214,245,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 150 + th, 0, 7); ctx.fill();
  ctx.strokeStyle = `rgba(61,214,245,${(0.35 * f).toFixed(3)})`; ctx.lineWidth = 3;
  for (const k of [0.35, 0.7, 1]) { ctx.beginPath(); ctx.arc(cx, cy, 150 + th * k, 0, 7); ctx.stroke(); }
  const e = ctx.createRadialGradient(cx - 40, cy - 40, 20, cx, cy, 170);
  e.addColorStop(0, f > 0.02 ? "#5FA8D8" : "#6b7683"); e.addColorStop(1, f > 0.02 ? "#14304A" : "#2a3038");
  ctx.fillStyle = e; ctx.beginPath(); ctx.arc(cx, cy, 150, 0, 7); ctx.fill();
  ctx.restore();
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function heroSeasons(ctx, t, age, cam) { // "life": a window onto a tree that runs a full year of seasons per counter year; the room changes with the age
  const cx = 540, cy = 960, ph = ((age % 1) + 1) % 1, A = Math.floor(age + 1e-9);
  const KEY = [ // spring, summer, autumn, winter (centred on phase 0, .25, .5, .75)
    { sky: ["#86B6DA", "#D3E6F0"], leaf: "#8FD18A", la: 0.9, ground: "#5E8F4E" },
    { sky: ["#4F9FD6", "#BFE0F2"], leaf: "#3FA34D", la: 1, ground: "#3E7F3A" },
    { sky: ["#8C93A8", "#E0BE9C"], leaf: "#E39A3B", la: 0.92, ground: "#8A6B3A" },
    { sky: ["#69758A", "#CBD4DD"], leaf: "#C8D0D8", la: 0, ground: "#E6ECF1" }];
  const W4 = KEY.map((_, i) => { let d = Math.abs(ph - i / 4); d = Math.min(d, 1 - d); return Math.max(0, 1 - 4 * d); });
  const sum = W4.reduce((a, b) => a + b, 0), wt = W4.map((x) => x / sum);
  const col = (k) => { const c = [0, 0, 0]; KEY.forEach((K, i) => { const r = hexRgb(typeof K[k] === "string" ? K[k] : K[k][0]); for (let j = 0; j < 3; j++) c[j] += r[j] * wt[i]; }); return `rgb(${c.map(Math.round).join(",")})`; };
  const sky1 = col("sky"), leaf = col("leaf"), ground = col("ground");
  const skyB = (() => { const c = [0, 0, 0]; KEY.forEach((K, i) => { const r = hexRgb(K.sky[1]); for (let j = 0; j < 3; j++) c[j] += r[j] * wt[i]; }); return `rgb(${c.map(Math.round).join(",")})`; })();
  const leafA = KEY.reduce((a, K, i) => a + K.la * wt[i], 0);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(cam, cam); ctx.translate(-cx, -cy);
  // wall + floor
  ctx.fillStyle = "#2C3645"; ctx.fillRect(64, 650, 952, 430);
  ctx.fillStyle = "#493B35"; ctx.fillRect(64, 1080, 952, 160);
  ctx.fillStyle = "#364152"; ctx.fillRect(64, 1070, 952, 10);
  ctx.fillStyle = "#5C7085"; ctx.beginPath(); ctx.ellipse(540, 1180, 360, 44, 0, 0, 7); ctx.fill();   // rug
  // window: the tree outside
  const wx = 190, wy = 690, ww = 700, wh = 340;
  ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  const sg = ctx.createLinearGradient(0, wy, 0, wy + wh); sg.addColorStop(0, sky1); sg.addColorStop(1, skyB);
  ctx.fillStyle = sg; ctx.fillRect(wx, wy, ww, wh);
  ctx.fillStyle = ground; ctx.fillRect(wx, wy + 250, ww, 90);
  const tx = 540, by = wy + 262;
  ctx.fillStyle = "#4A3A2E"; ctx.fillRect(tx - 17, by - 150, 34, 160);
  ctx.strokeStyle = "#4A3A2E"; ctx.lineWidth = 12; ctx.lineCap = "round";
  for (const [x2, y2] of [[-90, -210], [90, -215], [-50, -240], [55, -245], [0, -265]]) { ctx.beginPath(); ctx.moveTo(tx, by - 120); ctx.lineTo(tx + x2, by + y2 + 60); ctx.stroke(); }
  if (leafA > 0.02) {
    ctx.globalAlpha = leafA; ctx.fillStyle = leaf;
    for (const [dx, dy, r] of [[0, -190, 92], [-78, -150, 70], [78, -150, 70], [0, -250, 62], [-44, -215, 64], [44, -215, 64]]) { ctx.beginPath(); ctx.arc(tx + dx, by + dy, r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  if (wt[0] > 0.05) { ctx.fillStyle = `rgba(255,190,214,${(0.9 * wt[0]).toFixed(2)})`; for (let i = 0; i < 12; i++) { const a = i * 2.39; ctx.beginPath(); ctx.arc(tx + Math.cos(a) * (30 + (i % 4) * 22), by - 190 + Math.sin(a) * (24 + (i % 3) * 26), 7, 0, 7); ctx.fill(); } }
  if (wt[2] > 0.05) { ctx.fillStyle = `rgba(227,154,59,${wt[2].toFixed(2)})`; for (let i = 0; i < 9; i++) { const f = ((t * 0.5 + i * 0.11) % 1); ctx.beginPath(); ctx.ellipse(tx - 160 + i * 38 + Math.sin(f * 9 + i) * 14, wy + 40 + f * 280, 9, 5, f * 6 + i, 0, 7); ctx.fill(); } }
  if (wt[3] > 0.05) { ctx.fillStyle = `rgba(255,255,255,${(0.95 * wt[3]).toFixed(2)})`; for (let i = 0; i < 14; i++) { const f = ((t * 0.7 + i * 0.073) % 1); ctx.beginPath(); ctx.arc(wx + 30 + i * 49 + Math.sin(f * 7 + i) * 10, wy + f * wh, 4, 0, 7); ctx.fill(); } }
  ctx.restore();
  ctx.strokeStyle = "#151B24"; ctx.lineWidth = 16; ctx.strokeRect(wx, wy, ww, wh);
  ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
  // the room changes with you: crib -> bed + school desk -> bed + laptop desk
  const bed = (x) => { ctx.fillStyle = "#6B5646"; rrect(ctx, x, 1118, 300, 96, 10); ctx.fill(); ctx.fillStyle = "#3DD6F5"; ctx.globalAlpha = 0.35; rrect(ctx, x + 14, 1128, 272, 52, 8); ctx.fill(); ctx.globalAlpha = 1; };
  if (A >= 10) { ctx.fillStyle = "#3A475A"; ctx.fillRect(110, 760, 56, 78); ctx.fillStyle = P.amber; ctx.fillRect(122, 774, 32, 22); }   // a poster goes up at ten
  if (A < 4) {
    ctx.strokeStyle = "#B08A5E"; ctx.lineWidth = 8; ctx.strokeRect(300, 1100, 280, 112);
    ctx.lineWidth = 5; for (let i = 1; i < 9; i++) { ctx.beginPath(); ctx.moveTo(300 + i * 31, 1100); ctx.lineTo(300 + i * 31, 1212); ctx.stroke(); }
    ctx.fillStyle = "#F2F4F7"; ctx.globalAlpha = 0.5; ctx.fillRect(308, 1160, 264, 46); ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(242,244,247,.55)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(440, 1060); ctx.lineTo(440, 1090); ctx.stroke();   // mobile
    for (let i = 0; i < 3; i++) { const a = t * 3.1 + i * 2.09; ctx.fillStyle = [P.amber, P.cyan, "#F2F4F7"][i]; ctx.beginPath(); ctx.arc(440 + Math.cos(a) * 46, 1092 + Math.sin(a) * 8, 10, 0, 7); ctx.fill(); }
  } else {
    bed(220);
    ctx.fillStyle = "#5A4636"; ctx.fillRect(640, 1120, 270, 18); ctx.fillRect(650, 1138, 14, 78); ctx.fillRect(886, 1138, 14, 78);   // desk
    if (A < 12) { ctx.fillStyle = P.amber; rrect(ctx, 570, 1150, 56, 66, 12); ctx.fill(); ctx.fillStyle = "#E8EEF3"; ctx.fillRect(700, 1096, 70, 24); ctx.fillStyle = "#8FD18A"; ctx.fillRect(782, 1086, 30, 34); }   // backpack, books
    else {
      ctx.fillStyle = "#0B0F14"; rrect(ctx, 700, 1050, 150, 90, 6); ctx.fill(); ctx.fillStyle = "rgba(61,214,245,.85)"; ctx.fillRect(710, 1060, 130, 70);
      ctx.fillStyle = "#1B222C"; ctx.fillRect(686, 1140, 180, 8);
      const g = ctx.createRadialGradient(775, 1100, 10, 775, 1100, 150); g.addColorStop(0, "rgba(61,214,245,.28)"); g.addColorStop(1, "rgba(61,214,245,0)"); ctx.fillStyle = g; ctx.fillRect(600, 960, 340, 220);
    }
  }
  ctx.restore();
}
const curveAt = (pts, u) => { for (let i = 1; i < pts.length; i++) if (u <= pts[i][0] || i === pts.length - 1) { const [u0, w0] = pts[i - 1], [u1, w1] = pts[i]; return w0 + (w1 - w0) * clamp((u - u0) / Math.max(1e-9, u1 - u0)); } return 0; };
let SLEEP_OFF = null;
function heroClock(ctx, t, HR, cam) { // "sleepless": a 24 h dial that laps, a cup tower that grows once a day, and (after 2 days) our picture of hallucination
  const wob = clamp((HR - 40) / 180), day = Math.floor(HR / 24) + 1, hr = (7 + Math.floor(HR)) % 24;
  const g = (() => {
    if (wob > 0.02) {
      if (!SLEEP_OFF) SLEEP_OFF = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H });
      const c = SLEEP_OFF.getContext("2d"); c.clearRect(0, 0, W, H); return c;
    }
    return ctx;
  })();
  const direct = g === ctx;
  const cx = 450, cy = 915, R = 210, ang = ((7 + HR) / 24) * Math.PI * 2 - Math.PI / 2;
  g.save();
  if (direct) { g.translate(540, 960); g.scale(cam, cam); g.translate(-540, -960); }
  g.fillStyle = "#1B222C"; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.strokeStyle = "rgba(61,214,245,.55)"; g.lineWidth = 5; g.stroke();
  g.strokeStyle = "#0B0F14"; g.lineWidth = 44;   // night (22:00-06:00)
  g.beginPath(); g.arc(cx, cy, R - 30, -Math.PI / 2 + (22 / 24) * Math.PI * 2, -Math.PI / 2 + (30 / 24) * Math.PI * 2); g.stroke();
  g.fillStyle = "rgba(242,244,247,.8)"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = mono(26);
  for (const [h, l] of [[0, "12 AM"], [6, "6 AM"], [12, "12 PM"], [18, "6 PM"]]) { const a = (h / 24) * Math.PI * 2 - Math.PI / 2; g.fillText(l, cx + Math.cos(a) * (R + 46), cy + Math.sin(a) * (R + 46)); }
  g.strokeStyle = "rgba(242,244,247,.5)"; g.lineWidth = 3;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); g.lineTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22)); g.stroke(); }
  g.strokeStyle = P.amber; g.lineWidth = 12; g.lineCap = "round"; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang) * (R - 38), cy + Math.sin(ang) * (R - 38)); g.stroke();
  g.fillStyle = P.amber; g.beginPath(); g.arc(cx + Math.cos(ang) * (R - 38), cy + Math.sin(ang) * (R - 38), 22, 0, 7); g.fill();
  g.fillStyle = "#0B0F14"; g.beginPath(); g.arc(cx, cy, 15, 0, 7); g.fill();
  g.fillStyle = P.text; g.font = mono(54); g.fillText(`${hr % 12 || 12}:00 ${hr < 12 ? "AM" : "PM"}`, cx, cy + 92);
  g.fillStyle = P.cyan; g.font = mono(32); g.fillText(`DAY ${day}`, cx, cy + R + 88);
  const cups = Math.min(12, day);   // the cup tower: one cup per day awake
  for (let i = 0; i < cups; i++) {
    const sway = Math.sin(t * 2.1 + i * 0.55) * wob * (2 + i * 1.6), y = 1196 - (i + 1) * 40;
    g.fillStyle = i % 2 ? "#E8EEF3" : "#C9D2DC"; g.beginPath(); g.moveTo(790 + sway - 50, y); g.lineTo(790 + sway + 50, y); g.lineTo(790 + sway + 40, y + 36); g.lineTo(790 + sway - 40, y + 36); g.closePath(); g.fill();
  }
  if (HR >= 17 && HR < 28) {   // performance equivalence, shown only inside the studied range (up to 28 h awake)
    const chip = HR < 24 ? "PERFORMS LIKE 0.05% BAC" : "PERFORMS LIKE 0.10% BAC";
    g.font = mono(24); const w = g.measureText(chip).width + 36;
    g.fillStyle = "rgba(11,15,20,.82)"; rrect(g, 790 - w / 2, 684, w, 48, 10); g.fill();
    g.strokeStyle = P.amber; g.lineWidth = 3; g.stroke(); g.fillStyle = P.amber; g.fillText(chip, 790, 709);
  }
  g.restore();
  if (!direct) {
    ctx.save(); ctx.translate(540, 960); ctx.scale(cam, cam); ctx.translate(-540, -960);
    for (let y = 640; y < 1250; y += 6) { const dx = Math.sin(y * 0.021 + t * 1.7) * wob * 30; ctx.drawImage(SLEEP_OFF, 0, y, W, 6, dx, y, W, 6); }
    ctx.fillStyle = `rgba(36,70,52,${(0.28 * wob).toFixed(3)})`; ctx.fillRect(0, 640, W, 610);   // a grey-green grade as it gets worse
    ctx.restore();
  }
}
function drawWhatIfSim(ctx, t, p, D) {
  const { texts: stages, starts, n, tEnd } = stagePlan(p, D);
  let si = -1; for (let i = 0; i < n; i++) if (t >= starts[i] - 1e-9) si = i;
  const sT = si < 0 ? 0 : t - starts[si];
  const curve = String(p.curve || "").split(",").map((x) => x.split(":").map(Number)).filter((x) => x.length === 2 && x.every(Number.isFinite));  // "u:w,u:w": piecewise-linear time map
  const lin = String(p.ease || "") === "linear" || curve.length > 1, calm = ["seasons", "clock"].includes(String(p.hero || ""));   // calm = a pause, not a crash
  const contact = t >= tEnd, ct = t - tEnd;
  const hit = (si >= 0 && sT < 0.35) || contact;
  const u = clamp(t / tEnd);
  const a = num(p.start, 0), b = num(p.end, 1e6), v = a + (b - a) * (curve.length > 1 ? curveAt(curve, u) : lin ? u : Math.pow(u, 2.2));
  const w = b === a ? 1 : clamp((v - a) / (b - a));
  const rate = Math.max(1e-9, num(p.rate, 1)), simS = Math.abs(v - a) / rate;
  const shake = contact && !calm && ct < 0.3 ? Math.sin(ct * 110) * 14 * (1 - ct / 0.3) : 0;
  const cam = 1 + (calm ? 0.06 : 0.3) * clamp(t / tEnd);
  ctx.save(); ctx.translate(shake, shake * 0.5);
  const hero = String(p.hero || ""), endWord = String(p.endWord || "").trim().toUpperCase() || "CONTACT";
  simBg(ctx, t);
  let mx = 540, my = 960;
  if (hero === "sun") heroSun(ctx, Math.min(t, tEnd), w, hit, cam);
  else if (hero === "dots") heroDots(ctx, t, Math.abs(v - a), Math.abs(b - a), contact, ct, cam);
  else if (hero === "atmosphere") heroAtmos(ctx, t, 1 - w, hit, cam);
  else if (hero === "clock") heroClock(ctx, t, v, cam);
  else if (hero === "seasons") heroSeasons(ctx, t, contact ? Math.floor(v + 1e-9) + 0.75 : v, cam);   // the pause lands on a still winter frame
  else [mx, my] = simHero(ctx, Math.min(t, tEnd), w, hit, cam);
  if (contact && !calm && ct < 0.7) { // shockwave from the contact point
    ctx.save(); ctx.strokeStyle = `rgba(255,90,60,${0.7 * (1 - ct / 0.7)})`; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(540 + (mx - 540) * cam, 960 + (my - 960) * cam, 60 + ct * 1300, 0, 7); ctx.stroke(); ctx.restore();
  }
  const lbl = String(p.label || "COUNT");
  const shown = (x) => (String(p.int || "") === "floor" ? Math.floor(x + 1e-9).toLocaleString("en-US") : fmt(x));   // an age ticks over on its birthday
  const unit0 = String(p.unit || "").trim(), unitFor = (x) => (String(p.int || "") === "floor" && Math.floor(x + 1e-9) === 1 ? unit0.replace(/s$/, "") : unit0);
  if (t < HOLD) {
    const bt = premiseHook(ctx, t, premiseLines(p));
    RTS.drawCounter(ctx, shown(v), { y: bt + 24, size: 96, unit: unitFor(v), label: "" });
  } else {
    RTS.drawHudFrame(ctx, { scrim: true });
    RTS.drawPovTag(ctx, `${epi(p)} · ${String(p.tag || "").trim() || "WHAT IF"}`, { right: simClock(simS, String(p.clock || "") === "years") });
    const full = Math.abs(b - a) / rate, per = full / Math.max(0.1, lin ? tEnd : tEnd - HOLD); // average sim seconds per real second
    ctx.save(); ctx.font = mono(24); track(ctx, 1.2); ctx.fillStyle = P.cyan; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.fillText(`▶▶ 1 S ≈ ${simSpan(per)}`, 940, 296); ctx.restore();
    const cb = RTS.drawCounter(ctx, shown(v), { y: 320, size: 150, unit: unitFor(v), label: lbl,
      desc: contact ? (calm ? `STAGE ${n}/${n} · ${endWord}` : endWord) : `STAGE ${Math.max(1, si + 1)}/${n}`, color: (calm && !contact ? false : hit) ? P.alert : P.amber });
    if (String(p.rule || "").trim()) {
      ctx.save(); ctx.font = mono(28); track(ctx, 1.6); ctx.fillStyle = "rgba(242,244,247,.78)"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(String(p.rule).toUpperCase(), 64, cb + 40, 876); ctx.restore();
    }
    const k = easeBack(sT / 0.25);
    ctx.save(); ctx.globalAlpha = clamp(sT / 0.15); ctx.translate(0, (1 - k) * 30);
    captionBal(ctx, stages[si] || "", { y: 1262 });
    ctx.restore();
    ctx.fillStyle = P.line; ctx.fillRect(TB.x0, 1240, TW, 6);
    ctx.fillStyle = contact ? P.alert : P.amber; ctx.fillRect(TB.x0, 1240, TW * u, 6);
    if (hit && sT < 1 / 30 && !contact) { ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(0, 0, W, H); }
  }
  ctx.restore();
  if (contact && !calm && ct < 0.25) { ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - ct / 0.25)})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- 1b. What If · Night Sky (3D): one three.js scene (make/3d-src/scene3d.js) under our scene-style HUD ----------
// The scene module is loaded lazily by make.js (set3D). Until it is there, or if its GL context is lost, a flat 2D stand-in
// is drawn so nothing ever breaks mid-preview/export (make.js also tells the user and swaps to the 2D sim for the export).
let G3 = null;
export const set3D = (m) => { G3 = m; };
export const get3D = () => G3;
export const set3DRes = (h) => { if (G3 && !G3.lost) G3.setRes(h); };
const HOLD3 = 3.5, RULE_S = 1.8, SURGE = 2.0, K3 = 20.6, R0_3 = 23.3; // premise hold; rule caption at the cut; contact surge; Moon grows x20.6 (R 23 -> 480 px = 89% of the frame width)
const smoothstep = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
// Everything the scene shows is a function of u (run progress): the Moon's size follows the true 1/d law because the
// counter itself is d(t) = end + (start - end) / K^u, so the pixels and the number can never disagree.
function law3(t, p, D) {
  const tEnd = D - TAIL, tRun = tEnd - SURGE, u = clamp(t / tRun);
  const a = num(p.start, 0), b = num(p.end, 0);
  const e = Math.pow(u, 0.88), s = clamp((t - tRun) / SURGE);                     // e: early growth a touch faster
  const f = Math.pow(K3, -e) * (1 - s);                                           // last ~2 s: the remaining distance runs down to 0 continuously
  const v = b + (a - b) * f, Rrun = R0_3 * Math.pow(K3, e), R75 = R0_3 * Math.pow(K3, Math.pow(0.75, 0.88));
  const R = Rrun * (1 + 0.38 * smoothstep(s));                                    // the Moon keeps ballooning until its limb leaves the frame (>= 110% of width)
  return { tEnd, u, s, v, R, moonY: 1050 - 145 * smoothstep(u) - 160 * smoothstep(s), horizon: 1350 + 70 * smoothstep(Math.min(1, u / 0.85)),
    tide: Math.min(0.9, 0.5 * Math.pow(Rrun / R75, 3)), bright: u, starK: 1 - 0.8 * smoothstep((u - 0.5) / 0.45), contact: t >= tEnd };
}
const dual = (v, unit) => {
  const u = String(unit || "").trim().toLowerCase(), n = Math.abs(v);
  if (u === "km") return fmt(n * 0.621371) + " MI";
  if (u === "m") return fmt(n * 3.28084) + " FT";
  if (u === "kg") return fmt(n * 2.20462) + " LB";
  if (u === "km/h" || u === "km/s") return fmt(n * 0.621371) + (u === "km/h" ? " MPH" : " MI/S");
  return "";
};
function premiseScene(ctx, t, text) {
  let q = String(text || "").trim() || "What if something weird happened?";
  if (!/^what if\b/i.test(q)) q = "What if " + q.charAt(0).toLowerCase() + q.slice(1);
  if (!/[?]$/.test(q)) q += "?";
  const X = 64, PW = 952, PADX = 30, IW = PW - 2 * PADX, TOP = 236;
  ctx.save(); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  // greedy wrap on plain spaces only; "1 km" keeps its number and unit together (no-break space)
  q = q.replace(/(\d)[ \t]+(?=[A-Za-z°%/])/g, "$1\u00A0");
  const hard = q.split("\n").map((l) => l.trim()).filter(Boolean);   // the user's own line breaks win
  let size = 80, ls;
  for (; size >= 72; size -= 8) {
    ctx.font = grot(size); track(ctx, -0.005 * size); ls = [];
    for (const seg of hard) {
      let cur = "";
      for (const w of seg.split(" ")) { const tryS = cur ? cur + " " + w : w; if (cur && ctx.measureText(tryS).width > IW) { ls.push(cur); cur = w; } else cur = tryS; }
      if (cur) ls.push(cur);
    }
    if (ls.length <= 3) break;
  }
  ls = ls.slice(0, 3);
  const lh = Math.round(size * 1.05), kickBase = TOP + 26 + 40;
  const g = ctx.createLinearGradient(0, 200, 0, 760); g.addColorStop(0, "rgba(10,14,20,.30)"); g.addColorStop(1, "rgba(10,14,20,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 200, W, 560);
  const shadow = () => { ctx.shadowColor = "rgba(10,14,20,.65)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 3; };
  ctx.save(); shadow(); ctx.fillStyle = P.amber; ctx.fillRect(X + PADX, kickBase - 30, 26, 26);
  ctx.font = mono(44); track(ctx, 3.5); ctx.fillText(`SIM #${String(1).padStart(3, "0")}`, X + PADX + 44, kickBase); ctx.restore();
  const bottom = kickBase + 14 + ls.length * lh + 26;
  ctx.save(); shadow(); ctx.font = grot(size); track(ctx, -0.005 * size);
  ls.forEach((l, i) => {
    const by = kickBase + 14 + (i + 0.84) * lh, last = i === ls.length - 1, qm = last && l.endsWith("?"), body = qm ? l.slice(0, -1) : l;
    ctx.fillStyle = P.text; ctx.fillText(body, X + PADX, by);
    let x = X + PADX + ctx.measureText(body).width;
    if (qm) { ctx.fillStyle = P.amber; ctx.fillText("?", x, by); x += ctx.measureText("?").width; }
    if (last && Math.floor(t / 0.5) % 2 === 0) { ctx.fillStyle = P.amber; ctx.fillRect(x + 8, by - size * 0.7, size * 0.46, size * 0.72); }
  });
  ctx.restore();
  ctx.strokeStyle = "rgba(255,176,32,.8)"; ctx.lineWidth = 2; const L = 36;   // TL + BR brackets only
  ctx.beginPath(); ctx.moveTo(X, TOP + L); ctx.lineTo(X, TOP); ctx.lineTo(X + L, TOP); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X + PW - L, bottom); ctx.lineTo(X + PW, bottom); ctx.lineTo(X + PW, bottom - L); ctx.stroke();
  ctx.restore();
  return bottom;
}
function drawWhatIf3D(ctx, t, p, D) {
  const stages = rows(p.stages), n = Math.max(1, stages.length), L = law3(t, p, D), tEnd = L.tEnd;
  const tS = HOLD3 + (String(p.rule || "").trim() ? RULE_S : 0), stageT = (tEnd - tS) / n;
  const si = t < tS ? -1 : Math.min(n - 1, Math.floor((t - tS) / stageT)), sT = si < 0 ? 0 : t - tS - si * stageT;
  const contact = L.contact, ct = t - tEnd, hit = (si >= 0 && sT < 0.35) || contact;
  const shake = contact && ct < 0.3 ? Math.sin(ct * 110) * 14 * (1 - ct / 0.3) : 0;
  ctx.save(); ctx.translate(shake, shake * 0.5);
  let drawn = false;
  if (G3 && !G3.lost) {
    try {
      const cv = G3.render({ t, rPx: L.R, moonY: L.moonY, horizon: L.horizon, tide: L.tide, bright: L.bright, starK: L.starK });
      ctx.drawImage(cv, 0, 0, W, H); drawn = true;
    } catch (e) { G3.lost = true; }
  }
  if (!drawn) { // stand-in while the 3D module loads / after a lost context
    simBg(ctx, t);
    ctx.fillStyle = "#D9DCE0"; ctx.beginPath(); ctx.arc(540, L.moonY, L.R, 0, 7); ctx.fill();
    ctx.fillStyle = "#0b2236"; ctx.fillRect(0, L.horizon, W, H - L.horizon);
  }
  if (contact && ct < 0.7) { // shockwave from the Moon's centre
    ctx.save(); ctx.strokeStyle = `rgba(255,90,60,${0.7 * (1 - ct / 0.7)})`; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(540, L.moonY, L.R * 0.6 + ct * 1300, 0, 7); ctx.stroke(); ctx.restore();
  }
  const unit = String(p.unit || "").trim(), color = hit ? P.alert : P.amber;
  if (t < HOLD3) {
    const bt = premiseScene(ctx, t, p.premise);
    RTS.drawCounter(ctx, fmt(L.v), { y: bt + 14, size: 96, unit, label: "" });
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 700); g.addColorStop(0, `rgba(10,14,20,${(0.42 + 0.3 * smoothstep((L.R - 300) / 360)).toFixed(3)})`); g.addColorStop(1, "rgba(10,14,20,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 760);
    const bt = RTS.drawCounter(ctx, fmt(L.v), { y: 236, size: 120, unit, units2: dual(L.v, unit),
      desc: contact ? "CONTACT" : String(p.label || "").trim(), color });
    const a = num(p.start, 0), rate = Math.max(1e-9, num(p.rate, 1)), simS = Math.abs(L.v - a) / rate;
    const per = Math.abs(num(p.end, 0) - a) / rate / Math.max(0.1, tEnd - HOLD3);
    ctx.save(); ctx.font = mono(24); track(ctx, 1.2); ctx.fillStyle = "rgba(242,244,247,.78)"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(10,14,20,.7)"; ctx.shadowBlur = 8;
    ctx.fillText(`${simClock(simS)}  ·  ▶▶ 1 S ≈ ${simSpan(per)}`, 64, bt + 24, 876); ctx.restore();
    const cap = si < 0 ? String(p.rule || "").trim() : (contact && String(p.payoff || "").trim() ? String(p.payoff).trim() : stages[si] || "");
    const k = si < 0 ? 1 : easeBack(sT / 0.25);
    ctx.save(); ctx.globalAlpha = si < 0 ? 1 : clamp(sT / 0.15); ctx.translate(0, (1 - k) * 30);
    captionBal(ctx, cap, { y: 1262 });
    ctx.restore();
    if (hit && sT < 1 / 30 && !contact && si >= 0) { ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(0, 0, W, H); }
  }
  ctx.restore();
  if (contact && ct < 0.25) { ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - ct / 0.25)})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- 2. Day timeline ----------
function drawTimeline(ctx, t, p, D) {
  const items = rows(p.lines).map((l) => { const i = l.indexOf(":"); return i > 0 && i < 24 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ["", l]; });
  const n = Math.max(1, items.length), gap = (D - 2.0 - 1.2) / n;
  simFrame(ctx, t, p);
  const qb = RTS.drawTopText(ctx, p.question || "");
  const cur = Math.min(n - 1, Math.floor((t - 0.4) / gap));
  const rowH = 190, top = Math.max(600, qb + 90), maxRows = 4;
  const first = Math.max(0, cur - (maxRows - 1));
  ctx.strokeStyle = P.line; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(TB.x0 + 14, top - 20); ctx.lineTo(TB.x0 + 14, top + maxRows * rowH - 70); ctx.stroke();
  for (let i = first; i <= cur; i++) {
    if (i < 0) continue;
    const y = top + (i - first) * rowH, age = t - (0.4 + i * gap), k = easeBack(age / 0.3);
    const latest = i === cur;
    ctx.save(); ctx.globalAlpha = (latest ? 1 : 0.45) * clamp(age / 0.15);
    ctx.fillStyle = latest ? P.amber : P.cyan; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.beginPath(); ctx.arc(TB.x0 + 14, y + 20, 14 * (0.6 + 0.4 * k), 0, 7); ctx.fill();
    ctx.font = mono(34); ctx.fillText(items[i][0].toUpperCase(), TB.x0 + 56, y + 32);
    ctx.fillStyle = P.text; ctx.font = grot(46);
    wrap(ctx, items[i][1], TW - 70).slice(0, 2).forEach((l, j) => ctx.fillText(l, TB.x0 + 56, y + 92 + j * 54));
    ctx.restore();
  }
}

// ---------- 3. POV chat (Side Character look: sticker + phone, over a moving scene) ----------
const MAX_MSGS = 6;
// "Sender: text @2.5" -> {who, me, text, at?}. "me:" = sent (blue, right). No prefix = the chat's contact.
function parseChat(p) {
  return rows(p.messages).slice(0, MAX_MSGS).map((l) => {
    let at = null; l = l.replace(/\s@(\d+(?:\.\d+)?)\s*$/, (m, a) => { at = Number(a); return ""; });
    const m = l.match(/^([^:\n]{1,18}):\s*(.*)$/);
    const who = m ? m[1].trim() : "", text = m ? m[2] : l;
    return { who, me: /^me$/i.test(who), text, at };
  });
}
function chatTimes(msgs) {
  let t = 0; const gap = 1.7;
  return msgs.map((m, i) => { const at = m.at != null ? m.at : (i ? t + gap : t); t = at; return at; });
}
function chatDuration(p) { const ts = chatTimes(parseChat(p)); return clamp(ts[ts.length - 1] + 2.4, 5, 30); }
function chatScene(ctx, t, kind) {
  const sc = {
    pond: ["#BFE3F5", "#5BA7D6", "#2F6F9F"], meadow: ["#CDEBFF", "#9ED36A", "#6AA84F"],
    night: ["#0B1030", "#27306B", "#121842"], plain: ["#EEF0F4", "#E2E5EB", "#EEF0F4"],
  }[kind] || null;
  if (!sc) kind = "plain";
  const c = sc || ["#EEF0F4", "#E2E5EB", "#EEF0F4"];
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c[0]); g.addColorStop(0.55, c[1]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (kind === "plain") return;
  ctx.save();
  if (kind === "night") {
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 40; i++) { const x = (i * 211) % W, y = (i * 137) % 700, a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i)); ctx.globalAlpha = a; ctx.fillRect(x, y, 4, 4); }
    ctx.globalAlpha = 1; ctx.fillStyle = "#F5E9B8"; ctx.beginPath(); ctx.arc(860, 330, 70, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for (let i = 0; i < 4; i++) { const x = ((i * 330 + t * 28) % (W + 400)) - 200, y = 330 + i * 70; ctx.beginPath(); ctx.ellipse(x, y, 130, 38, 0, 0, 7); ctx.ellipse(x + 70, y + 12, 90, 30, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 6; ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const y = 1520 + i * 90; ctx.beginPath();
      for (let x = 40; x <= 1040; x += 20) { const yy = y + Math.sin(x / 70 + t * 1.6 + i * 1.7) * 14; x === 40 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawPovChat(ctx, t, p, D) {
  const msgs = parseChat(p), times = chatTimes(msgs), n = msgs.length;
  chatScene(ctx, t, p.scene);
  const lastAt = times[n - 1], sh = n > 1 && t >= lastAt + 0.3 && t < lastAt + 0.7 ? (Math.sin(t * 90) * 8) : 0;
  ctx.save(); ctx.translate(sh, 0);
  SC.drawPovTag(ctx, p.pov || "POV: you're the side character");
  const S = SC.drawHudFrame(ctx, { y: 500, h: 890 });
  const pad = 26, x0 = S.x + pad, x1 = S.x + S.w - pad, tw = x1 - x0;
  ctx.fillStyle = M.recv; rrect(ctx, S.x, S.y, S.w, 110, 0); ctx.fill();
  ctx.fillStyle = M.accent; ctx.beginPath(); ctx.arc(x0 + 30, S.y + 62, 28, 0, 7); ctx.fill();
  ctx.fillStyle = M.ink; ctx.font = inter(34, 800); ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillText(p.contact || "Group chat", x0 + 76, S.y + 62, tw - 80);
  const fsz = 40, lh = 50, LAB = 30;
  ctx.font = inter(fsz, 600);
  const bw = tw * 0.86, top = S.y + 126, bottomLimit = S.y + S.h - 24, lay = [];
  let y = top;
  msgs.forEach((m, i) => {
    const ls = wrap(ctx, m.text, bw - 48), lab = !m.me && m.who && (i === 0 || msgs[i - 1].who !== m.who || msgs[i - 1].me) ? LAB : 0;
    const h = ls.length * lh + 30;
    lay.push({ m, ls, lab, y: y + lab, h, at: times[i] }); y += lab + h + 14;
  });
  const shown = lay.filter((b) => t >= b.at);
  const bottom = shown.length ? shown[shown.length - 1].y + shown[shown.length - 1].h : top;
  const scroll = Math.max(0, bottom - bottomLimit);
  ctx.save(); ctx.beginPath(); ctx.rect(S.x, S.y + 110, S.w, S.h - 110); ctx.clip();
  ctx.translate(0, -scroll);
  for (const b of lay) {
    const age = t - b.at;
    if (age < 0) {
      // typing dots for the next bubble: always for message 2 (running from frame 0), else the last 0.8 s before it lands
      const nextIdx = lay.indexOf(b) === shown.length;
      if (nextIdx && (age > -0.8 || shown.length === 1)) {
        const bx = b.m.me ? x1 - 140 : x0;
        ctx.fillStyle = b.m.me ? M.sent : M.recv; rrect(ctx, bx, b.y, 140, 66, 33); ctx.fill();
        ctx.fillStyle = b.m.me ? "rgba(255,255,255,.85)" : "#9CA3AF";
        for (let d = 0; d < 3; d++) { ctx.beginPath(); ctx.arc(bx + 38 + d * 32, b.y + 33 - Math.abs(Math.sin(t * 8 + d)) * 8, 9, 0, 7); ctx.fill(); }
      }
      continue;
    }
    ctx.font = inter(fsz, 600);
    const isLast = lay.indexOf(b) === n - 1 && n > 1;
    // frame-0 message is simply there; the punch (last bubble) pops in whole with a 1.0 -> 1.08 -> 1.0 bounce
    const k = b.at <= 0 ? 1 : isLast ? 1 + 0.08 * Math.sin(Math.PI * clamp(age / 0.3)) : easeBack(age / 0.22), bwid = Math.min(bw, Math.max(...b.ls.map((l) => ctx.measureText(l).width)) + 48);
    const x = b.m.me ? x1 - bwid : x0, ax = x + (b.m.me ? bwid : 0);
    ctx.save(); ctx.translate(ax, b.y + b.h); ctx.scale(k, k); ctx.translate(-ax, -(b.y + b.h));
    if (b.lab) { ctx.fillStyle = M.grey; ctx.font = inter(26, 800); ctx.textBaseline = "alphabetic"; ctx.fillText(b.m.who, x + 8, b.y - 10); ctx.font = inter(fsz, 600); }
    ctx.fillStyle = b.m.me ? M.sent : M.recv; rrect(ctx, x, b.y, bwid, b.h, 28); ctx.fill();
    ctx.fillStyle = b.m.me ? "#fff" : M.ink; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    b.ls.forEach((l, i) => ctx.fillText(l, x + 24, b.y + 15 + 40 + i * lh - 4));
    ctx.restore();
  }
  ctx.restore(); ctx.restore();
}

// ---------- 4. Notification stack (Pro) ----------
function notifBg(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1f2a5a"); g.addColorStop(1, "#7a2d6b");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  [[200, 500, 300], [850, 1200, 380], [500, 1500, 260]].forEach(([x, y, r], i) => { ctx.beginPath(); ctx.arc(x + Math.sin(t + i) * 30, y + Math.cos(t * .8 + i) * 30, r, 0, 7); ctx.fill(); });
}
function drawNotifs(ctx, t, p, D) {
  const items = rows(p.notifs).map((l) => { const i = l.indexOf(":"); return i > 0 && i < 22 ? [l.slice(0, i), l.slice(i + 1).trim()] : ["Messages", l]; });
  const n = Math.max(1, items.length), gap = (D - 1.0 - 1.4) / n;
  notifBg(ctx, t);
  SC.drawPovTag(ctx, p.pov || "POV: your phone at 3 a.m.");
  ctx.fillStyle = "#fff"; ctx.font = inter(150, 800); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(p.time || "3:07", 502, 640);
  const cur = Math.min(n - 1, Math.floor((t - 0.6) / gap));
  const cardH = 150, step = 168, y0 = 720, maxCards = Math.floor((TB.y1 - y0) / step);
  const first = Math.max(0, cur - maxCards + 1);
  ctx.textAlign = "left";
  for (let i = first; i <= cur; i++) {
    if (i < 0) continue;
    const age = t - (0.6 + i * gap), k = easeBack(age / 0.28);
    const y = y0 + (i - first) * step, off = (1 - k) * -120;
    ctx.save(); ctx.globalAlpha = clamp(age / 0.12); ctx.translate(0, off);
    ctx.fillStyle = "rgba(245,245,250,.92)"; rrect(ctx, TB.x0, y, TW, cardH, 34); ctx.fill();
    ctx.fillStyle = [M.sent, M.accent, M.notif, "#10B981"][i % 4]; rrect(ctx, TB.x0 + 24, y + 28, 64, 64, 16); ctx.fill();
    ctx.fillStyle = M.grey; ctx.font = inter(26, 600); ctx.fillText(items[i][0].toUpperCase(), TB.x0 + 112, y + 50);
    ctx.fillStyle = M.ink; ctx.font = inter(36, 600);
    ctx.fillText(wrap(ctx, items[i][1], TW - 150)[0] || "", TB.x0 + 112, y + 104);
    ctx.restore();
  }
}

// ---------- 5. Big caption (Pro, meme-native Anton) ----------
function capBg(ctx, t) {
  ctx.fillStyle = M.sent; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  for (let s = -H; s < W + H; s += 140) { ctx.beginPath(); ctx.moveTo(s + t * 40, 0); ctx.lineTo(s + 70 + t * 40, 0); ctx.lineTo(s - H + 70 + t * 40, H); ctx.lineTo(s - H + t * 40, H); ctx.fill(); }
}
function drawBigCaption(ctx, t, p, D) {
  const lines = rows(p.lines), n = Math.max(1, lines.length), gap = (D - 1.0) / n;
  const i = Math.min(n - 1, Math.floor(t / gap)), age = t - i * gap;
  capBg(ctx, t);
  SC.drawPovTag(ctx, p.pov || "POV: you're the side character");
  const k = easeBack(age / 0.2), sh = age < 0.25 ? Math.sin(age * 120) * 10 * (1 - age / 0.25) : 0;
  ctx.save(); ctx.translate(502 + sh, 820); ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k); ctx.translate(-502, -820);
  SC.drawTopText(ctx, lines[i] || "", { y: 680, maxLines: 4 });
  ctx.restore();
}

const dur = (base, per, count, min = 12, max = 45) => clamp(base + per * count, min, max);
export const END_CARD_S = 1.5;
export const TEMPLATES = [
  { id: "whatif-sim", name: "What If Sim", brand: "ranthesim", pro: false, blurb: "Our Ran The Sim look: a big WHAT IF question, a live ticking counter, escalating captions.",
    fields: [
      { key: "premise", label: "The question (1-3 lines, max 9 words; WHAT IF is added for you)", type: "textarea", def: "The Moon got 1 km closer\nevery second?" },
      { key: "label", label: "Counter label", type: "text", def: "Distance to Moon" },
      { key: "unit", label: "Counter unit", type: "text", def: "km" },
      { key: "start", label: "Counter starts at", type: "number", def: "384400" },
      { key: "end", label: "Counter ends at", type: "number", def: "0" },
      { key: "rate", label: "Counter speed in sim time (units per second; sets the HUD clock)", type: "number", def: "1" },
      { key: "tag", label: "Short tag (shows after the question)", type: "text", def: "Moon +1 km/s" },
      { key: "rule", label: "Rule line (optional)", type: "text", def: "Rule: 1 km/s · not real orbital physics" },
      { key: "stages", label: "Captions, one per beat (one per line)", type: "textarea", def: "Tides start to climb\nCoastlines go under at dawn\nThe sky is mostly Moon\nIt doesn't stop." },
      { key: "episode", label: "Sim number", type: "text", def: "001" },
    ],
    duration: (p) => { const L = num(p.len, 0); if (L > 0) return clamp(L, 8, 60); const n = rows(p.stages).length; return dur(HOLD + TAIL, n <= 4 ? 3.2 : Math.max(2.6, Math.min(3.2, 15.5 / n)), n, 8, 45); }, draw: drawWhatIfSim, bg: (ctx, t) => simBg(ctx, t),
    cues: (p, D) => { const sp = stagePlan(p, D);
      return [{ t: HOLD, k: "exit" }, ...sp.starts.map((t, i) => ({ t, k: "stage", i })), { t: sp.tEnd, k: "hit" }]; } },
  { id: "day-timeline", name: "Day 1 → Day 10,000", brand: "ranthesim", pro: false, blurb: "A timeline that escalates, one beat at a time.",
    fields: [
      { key: "question", label: "The question", type: "text", def: "What if nobody slept for a week?" },
      { key: "lines", label: "Beats: 'When: what happens'", type: "textarea", def: "Day 1: Everyone is fine. Coffee sales spike.\nDay 3: Focus drops by a third.\nDay 5: Hallucinations are common.\nDay 7: Cities run on pure adrenaline." },
    ],
    duration: (p) => dur(4, 3.6, rows(p.lines).length), draw: drawTimeline, bg: (ctx, t) => simBg(ctx, t),
    cues: (p, D) => { const n = Math.max(1, rows(p.lines).length), gap = (D - 2.0 - 1.2) / n;
      return Array.from({ length: n }, (_, i) => ({ t: 0.4 + i * gap, k: "pop", i })); } },
  { id: "pov-chat", name: "POV Chat", brand: "sidecharpov", pro: false, blurb: "Our Side Character look: a POV tag + a group chat from the side character's phone, up to 6 messages.",
    fields: [
      { key: "pov", label: "POV tag", type: "text", def: "POV: you're the goose 🪿" },
      { key: "contact", label: "Chat name", type: "text", def: "Pond group chat" },
      { key: "scene", label: "Scene behind the phone", type: "select", def: "pond", options: [["pond", "Pond"], ["meadow", "Meadow"], ["night", "Night"], ["plain", "Plain grey"]] },
      { key: "messages", label: "Messages, max 6: 'Name: text'. Start yours with 'me:'. Optional ' @3.5' = seconds in.", type: "textarea",
        def: "Duck: a jogger is on the path\nme: on it\nFrog: he's literally just jogging\nme: he made eye contact\nDuck: he's sprinting now\nme: you're welcome for the cardio @9.4" },
    ],
    duration: chatDuration, draw: drawPovChat, bg: (ctx, t, p) => chatScene(ctx, t, p.scene),
    cues: (p) => { const ms = parseChat(p), ts = chatTimes(ms);
      return ms.map((m, i) => ({ t: ts[i], k: m.me ? "send" : "recv", i, last: i === ms.length - 1 })); } },
  { id: "notif-stack", name: "Notification Stack", brand: "sidecharpov", pro: true, blurb: "Lock-screen notifications pile up. Pure chaos.",
    fields: [
      { key: "pov", label: "POV tag", type: "text", def: "POV: your phone at 3 a.m." },
      { key: "time", label: "Clock", type: "text", def: "3:07" },
      { key: "notifs", label: "Notifications ('App: text')", type: "textarea", def: "Mum: you up?\nBank: unusual activity detected\nGroup chat: 47 new messages\nCalendar: Meeting in 5 hours\nBattery: 1% remaining" },
    ],
    duration: (p) => dur(3, 2.2, rows(p.notifs).length), draw: drawNotifs, bg: notifBg,
    cues: (p, D) => { const n = Math.max(1, rows(p.notifs).length), gap = (D - 1.0 - 1.4) / n;
      return Array.from({ length: n }, (_, i) => ({ t: 0.6 + i * gap, k: "ding", i })); } },
  { id: "big-caption", name: "Big Caption", brand: "sidecharpov", pro: true, blurb: "Meme-native Anton captions that hit one at a time.",
    fields: [
      { key: "pov", label: "POV tag", type: "text", def: "POV: the other driver" },
      { key: "lines", label: "Captions (one per line)", type: "textarea", def: "Me, going the speed limit\nHim, doing it the hard way\nThe light was green for 11 seconds\nHe still hasn't moved" },
    ],
    duration: (p) => dur(2.5, 2.4, rows(p.lines).length), draw: drawBigCaption, bg: capBg,
    cues: (p, D) => { const n = Math.max(1, rows(p.lines).length), gap = (D - 1.0) / n;
      return Array.from({ length: n }, (_, i) => ({ t: i * gap, k: "slam", i })); } },
];

// The 3D template shares the sim's numbers + captions; its own HUD and scene. First in the picker = the default (Muse r3 FINAL GO 8.5).
const SIM = TEMPLATES[0];
TEMPLATES.unshift({ id: "whatif-3d", name: "What If · Night Sky (3D)", brand: "ranthesim", pro: false, wmTop: true,
  blurb: "One thing coming at you over a night sea. Real angular size, our HUD.",
  fields: [
    { key: "premise", label: "The question (a sentence; 'What if' is added if missing)", type: "textarea", def: "What if the Moon got\n1 km closer\nevery second?" },
    ...SIM.fields.filter((f) => ["label", "unit", "start", "end", "rate"].includes(f.key)),
    { key: "rule", label: "Rule line (shows ~2 s at the start; optional)", type: "text", def: "Rule: 1 km/s · not real orbital physics" },
    SIM.fields.find((f) => f.key === "stages"),
    { key: "payoff", label: "Payoff line (shows at contact)", type: "text", def: "Hello, Moon." },
  ],
  duration: (p) => dur(HOLD3 + (String(p.rule || "").trim() ? RULE_S : 0) + TAIL, 3.2, rows(p.stages).length, 8, 45),
  draw: drawWhatIf3D,
  bg: (ctx, t, p) => { if (G3 && !G3.lost) { try { ctx.drawImage(G3.render({ t, rPx: 90, moonY: 900, horizon: 1380, tide: 0, bright: 0.3, starK: 1 }), 0, 0, W, H); return; } catch (e) { G3.lost = true; } } simBg(ctx, t); },
  cues: (p, D) => { const n = Math.max(1, rows(p.stages).length), tS = HOLD3 + (String(p.rule || "").trim() ? RULE_S : 0), st = (D - TAIL - tS) / n;
    return [{ t: HOLD3, k: "exit" }, ...Array.from({ length: n }, (_, i) => ({ t: tS + i * st, k: "stage", i })), { t: D - TAIL, k: "hit" }]; } });

// Remix deep links: /make/?t=<template>&demo=<slug> preloads that demo's copy ("make this exact one"). `p` overrides the
// template defaults; {} = the template's own default demo. Unknown slugs are ignored.
export const DEMOS = {
  goose: { t: "pov-chat", name: "Goose vs. jogger", p: {} },
  moon: { t: "whatif-sim", name: "Moon 1 km closer every second", p: {} },
  // whatif-sim remix presets from the QA-passed scripts (Atlas, shared/whatif/povmaker-presets.md). Loaded exactly as given.
  commute: { t: "whatif-sim", name: "Your commute went straight up", p: {
    premise: "Your commute went\nstraight up?", label: "Distance to the Sun", unit: "km", start: "149600000", end: "0", rate: "0.0277778",
    tag: "Commute, straight up", rule: "Rule: 100 km/h, straight up · not rocket science", episode: "004", hero: "sun", endWord: "Arrived",
    stages: "Same speed. Different direction.\nPast the Moon's orbit.\nStill 100 km/h. Still going.\nPast Mars at its closest.\n171 years to the Sun. At 100 km/h." } },
  birthday: { t: "whatif-sim", name: "Strangers walked in until two shared a birthday", p: {
    premise: "Strangers walked in until\ntwo shared a birthday?", label: "In the room", unit: "people", start: "0", end: "23", rate: "1",
    tag: "Birthday room", rule: "Rule: 365 days, no Feb 29", episode: "008", hero: "dots", endWord: "Match",
    stages: "One stranger per second.\nEach one meets everyone.\nPerson 5: a 2.7% chance.\nPerson 9: nearly 10%.\nBy person 23: a coin flip." } },
  carrington: { t: "whatif-sim", name: "The 1859 solar storm lit up your sky", p: {
    premise: "The 1859 solar storm\nlit up your sky\ntonight?", label: "Cloud distance to Earth", unit: "km", start: "149600000", end: "0", rate: "2361.11",
    tag: "1859 storm, tonight", rule: "Rule: 1859 timeline, replayed tonight", episode: "009",
    stages: "Light arrives: 8 minutes 19 seconds.\nNormal cloud: 3.5 days. This: 17.6 hours.\nPolar flights get rerouted.\nPast Mercury's orbit.\nImpact: 17.6 hours after the flare." } },
  oxygen: { t: "whatif-sim", name: "Earth lost 1% of its oxygen every second", p: {
    premise: "Earth lost 1% of its\noxygen every second?", label: "Oxygen left", unit: "%", start: "100", end: "0", rate: "1",
    tag: "Earth loses 1% O2/s", rule: "Rule: 1% per second · not real chemistry", episode: "006", hero: "atmosphere", endWord: "Gone",
    stages: "Oxygen drains every second.\nFull to zero in 100 seconds.\nDenver-thin air.\nCandles go out.\nGas flames die." } },
  life: { t: "whatif-sim", name: "Your life played at 1 second per year", p: {
    premise: "Your life played at\n1 second per year?", label: "Age", unit: "years", start: "0", end: "18", rate: "0.0000000316881",
    tag: "Your life", rule: "Rule: 1 second = 1 year · US averages", episode: "005", hero: "seasons", endWord: "Paused",
    ease: "linear", len: "20", tail: "2", int: "floor", clock: "years",
    stages: "Your life. 1 second = 1 year. @3\nAge 5: school starts. @5\nSleep so far: about 3.5 years. @7\nDouble digits: age 10. @10\n500 million heartbeats. @13.6\nTime with family: 4.3 hours a day. @15\nMost teens still live at home. @16.6\nAbout half your family time: used. @18" } },
  moon3d: { t: "whatif-3d", name: "Moon 1 km closer (3D)", p: {} },
  sleep: { t: "day-timeline", name: "Nobody slept for a week", p: {} },
  phone3am: { t: "notif-stack", name: "Your phone at 3 a.m.", p: {} },
  driver: { t: "big-caption", name: "The other driver", p: {} },
};

export function defaults(tpl) { return Object.fromEntries(tpl.fields.map((f) => [f.key, f.def])); }

// Render one frame. opts: {safe, watermark, endCard}
export function renderFrame(ctx, tpl, params, t, opts = {}) {
  const D = tpl.duration(params), total = D + (opts.endCard ? END_CARD_S : 0);
  ctx.save(); ctx.clearRect(0, 0, W, H);
  if (t >= D && opts.endCard) {
    ctx.fillStyle = "#0A0E14"; ctx.fillRect(0, 0, W, H);
    if (tpl.bg) { tpl.bg(ctx, t, params); ctx.fillStyle = "rgba(10,14,20,.62)"; ctx.fillRect(0, 0, W, H); }
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 14;
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = grot(104); ctx.fillText("Made with", W / 2, 800); ctx.fillText("POVMaker", W / 2, 920);
    ctx.font = inter(58, 800); ctx.fillStyle = RTS.PALETTE.cyan; ctx.fillText("Make videos like this", W / 2, 1060);
    if (SITE) { ctx.font = mono(50); ctx.fillStyle = RTS.PALETTE.amber; ctx.fillText(SITE, W / 2, 1150, 960); }
    ctx.restore();
  } else {
    tpl.draw(ctx, Math.min(t, D - 1 / 60), params, D);
    // blend the last 0.35s back into frame 0 so the video loops cleanly
    if (!opts.endCard && t > D - 0.35) {
      ctx.globalAlpha = clamp((t - (D - 0.35)) / 0.35); tpl.draw(ctx, 0, params, D); ctx.globalAlpha = 1;
    }
  }
  if (opts.watermark && tpl.wmTop && !(opts.endCard && t >= D)) {
    // 3D scene: the free watermark goes top-right (Muse r1), clear of the glitter column and the Moon
    ctx.save(); ctx.globalAlpha = 0.7; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.font = mono(26); ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText(SITE || "Made with POVMaker", 1016, 250);
    ctx.restore();
  } else if (opts.watermark && !(opts.endCard && t >= D)) {
    // single line inside the safe box (y <= 1440, x <= 940), right-aligned, above the platform caption zone
    ctx.save(); ctx.globalAlpha = 0.75; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.font = inter(30, 800); ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    const full = "Made with POVMaker" + (SITE ? " · " + SITE : "");
    ctx.fillText(ctx.measureText(full).width <= 820 ? full : "Made with POVMaker", 940, 1432);
    ctx.restore();
  }
  ctx.restore();
  return total;
}
