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
    const w = text.split(/ +/); let best = null, bd = 1e9;   // ASCII spaces only: a no-break space (e.g. "100\u00A0°C") never becomes a line break
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
// CEO #5060/#5070: comparison-card captions for the self-serve picker, auto-placed when `stages` is left blank.
// Each caption names a FIXED elapsed sim-time fact ("9 H: past the Eiffel Tower.") rather than quoting the live HUD
// value at an instant, so it stays true no matter how the value curve accelerates (same rule as every hand-authored
// whatif-sim caption — restating a live number invites the ±25% caption-vs-HUD drift problem, see MEMORY lesson).
const MILESTONES = {
  m: [
    { v: 93, label: "the Statue of Liberty", source: "U.S. National Park Service: 93 m, base to torch" },
    { v: 330, label: "the Eiffel Tower", source: "Tour Eiffel: 330 m, current height incl. antennas" },
    { v: 828, label: "the Burj Khalifa", source: "Emaar Properties / CTBUH official figure: 828 m" },
    { v: 3776, label: "Mount Fuji", source: "Japan Meteorological Agency: 3,776 m" },
    { v: 5895, label: "Mount Kilimanjaro", source: "Tanzania National Parks, Uhuru Peak: 5,895 m" },
    { v: 8849, label: "Mount Everest", source: "Nepal/China joint survey, Dec 2020: 8,848.86 m" },
    { v: 10700, label: "a cruising airliner's altitude", source: "FAA: typical airliner cruise altitude, ~35,000 ft / 10,700 m" },
    { v: 100000, label: "the Karman line, the edge of space", source: "FAI: 100,000 m, internationally used edge-of-space definition" },
  ],
  "km/h": [
    { v: 44.7, label: "Usain Bolt's top speed", source: "IAAF-timed peak speed, 2009 World Championships: ~44.7 km/h" },
    { v: 120, label: "a cheetah's sprint speed", source: "widely cited peak cheetah sprint speed, ~120 km/h" },
    { v: 300, label: "a high-speed train's top speed", source: "typical TGV/Shinkansen operating top speed, ~300 km/h" },
    { v: 900, label: "a cruising airliner's speed", source: "typical commercial jet cruise speed, ~900 km/h" },
    { v: 1235, label: "the speed of sound", source: "speed of sound at sea level, ~343 m/s = 1,235 km/h" },
    { v: 27500, label: "orbital velocity", source: "low Earth orbit speed (ISS), ~7.64 km/s = 27,500 km/h" },
  ],
  "°C": [
    { v: -18, label: "a home freezer's temperature", source: "FDA recommended home freezer setting: -18 °C (0 °F)" },
    { v: 0, label: "water's freezing point", source: "0 °C at 1 atm" },
    { v: -40, label: "the point where °C and °F match", source: "-40 °C = -40 °F, exact" },
    { v: -89, label: "the coldest air temperature ever recorded", source: "Vostok Station, Antarctica, 1983: -89.2 °C" },
    { v: -210, label: "nitrogen's freezing point", source: "-210 °C (-346 °F) at 1 atm" },
  ],
  "%": [
    { v: 20.9, label: "today's atmospheric oxygen level", source: "Earth's current atmosphere, ~20.9% O2 by volume" },
    { v: 50, label: "the halfway point", source: "midpoint, by definition" },
    { v: 78, label: "today's atmospheric nitrogen level", source: "Earth's current atmosphere, ~78.1% N2 by volume" },
  ],
};
const fmtNice = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : "";
  return s + (a >= 100 ? Math.round(a).toLocaleString("en-US") : a >= 10 ? a.toFixed(0) : a >= 1 ? a.toFixed(1).replace(/\.0$/, "") : a.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")); };
// "Nice" 1-2-5 round numbers spanning (lo,hi), used to fill a caption gap when no sourced milestone falls inside it —
// CEO #5070 round 2: a caption must change at least every ~6 s of screen time (a fresh beat every few seconds is the
// format's whole engine), so a gap is never left holding a stale caption under a HUD value it no longer describes.
function niceNumbers(lo, hi) {
  if (!(hi > lo)) return [];
  const out = [], top = Math.ceil(Math.log10(Math.max(Math.abs(hi), Math.abs(lo), 1))) + 1, bot = top - 8;
  for (let e = bot; e <= top; e++) for (const k of [1, 2, 5]) { const v = k * Math.pow(10, e); if (v > lo + 1e-9 && v < hi - 1e-9) out.push(v); }
  return out;
}
const parseCurve = (s) => String(s || "").split(",").map((x) => x.split(":").map(Number)).filter((x) => x.length === 2 && x.every(Number.isFinite));
// CEO #5070 round 2: a wide value range (e.g. 0.12 m to 100,000 m) under the default pow(2.2) curve blows past every
// small/medium milestone within the first couple of seconds — real crossing times would all cluster near t=HOLD, so
// spacing captions "whenever the counter happens to cross them" doesn't work for a wide range, the SAME reason every
// hand-authored wide-range demo (moonfar, cools, sleepless, fold, ants) ships its own explicit `curve` override. So
// autoStages builds its OWN curve: pick ~1 waypoint (sourced milestone, else a "nice" round number) per ~5.5 s of
// screen time, evenly spaced in TIME, and define the value curve to pass through each at its assigned time — this
// makes "caption appears exactly when the counter crosses it" true by construction, not by inverting a fixed curve.
function autoStages(unit, a, b, rate, tEnd) {
  if (!(rate > 0) || a === b || !(tEnd > HOLD)) return { lines: [], curve: [] };
  const lo = Math.min(a, b), hi = Math.max(a, b), span = hi - lo, table = MILESTONES[String(unit || "").trim()] || [];
  const real = table.filter((ms) => ms.v > lo + 1e-9 && ms.v < hi - 1e-9)
    .map((ms) => ({ v: ms.v, real: true, text: `Passed ${ms.label} at ${simSpan(Math.abs(ms.v - a) / rate)}.` }));
  const rounds = niceNumbers(lo, hi).map((v) => ({ v, real: false, text: `Past ${fmtNice(v)} ${unit}.` }));
  const wOf = (v) => (v - a) / (b - a); // chronological order: ascending w, NOT ascending value — a descending counter (b < a) needs its highest value first
  const merged = []; // sourced milestones win over a round number that lands within 2% of the same value
  for (const c of [...real, ...rounds].sort((x, y) => wOf(x.v) - wOf(y.v))) {
    const dupe = merged.find((m) => Math.abs(m.v - c.v) < 0.02 * (span || 1));
    if (dupe) { if (c.real && !dupe.real) Object.assign(dupe, c); continue; }
    merged.push(c);
  }
  const count = clamp(Math.round((tEnd - HOLD) / 5.5), 3, 9);
  let chosen = merged;
  if (merged.length > count) { const idx = new Set();
    for (let i = 0; i < count; i++) idx.add(Math.round((i * (merged.length - 1)) / Math.max(1, count - 1)));
    chosen = merged.filter((_, i) => idx.has(i)); }
  const n = chosen.length; if (!n) return { lines: [], curve: [] };
  const lines = [], curve = [[0, 0]];
  chosen.forEach((c, i) => {
    const t = HOLD + ((i + 1) * (tEnd - HOLD)) / (n + 1), u = clamp(t / tEnd), w = clamp((c.v - a) / (b - a));
    lines.push(`${c.text} @${t.toFixed(1)}`); curve.push([u, w]);
  });
  curve.push([1, 1]);
  return { lines, curve };
}
// Caption plan. "text @5.5" pins a beat to 5.5 s (every line must carry it); otherwise the beats are spaced evenly after the hold.
function stagePlan(p, D) {
  const tEnd = D - tailOf(p);
  let raw = rows(p.stages), curve = parseCurve(p.curve);
  if (!raw.length) { // blank stages = auto comparison cards (+ the curve they need to land on-time, see autoStages)
    const auto = autoStages(p.unit, num(p.start, 0), num(p.end, 1), num(p.rate, 1), tEnd);
    raw = auto.lines; if (!curve.length) curve = auto.curve;
  }
  const m = raw.map((l) => /^(.*\S)\s*@\s*(\d+(?:\.\d+)?)\s*$/.exec(l));
  const texts = raw.map((l, i) => (m[i] ? m[i][1] : l)), n = Math.max(1, texts.length);
  const starts = raw.length && m.every(Boolean) ? m.map((x) => clamp(Number(x[2]), HOLD, tEnd))
    : Array.from({ length: n }, (_, i) => HOLD + (i * (tEnd - HOLD)) / n);
  return { texts, starts, n, tEnd, curve };
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
function heroRecede(ctx, t, w, cam) { // "moonfar": Earth and a Moon that drifts OUT; the dashed amber ring is where it stops (to scale: 554,392 / 384,400 = 1.44)
  const cx = 540, cy = 960, R0 = 190, R1 = R0 * 1.442, r = R0 + (R1 - R0) * clamp(w), ang = -1.1 + t * 0.55;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(cam, cam); ctx.translate(-cx, -cy);
  ctx.strokeStyle = "rgba(255,176,32,.45)"; ctx.lineWidth = 3; ctx.setLineDash([14, 14]);
  ctx.beginPath(); ctx.arc(cx, cy, R1, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(61,214,245,.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  const e = ctx.createRadialGradient(cx - 22, cy - 22, 8, cx, cy, 72);
  e.addColorStop(0, "#5FA8D8"); e.addColorStop(1, "#14304A");
  ctx.fillStyle = e; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, 7); ctx.fill();
  const mx = cx + r * Math.cos(ang), my = cy + r * Math.sin(ang), m = ctx.createRadialGradient(mx - 6, my - 6, 2, mx, my, 22);
  m.addColorStop(0, "#F2F4F7"); m.addColorStop(1, "#9AA3AE");
  ctx.fillStyle = m; ctx.beginPath(); ctx.arc(mx, my, 20, 0, 7); ctx.fill();
  ctx.restore();
}
function heroFirstPerson(ctx, t, w, cam) { // "runner": a first-person track POV that streams faster as the counter climbs (Runner #022's read, in 2D)
  const horizon = 960, speed = 0.15 + w * w * 2.4; // quadratic so the rush is visibly faster near the payoff, not linear
  ctx.save();
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, w < 0.55 ? "#8FB6D8" : "#1C2A44"); sky.addColorStop(1, w < 0.55 ? "#D8E6EF" : "#3A4F72"); // day fades to dusk as speed climbs
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);
  const ground = ctx.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, "#7A4A38"); ground.addColorStop(1, "#4E2E22"); ctx.fillStyle = ground; ctx.fillRect(0, horizon, W, H - horizon);
  ctx.strokeStyle = "rgba(242,244,247,.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(W, horizon); ctx.stroke();
  ctx.save(); ctx.translate(540, horizon); ctx.scale(cam, cam); ctx.translate(-540, -horizon);
  const vx = 540, bob = Math.sin(t * 7.4) * 5; // run-cadence camera bob
  // lane lines: radiate from the vanishing point, scroll outward (phase driven by sim progress -> faster = denser streaks)
  const lanes = [-360, -200, -80, 80, 200, 360];
  for (const lx of lanes) {
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = Math.abs(lx) < 90 ? 6 : 4;
    ctx.beginPath(); ctx.moveTo(vx + lx * 0.06, horizon + bob); ctx.lineTo(vx + lx * 3.4, H); ctx.stroke();
  }
  const phase = (t * speed * 90) % 140;
  for (let i = -1; i < 10; i++) {
    const d = i * 140 + phase, y = horizon + bob + d * d * 0.01;
    if (y <= horizon || y > H) continue;
    const k = (y - horizon) / (H - horizon), hw = 30 + k * 420;
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k * 0.4)})`;
    ctx.fillRect(vx - hw - hw * 0.08, y, hw * 0.16, 10 + k * 26); // rung across the lanes, like a track's distance markers
  }
  ctx.restore();
  // speed-streak vignette at high w: thin radiating motion lines over the whole frame, like Runner's Mach-speed beats
  if (w > 0.5) {
    ctx.save(); ctx.globalAlpha = (w - 0.5) * 1.6; ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, r0 = 120, r1 = 900;
      ctx.beginPath(); ctx.moveTo(540 + Math.cos(a) * r0, horizon + Math.sin(a) * r0 * 0.4); ctx.lineTo(540 + Math.cos(a) * r1, horizon + Math.sin(a) * r1 * 0.55); ctx.stroke(); }
    ctx.restore();
  }
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
  g.font = mono(40); g.fillStyle = P.text; const tm = `${hr % 12 || 12}:00 ${hr < 12 ? "AM" : "PM"}`, dl = `DAY ${day}`;
  const tw = g.measureText(tm + "  ·  ").width, dw = g.measureText(dl).width, x0 = cx - (tw + dw) / 2;
  g.textAlign = "left"; g.fillText(tm, x0, cy + R + 84); g.fillStyle = P.cyan; g.fillText("  ·  " + dl, x0 + g.measureText(tm).width, cy + R + 84); g.textAlign = "center";
  const cups = Math.min(12, day);   // the cup tower: one cup per day awake
  for (let i = 0; i < cups; i++) {
    const sway = Math.sin(t * 2.1 + i * 0.55) * wob * (2 + i * 1.6), y = 1196 - (i + 1) * 40;
    const mx = 850 + sway;   // a coffee mug: body, handle, brown coffee on top
    g.strokeStyle = "#E8EEF3"; g.lineWidth = 7; g.beginPath(); g.arc(mx + 48, y + 18, 11, -1.5, 1.5); g.stroke();
    g.fillStyle = i % 2 ? "#E8EEF3" : "#C9D2DC"; g.beginPath(); g.moveTo(mx - 46, y + 2); g.lineTo(mx + 46, y + 2); g.lineTo(mx + 38, y + 36); g.lineTo(mx - 38, y + 36); g.closePath(); g.fill();
    g.fillStyle = "#4B2E1E"; g.beginPath(); g.ellipse(mx, y + 3, 44, 6, 0, 0, 7); g.fill();
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
function heroFrost(ctx, t, w, cam) { // "cools": Earth with continents; frost grows ON the disc (polar caps toward the equator, oceans whiten, land frosts); the Sun stays
  const cx = 540, cy = 960, R = 170, c = (a, b, x) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * x)).join(",")})`;
  const oc = clamp((w - 0.1) / 0.5), lc = clamp((w - 0.22) / 0.45), cap = clamp((w - 0.02) / 0.62), z = clamp((w - 0.88) / 0.12);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(cam, cam); ctx.translate(-cx, -cy);
  ctx.strokeStyle = "rgba(61,214,245,.16)"; ctx.lineWidth = 2;
  for (const r of [250, 340, 430]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  const sunG = ctx.createRadialGradient(205, 790, 6, 205, 790, 120);   // the Sun, fixed top-left, never goes out
  sunG.addColorStop(0, "rgba(255,226,160,1)"); sunG.addColorStop(0.3, "rgba(255,176,32,.9)"); sunG.addColorStop(1, "rgba(255,176,32,0)");
  ctx.fillStyle = sunG; ctx.beginPath(); ctx.arc(205, 790, 120, 0, 7); ctx.fill();
  const halo = ctx.createRadialGradient(cx, cy, R, cx, cy, R + 110); halo.addColorStop(0, `rgba(190,233,247,${(0.18 + 0.5 * w).toFixed(3)})`); halo.addColorStop(1, "rgba(190,233,247,0)");
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R + 110, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
  ctx.fillStyle = c([47, 125, 184], [232, 243, 250], oc); ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  const land = c([72, 150, 74], [238, 247, 251], lc);
  ctx.fillStyle = land; ctx.strokeStyle = land; ctx.lineWidth = 14; ctx.lineJoin = "round";
  for (const poly of [
    [[-.62, -.5], [-.3, -.62], [-.1, -.42], [-.3, -.2], [-.18, .02], [-.02, .2], [-.12, .5], [-.26, .78], [-.4, .45], [-.36, .1], [-.58, -.08], [-.72, -.28]],   // the Americas
    [[.12, -.5], [.42, -.58], [.68, -.36], [.56, -.1], [.72, .2], [.5, .56], [.3, .62], [.24, .26], [.1, 0], [.2, -.22]],                                    // Europe + Africa
    [[.5, -.62], [.8, -.5], [.9, -.2], [.72, -.18], [.58, -.3]]]) {                                                                                           // Asia
    ctx.beginPath(); poly.forEach(([x, y], i) => ctx[i ? "lineTo" : "moveTo"](cx + x * R, cy + y * R)); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = "rgba(246,252,255,.96)";   // polar caps creep toward the equator
  const hh = R * (0.1 + 1.45 * Math.pow(cap, 0.85));
  ctx.beginPath(); ctx.ellipse(cx, cy - R, R * 1.3, hh, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + R, R * 1.3, hh * 0.9, 0, 0, 7); ctx.fill();
  const sh = ctx.createRadialGradient(cx - 50, cy - 50, R * 0.2, cx, cy, R * 1.05); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(5,10,20,.42)");
  ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  ctx.restore();
  ctx.strokeStyle = `rgba(200,236,250,${(0.25 + 0.55 * w).toFixed(2)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, 7); ctx.stroke();   // icy rim
  if (w > 0.55) {   // diamond dust
    const m = clamp((w - 0.55) / 0.3);
    for (let i = 0; i < 40; i++) { const a = i * 2.4 + t * 0.2, rr = 215 + ((i * 53) % 200), tw = 0.5 + 0.5 * Math.sin(t * 5 + i); ctx.fillStyle = `rgba(230,246,255,${(0.7 * m * tw).toFixed(2)})`; ctx.fillRect(cx + Math.cos(a) * rr - 3, cy + Math.sin(a) * rr * 0.9 - 3, 6, 6); }
  }
  if (z > 0) {   // the air itself condenses: a bright shell around the white disc
    ctx.save(); ctx.shadowColor = "rgba(120,220,255,.9)"; ctx.shadowBlur = 30 * z;
    ctx.strokeStyle = `rgba(255,255,255,${(0.95 * z).toFixed(2)})`; ctx.lineWidth = 12 + 16 * z; ctx.beginPath(); ctx.arc(cx, cy, R + 20, 0, 7); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}
// ---- "ladder": the thing that doubles is DRAWN (a paper stack / an ant cube) standing beside the silhouette of the next real landmark it is
// about to pass, at true relative scale; the camera zooms out so the object stays big and each passed landmark shrinks away to the left ----
const fmtH = (m) => {
  if (m < 0.01) return `${+(m * 1000).toFixed(1)} MM`;
  if (m < 1) return m < 0.1 ? `${+(m * 100).toFixed(1)} CM` : `${Math.round(m * 100)} CM`;
  if (m < 1000) return `${+m.toFixed(m < 10 ? 1 : 0)} M`;
  const k = m / 1000; return `${k < 100 ? +k.toFixed(1) : Math.round(k).toLocaleString("en-US")} KM`;
};
function lenFmt(m) { // exact readout of the growing thing
  if (m < 0.01) return `${(m * 1000).toFixed(1)} MM`;
  if (m < 1) return m < 0.1 ? `${(m * 100).toFixed(1)} CM` : `${Math.round(m * 100)} CM`;
  if (m < 1000) return `${m < 100 ? m.toFixed(1) : Math.round(m)} M`;
  const k = m / 1000; return `${k < 100 ? k.toFixed(1) : Math.round(k).toLocaleString("en-US")} KM`;
}
function antFmt(c) {
  if (c < 1e6) return Math.round(c).toLocaleString("en-US");
  for (const [d, w] of [[1e15, "QUADRILLION"], [1e12, "TRILLION"], [1e9, "BILLION"], [1e6, "MILLION"]]) if (c >= d) { const x = c / d; return `${x < 100 ? x.toFixed(x < 10 ? 1 : 0) : Math.round(x)} ${w}`; }
  return String(c);
}
// [height m, silhouette kind, aspect w/h, label]. Heights are the landmark's own size; kind "line" = a horizontal level, "disc" = a round body.
const SCALE_SETS = {
  fold: { obj: (n) => 1e-4 * Math.pow(2, n), read: (n) => [["THICKNESS", lenFmt(1e-4 * Math.pow(2, n))]], objAs: "stack",
    marks: [[0.0003, "slab", 1.4, "Playing card"], [0.002, "slab", 6, "Coin"], [0.008, "slab", 0.5, "Phone"], [0.03, "slab", 0.7, "Book"], [0.1, "mug", 0.95, "Mug"], [2, "door", 0.42, "Door"],
      [10, "house", 1.4, "House"], [93, "statue", 0.35, "Statue of Liberty"], [330, "eiffel", 0.5, "Eiffel Tower"], [828, "burj", 0.12, "Burj Khalifa"], [8849, "peak", 1.5, "Everest"],
      [1e5, "line", 0, "Edge of space"], [4.08e5, "iss", 0, "Space Station"], [1.2742e7, "disc", 1, "Earth, 12,742 km wide"], [3.5786e7, "line", 0, "Geo orbit"], [3.844e8, "orbit", 0, "Moon, 384,400 km away"]] },
  ants: { obj: (n) => Math.cbrt(Math.pow(2, n) * 6.64e-9), read: (n) => [["ANTS", antFmt(Math.pow(2, n))], ["CUBE SIDE", lenFmt(Math.cbrt(Math.pow(2, n) * 6.64e-9))]], objAs: "cube",
    marks: [[0.006, "slab", 1.6, "Grain of rice"], [0.04, "spoon", 1.4, "Teaspoon"], [0.1, "mug", 0.95, "Coffee mug"], [0.28, "bucket", 1, "Bucket"], [1.1, "bin", 0.7, "Wheelie bin"],
      [2.4, "shed", 1.3, "Garden shed"], [9, "house", 1.4, "House"], [40, "block", 0.5, "13-storey block"], [96, "bigben", 0.14, "Big Ben"], [146.6, "pyramid", 1.55, "Great Pyramid"], [443, "esb", 0.28, "Empire State"]] },
};
function silhouette(c, kind, x, gy, h, w, col) { // x = left edge, gy = ground y, h/w px
  c.fillStyle = col; c.strokeStyle = col;
  const R = (a, b, cw, ch) => c.fillRect(x + a * w, gy - (b + ch) * h, cw * w, ch * h);
  switch (kind) {
    case "slab": c.fillRect(x, gy - h, w, h); break;
    case "mug": R(0, 0, 0.78, 1); c.lineWidth = Math.max(1, h * 0.12); c.beginPath(); c.arc(x + w * 0.78, gy - h * 0.5, h * 0.28, -1.5, 1.5); c.stroke(); break;
    case "door": R(0, 0, 1, 1); c.fillStyle = "#0B0F14"; c.beginPath(); c.arc(x + w * 0.8, gy - h * 0.48, Math.max(1, h * 0.025), 0, 7); c.fill(); break;
    case "house": R(0, 0, 1, 0.62); c.beginPath(); c.moveTo(x - w * 0.06, gy - h * 0.62); c.lineTo(x + w * 0.5, gy - h); c.lineTo(x + w * 1.06, gy - h * 0.62); c.closePath(); c.fill(); break;
    case "shed": R(0, 0, 1, 0.7); c.beginPath(); c.moveTo(x - w * 0.05, gy - h * 0.7); c.lineTo(x + w * 0.5, gy - h); c.lineTo(x + w * 1.05, gy - h * 0.7); c.closePath(); c.fill(); break;
    case "bucket": c.beginPath(); c.moveTo(x, gy - h); c.lineTo(x + w, gy - h); c.lineTo(x + w * 0.82, gy); c.lineTo(x + w * 0.18, gy); c.closePath(); c.fill(); break;
    case "bin": R(0.05, 0, 0.9, 0.9); R(0, 0.9, 1, 0.1); break;
    case "spoon": c.beginPath(); c.ellipse(x + w * 0.22, gy - h * 0.5, w * 0.22, h * 0.5, 0, 0, 7); c.fill(); c.fillRect(x + w * 0.4, gy - h * 0.58, w * 0.6, Math.max(1, h * 0.18)); break;
    case "block": R(0, 0, 1, 1); c.fillStyle = "#0B0F14"; for (let i = 1; i < 6; i++) c.fillRect(x + w * 0.15, gy - h * (i / 6.2), w * 0.7, Math.max(1, h * 0.012)); break;
    case "statue": R(0.2, 0, 0.6, 0.28); R(0.38, 0.28, 0.3, 0.42); c.beginPath(); c.moveTo(x + w * 0.5, gy - h * 0.7); c.lineTo(x + w * 0.88, gy - h); c.lineTo(x + w * 0.7, gy - h * 0.66); c.closePath(); c.fill(); break;
    case "eiffel": c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w * 0.44, gy - h); c.lineTo(x + w * 0.56, gy - h); c.lineTo(x + w, gy); c.lineTo(x + w * 0.78, gy); c.lineTo(x + w * 0.5, gy - h * 0.35); c.lineTo(x + w * 0.22, gy); c.closePath(); c.fill(); break;
    case "burj": c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w * 0.38, gy - h * 0.45); c.lineTo(x + w * 0.5, gy - h); c.lineTo(x + w * 0.62, gy - h * 0.45); c.lineTo(x + w, gy); c.closePath(); c.fill(); break;
    case "bigben": R(0.15, 0, 0.7, 0.8); R(0, 0.8, 1, 0.12); c.beginPath(); c.moveTo(x, gy - h * 0.92); c.lineTo(x + w * 0.5, gy - h); c.lineTo(x + w, gy - h * 0.92); c.closePath(); c.fill(); break;
    case "pyramid": c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w * 0.5, gy - h); c.lineTo(x + w, gy); c.closePath(); c.fill(); break;
    case "esb": R(0.1, 0, 0.8, 0.5); R(0.22, 0.5, 0.56, 0.2); R(0.34, 0.7, 0.32, 0.16); R(0.44, 0.86, 0.12, 0.1); R(0.49, 0.96, 0.02, 0.04); break;
    case "peak": c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w * 0.45, gy - h); c.lineTo(x + w * 0.62, gy - h * 0.78); c.lineTo(x + w * 0.75, gy - h * 0.86); c.lineTo(x + w, gy); c.closePath(); c.fill(); break;
    case "disc": case "moon": c.beginPath(); c.arc(x + w / 2, gy - h / 2, h / 2, 0, 7); c.fill(); break;
    default: break;
  }
}
function heroScale(ctx, t, n, kind, cam) {
  const S = SCALE_SETS[kind] || SCALE_SETS.fold, nI = Math.floor(Math.max(0, n) + 1e-9);
  const obj = S.obj(Math.max(0, n)), GY = 1170, TOPPX = 500, OBJPX = 320, MINPX = 46;
  const nextI = S.marks.findIndex((m) => m[0] > obj * 1.0001);
  const next = nextI < 0 ? null : S.marks[nextI];
  let sc = OBJPX / obj;
  if (next) sc = Math.max(Math.min(sc, TOPPX / next[0]), MINPX / obj);
  const oh = obj * sc, ow = S.objAs === "cube" ? oh * 0.9 : Math.max(16, Math.min(120, oh * 0.5)), ox = 600;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 640, W, 600); ctx.clip();
  ctx.translate(540, 960); ctx.scale(cam, cam); ctx.translate(-540, -960);
  ctx.strokeStyle = "rgba(242,244,247,.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(64, GY); ctx.lineTo(1016, GY); ctx.stroke();
  // passed landmarks: most recent right next to the object, then shrinking away to the left (true scale; gaps are screen px)
  let xr = ox - ow / 2 - 30;
  for (let i = (nextI < 0 ? S.marks.length : nextI) - 1; i >= 0 && xr > 64; i--) {
    const [h, k, a, label] = S.marks[i], hp = h * sc, wp = Math.max(1.5, hp * a);
    if (k === "orbit") { const y = GY - hp; ctx.save(); ctx.setLineDash([16, 12]); ctx.strokeStyle = "rgba(255,176,32,.8)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(1016, y); ctx.stroke(); ctx.restore();
      ctx.fillStyle = "#D9DDE2"; ctx.beginPath(); ctx.arc(930, y, Math.max(16, 3474e3 * sc / 2), 0, 7); ctx.fill();
      ctx.font = mono(40); ctx.textAlign = "left"; ctx.fillStyle = P.amber; ctx.fillText("PAST THE MOON", 690, y + 50); ctx.fillText(fmtH(h), 690, y + 96); continue; }
    if (k === "line" || k === "iss") continue;
    const x = xr - wp; silhouette(ctx, k, x, GY, Math.max(1.5, hp), wp, "rgba(242,244,247,.34)");
    xr = x - Math.max(10, Math.min(30, wp * 0.5));
  }
  // the growing object
  if (S.objAs === "cube") {
    const side = oh * 0.74, dx = oh * 0.26, left = ox - ow / 2, top = GY - side;
    c3(ctx, left, top, side, dx, t);
  } else {
    ctx.fillStyle = "#EFE6C8"; ctx.fillRect(ox - ow / 2, GY - oh, ow, oh);
    ctx.fillStyle = "rgba(120,100,60,.45)";
    const L = Math.max(2, Math.min(28, Math.floor(oh / 9)));
    for (let i = 1; i < L; i++) ctx.fillRect(ox - ow / 2, GY - (oh * i) / L, ow, 1.5);
    ctx.fillStyle = "#FFF8E0"; ctx.fillRect(ox - ow / 2, GY - oh, ow, Math.min(4, oh));
  }
  // the next landmark, beside the object at true scale, with its label
  if (next) {
    const [h, k, a, label] = next, hp = h * sc;
    ctx.font = mono(40); ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    if (k === "line" || k === "iss" || k === "orbit") {
      const y = GY - hp; ctx.save(); ctx.setLineDash([16, 12]); ctx.strokeStyle = P.cyan; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(1016, y); ctx.stroke(); ctx.restore();
      if (k === "orbit") { ctx.fillStyle = "#D9DDE2"; ctx.beginPath(); ctx.arc(930, y, Math.max(16, 3474e3 * sc / 2), 0, 7); ctx.fill(); }
      if (k === "iss") { ctx.fillStyle = "#F2F4F7"; ctx.fillRect(840, y - 5, 90, 10); ctx.fillRect(870, y - 16, 8, 32); ctx.fillRect(892, y - 16, 8, 32); }
      { const l1 = label.toUpperCase().replace(/, 384,400 KM AWAY/, ""), l2 = k === "orbit" ? "384,400 KM AWAY" : fmtH(h);   // two-line tag on its own plate, right of the readouts
        ctx.font = mono(36); const tw = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 28, ty = y + 14;
        ctx.fillStyle = "rgba(11,15,20,.78)"; rrect(ctx, 1016 - tw, ty, tw, 92, 10); ctx.fill();
        ctx.strokeStyle = P.cyan; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = P.cyan; ctx.fillText(l1, 1002, ty + 38); ctx.fillText(l2, 1002, ty + 78); }
    } else {
      const x = Math.max(ox + ow / 2 + 40, 700), cap = ["disc", "peak", "pyramid"].includes(k) ? 520 : 300, wp = Math.min(hp * a, cap);
      silhouette(ctx, k, x, GY, hp, wp, "rgba(242,244,247,.78)");
      ctx.fillStyle = P.cyan; ctx.fillText(`${label.toUpperCase()} · ${fmtH(h)}`, 1010, GY + 40);
    }
  }
  // exact readouts, top-left (the tall landmarks own the right)
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; let y = 700;
  const plate = S.read(nI).length * 100 + 20;
  ctx.fillStyle = "rgba(11,15,20,.55)"; rrect(ctx, 56, 660, 500, plate, 14); ctx.fill();
  for (const [lab, val] of S.read(nI)) {
    ctx.font = mono(26); ctx.fillStyle = P.cyan; ctx.fillText(lab, 76, y);
    ctx.font = mono(val.length > 11 ? 52 : 70); ctx.fillStyle = P.amber; ctx.fillText(val, 76, y + 62);
    y += 100 + 0;
  }
  ctx.restore();
}
function c3(ctx, x, y, s, d, t) { // the ant cube: a dark brown block with a speckled "crawling" texture
  const face = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([a, b], i) => ctx[i ? "lineTo" : "moveTo"](a, b)); ctx.closePath(); ctx.fill(); };
  face([[x, y + d], [x + s, y + d], [x + s, y + d + s], [x, y + d + s]], "#3A2418");
  face([[x, y + d], [x + d, y], [x + s + d, y], [x + s, y + d]], "#5A3A26");
  face([[x + s, y + d], [x + s + d, y], [x + s + d, y + s], [x + s, y + d + s]], "#2A190F");
  for (let i = 0; i < 160; i++) {
    const a = (i * 0.618) % 1, b = (i * 0.381 + 0.17) % 1, wob = Math.sin(t * 3 + i) * 1.2;
    ctx.fillStyle = i % 3 ? "rgba(15,8,4,.8)" : "rgba(150,100,60,.55)";
    ctx.fillRect(x + a * s + wob, y + d + b * s, 3, 3);
  }
}
// Shared with the free-cap preview marker (make.js) so the HUD number it quotes at t=20s is never out of
// sync with what the counter itself actually shows at that instant.
function simValueAt(p, D, t) {
  const { tEnd, curve } = stagePlan(p, D);
  const lin = String(p.ease || "") === "linear" || curve.length > 1;
  const u = clamp(t / tEnd);
  const a = num(p.start, 0), b = num(p.end, 1e6);
  return a + (b - a) * (curve.length > 1 ? curveAt(curve, u) : lin ? u : Math.pow(u, 2.2));
}
function drawWhatIfSim(ctx, t, p, D) {
  const { texts: stages, starts, n, tEnd, curve } = stagePlan(p, D);
  let si = -1; for (let i = 0; i < n; i++) if (t >= starts[i] - 1e-9) si = i;
  const sT = si < 0 ? 0 : t - starts[si];
  const lin = String(p.ease || "") === "linear" || curve.length > 1, calm = ["seasons", "clock", "frost", "ladder", "recede"].includes(String(p.hero || ""));   // calm = a pause, not a crash
  const contact = t >= tEnd, ct = t - tEnd;
  const hit = (si >= 0 && sT < 0.35) || contact;
  const u = clamp(t / tEnd);
  const a = num(p.start, 0), b = num(p.end, 1e6), v = simValueAt(p, D, t);
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
  else if (hero === "frost") heroFrost(ctx, t, w, cam);
  else if (hero === "recede") heroRecede(ctx, t, w, cam);
  else if (hero === "ladder") heroScale(ctx, t, v, String(p.ladder || "fold"), cam);
  else if (hero === "clock") heroClock(ctx, t, v, cam);
  else if (hero === "seasons") heroSeasons(ctx, t, contact ? Math.floor(v + 1e-9) + 0.75 : v, cam);   // the pause lands on a still winter frame
  else if (hero === "firstperson") heroFirstPerson(ctx, t, w, cam);
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
    RTS.drawPovTag(ctx, (String(p.episode) === "none" ? "" : `${epi(p)} · `) + (String(p.tag || "").trim() || "WHAT IF"), { right: simClock(simS, String(p.clock || "") === "years") });
    const full = Math.abs(b - a) / rate, per = full / Math.max(0.1, lin ? tEnd : tEnd - HOLD); // average sim seconds per real second
    ctx.save(); ctx.font = mono(24); track(ctx, 1.2); ctx.fillStyle = P.cyan; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.fillText(p.speedUnit ? `▶▶ 1 S ≈ ${(Math.abs(b - a) / Math.max(0.1, lin ? tEnd : tEnd - HOLD)).toFixed(1).replace(/\.0$/, "")} ${String(p.speedUnit).toUpperCase()}` : `▶▶ 1 S ≈ ${simSpan(per)}`, 940, 296); ctx.restore();
    const cb = RTS.drawCounter(ctx, shown(v), { y: 320, size: 150, unit: unitFor(v), label: lbl,
      desc: contact ? (calm ? `STAGE ${n}/${n} · ${endWord}` : endWord) : `STAGE ${Math.max(1, si + 1)}/${n}`, color: (calm && !contact ? false : hit) ? P.alert : P.amber });
    if (String(p.rule || "").trim()) {
      ctx.save(); ctx.font = mono(28); track(ctx, 1.6); ctx.fillStyle = "rgba(242,244,247,.78)"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(String(p.rule).toUpperCase(), 64, cb + 40, 876); ctx.restore();
    }
    const k = easeBack(sT / 0.25);
    ctx.save(); ctx.globalAlpha = clamp(sT / 0.15); ctx.translate(0, (1 - k) * 30);
    captionBal(ctx, stages[si] || "", { y: 1262, size: String(stages[si] || "").length > 30 ? 54 : 62 });   // long (2-line) captions a size down so they clear the footer line
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

// ---------- 1c. HAND (meme format, Side Character POV): the object that houses "him" takes the room's applause as an insult ----------
// 11 s, fixed: frame 0 (object + tag) -> the livestream on its dash phone (setup caption) -> HARD CUT to its hurt face + punch -> proud topper -> ease back,
// hazard-clap, exact frame 0 held 9.0-11.0 (loop). The man is never shown: only the object, the stage as a dark room with clapping hands, and text.
const HAND_D = 11.0, HAND_KINDS = {
  car:    { body: "#E8D9B8", eyes: [[340, 880], [740, 880]], er: 62, mouth: [440, 962, 200, 52], face: [540, 900] },
  bed:    { body: "#3F8F92", eyes: [[370, 905], [710, 905]], er: 72, mouth: [450, 1000, 180, 36], face: [540, 920] },
  wallet: { body: "#6B4423", eyes: [[400, 850], [680, 850]], er: 58, mouth: [440, 975, 200, 44], face: [540, 900] },
};
const smooth01 = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
function handState(t) { // the face over time: lid (0 open .. .6 slits), smile (-1 hurt .. 1 proud), lift px, quiver px, camera zoom
  let lid = 0, smile = 0, lift = 0, quiver = 0, zoom = 1 + 0.03 * clamp(t / 1.5);
  if (t >= 5.7 && t < 7.9) {
    const a = t - 5.7, hurt = smooth01(a / 0.12), proud = smooth01((t - 6.9) / 0.18);
    lid = 0.56 * hurt * (1 - proud) - 0.08 * proud; smile = -0.5 * hurt * (1 - proud) + 0.9 * proud; lift = 16 * proud;
    quiver = a < 1.2 ? Math.sin(a * 80) * 3.5 * Math.max(0, 1 - a / 0.6) : 0; zoom = 1.45;
  } else if (t >= 7.9 && t < 8.3) {
    const e = smooth01((t - 7.9) / 0.4); lid = -0.08 * (1 - e); smile = 0.9 * (1 - e); lift = 16 * (1 - e); zoom = 1.45 + (1.03 - 1.45) * e;
  } else if (t >= 8.3 && t < 9.0) zoom = 1.03;
  else if (t >= 9.0) zoom = 1;
  return { lid, smile, lift, quiver, zoom };
}
function handWorld(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#080B1C"); g.addColorStop(0.62, "#161D42"); g.addColorStop(1, "#0C1020");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1B2547"; ctx.fillRect(0, 1130, W, 400);   // the lot
  ctx.fillStyle = "#0E1530"; ctx.fillRect(560, 470, 460, 660);   // the convention centre: a glass box, lit
  for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) { ctx.fillStyle = (r * 7 + c * 3) % 5 === 0 ? "#3B4468" : "#F6D58A"; ctx.globalAlpha = 0.85; ctx.fillRect(580 + c * 72, 500 + r * 88, 52, 58); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#9AA3C0"; ctx.fillRect(122, 640, 14, 500);   // the lot lamp
  const gl = ctx.createRadialGradient(129, 650, 4, 129, 650, 330); gl.addColorStop(0, "rgba(255,236,170,.9)"); gl.addColorStop(1, "rgba(255,236,170,0)");
  ctx.fillStyle = gl; ctx.fillRect(0, 300, 560, 700);
  ctx.fillStyle = "#FFF3C4"; ctx.beginPath(); ctx.arc(129, 645, 20, 0, 7); ctx.fill();
}
function handObject(ctx, kind, t, st, blink, quietTime) {
  const K = HAND_KINDS[kind] || HAND_KINDS.car, bob = Math.sin(quietTime * 5.7) * 3.2;
  ctx.save(); ctx.translate(st.quiver, bob - st.lift);
  const rr = (x, y, w, h, r, col) => { ctx.fillStyle = col; rrect(ctx, x, y, w, h, r); ctx.fill(); };
  if (kind === "car") {
    ctx.fillStyle = "#1B1B24"; for (const x of [300, 780]) { ctx.beginPath(); ctx.arc(x, 1070, 74, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#6E6E7C"; for (const x of [300, 780]) { ctx.beginPath(); ctx.arc(x, 1070, 30, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#D9C9A4"; ctx.beginPath(); ctx.moveTo(330, 600); ctx.lineTo(750, 600); ctx.lineTo(830, 790); ctx.lineTo(250, 790); ctx.closePath(); ctx.fill();   // cabin
    ctx.fillStyle = "#26415C"; ctx.beginPath(); ctx.moveTo(362, 630); ctx.lineTo(718, 630); ctx.lineTo(782, 780); ctx.lineTo(298, 780); ctx.closePath(); ctx.fill();   // windshield
    rr(380, 700, 170, 74, 30, "#8EC5FF");   // soft-blue pillow
    rr(560, 712, 150, 62, 16, "#C9B79C");   // folded blanket
    ctx.strokeStyle = "#F2F4F7"; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(735, 745); ctx.lineTo(765, 700); ctx.stroke();   // toothbrush
    const sw = Math.sin(quietTime * 2.2) * 6; ctx.strokeStyle = "#F5C242"; ctx.lineWidth = 5;   // the lanyard
    ctx.beginPath(); ctx.moveTo(540, 632); ctx.lineTo(540 + sw, 690); ctx.stroke(); rr(520 + sw, 690, 44, 30, 5, "#FFFFFF");
    const wa = quietTime > 0.5 && quietTime < 1.3 ? Math.sin((quietTime - 0.5) * Math.PI * 2.5) * 0.5 : 0;   // one wiper wag
    ctx.strokeStyle = "#0B0F14"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(540, 778); ctx.lineTo(540 + Math.sin(wa) * 150, 778 - Math.cos(wa) * 140); ctx.stroke();
    rr(200, 770, 680, 290, 64, K.body);
    rr(210, 1030, 660, 44, 18, "#BFAF8A");
    for (const x of [262, 818]) rr(x - 22, 800, 44, 26, 10, blink ? "#FFB020" : "#8A6A2A");   // hazards
  } else if (kind === "bed") {
    rr(250, 640, 580, 260, 24, "#7A5A3A"); rr(240, 1030, 50, 90, 8, "#5A3F28"); rr(790, 1030, 50, 90, 8, "#5A3F28");
    rr(210, 860, 660, 210, 40, "#F0E6D2"); rr(210, 930, 660, 140, 36, K.body);
    for (const x of [262, 818]) { ctx.fillStyle = "#5A3F28"; ctx.fillRect(x - 6, 780, 12, 90); rr(x - 34, 750, 68, 40, 12, blink ? "#FFD060" : "#B59A52"); }   // bedside lamps
  } else {
    for (const [x, c, r] of [[330, "#4C8BF5", -0.14], [530, "#E4572E", 0.04], [700, "#F2C14E", 0.18]]) { ctx.save(); ctx.translate(x, 740); ctx.rotate(r); rr(-90, -60, 180, 110, 12, c); ctx.restore(); }   // cards peeking out
    rr(230, 770, 620, 340, 52, K.body); rr(230, 770, 620, 150, 52, "#563519");
    ctx.strokeStyle = "rgba(255,220,160,.55)"; ctx.lineWidth = 4; ctx.setLineDash([16, 12]); ctx.strokeRect(262, 802, 556, 286); ctx.setLineDash([]);
    ctx.fillStyle = "#E7B94B"; ctx.beginPath(); ctx.arc(540, 928, 26, 0, 7); ctx.fill();
    for (const x of [262, 818]) { ctx.fillStyle = blink ? "#FFD060" : "#B59A52"; ctx.beginPath(); ctx.arc(x, 760, 22, 0, 7); ctx.fill(); }   // coins
  }
  // the face (same drawing for every object): eyes with lids in the body colour, a mouth that goes from a flat hurt line to a proud smile
  const lidCol = K.body;
  for (const [ex, ey] of K.eyes) {
    ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, K.er, 0, 7); ctx.clip();
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(ex - K.er, ey - K.er, 2 * K.er, 2 * K.er);
    ctx.fillStyle = "#12161F"; ctx.beginPath(); ctx.arc(ex + (st.smile > 0.3 ? 0 : 6), ey + (st.smile > 0.3 ? -8 : 10), K.er * 0.42, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex - 8, ey - 14, K.er * 0.11, 0, 7); ctx.fill();
    if (st.lid > 0) {
      const dy = st.lid * 2 * K.er, side = ex < 540 ? 1 : -1, sl = 0.5 * st.lid * K.er;   // inner corners higher = hurt
      ctx.fillStyle = lidCol; ctx.beginPath(); ctx.moveTo(ex - K.er, ey - K.er - 2); ctx.lineTo(ex + K.er, ey - K.er - 2);
      ctx.lineTo(ex + K.er, ey - K.er + dy - side * sl); ctx.lineTo(ex - K.er, ey - K.er + dy + side * sl); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  const [mx, my, mw, mh] = K.mouth;
  ctx.strokeStyle = "#1B1B24"; ctx.fillStyle = kind === "car" ? "#2A2630" : "#1D1A22"; ctx.lineWidth = 8; ctx.lineCap = "round";
  if (st.smile > 0.15) { ctx.beginPath(); ctx.arc(mx + mw / 2, my - 12, mw / 2.1, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  else { rr(mx, my + (st.smile < -0.2 ? 6 : 0), mw, kind === "car" ? mh : mh * 0.7, 14, ctx.fillStyle);
    if (kind === "car") { ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 3; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(mx + (mw * i) / 5, my + 6); ctx.lineTo(mx + (mw * i) / 5, my + mh - 4); ctx.stroke(); } } }
  ctx.restore();
}
function handStream(ctx, t, p) {
  ctx.fillStyle = "#0A0C12"; ctx.fillRect(0, 0, W, H);
  const k = t > 4.1 && t < 5.5 ? Math.sin((t - 4.1) * 1.2) * 0.04 : 0;   // the wheel creaks a few degrees as the car tenses
  ctx.save(); ctx.translate(540, 1820); ctx.rotate(k); ctx.strokeStyle = "#1C202C"; ctx.lineWidth = 84; ctx.beginPath(); ctx.arc(0, 0, 470, 0, 7); ctx.stroke(); ctx.restore();
  const r = SC.drawHudFrame(ctx, { x: 70, y: 400, w: 940, h: 700, screen: "#10131C" });
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, r.r); ctx.clip();
  const cone = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); cone.addColorStop(0, "rgba(255,255,255,.22)"); cone.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(500, r.y); ctx.lineTo(580, r.y); ctx.lineTo(760, r.y + 430); ctx.lineTo(320, r.y + 430); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#222838"; ctx.fillRect(r.x + 60, r.y + 430, r.w - 120, 36);   // the stage
  ctx.strokeStyle = "#C7CCD9"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(540, r.y + 430); ctx.lineTo(540, r.y + 300); ctx.stroke();   // mic stand
  ctx.fillStyle = (t > 1.5 && Math.floor(t * 2) % 2 === 0) || t > 2.8 ? "#FFB020" : "#8A6A2A"; rrect(ctx, 520, r.y + 258, 40, 62, 20); ctx.fill();   // the mic, glowing
  const clap = t > 4.1 && t < 5.5;
  for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {   // low-poly clapping hands, no faces
    const x = r.x + 70 + i * 92 + (row ? 46 : 0), y = r.y + 560 + row * 70, a = clap ? Math.sin(t * 22 + i * 1.7 + row) * 0.45 : 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = "#F2B880"; ctx.beginPath(); ctx.ellipse(-12, 0, 14, 28, -0.3, 0, 7); ctx.fill();
    ctx.fillStyle = "#E8A56A"; ctx.beginPath(); ctx.ellipse(12, 0, 14, 28, 0.3, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = "#E5333D"; rrect(ctx, r.x + 34, r.y + 30, 130, 52, 12); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `400 34px Anton, "Noto Color Emoji", Impact, sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("● LIVE", r.x + 48, r.y + 68);
  if ((t > 4.08 && t < 4.14) || (t > 4.22 && t < 4.28)) { ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(r.x, r.y, r.w, r.h); }   // glare flicker, local to the phone
  ctx.restore();
  const full = String(p.stage || "").trim();
  if (full && t >= 2.8) {
    const n = Math.min(full.length, Math.floor((t - 2.8) * 28)), shown = full.slice(0, n);
    ctx.save(); ctx.fillStyle = "rgba(10,12,18,.88)"; ctx.fillRect(0, 1130, W, 250);
    ctx.font = inter(60, 800); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#fff";
    const lines = wrap(ctx, shown, 860).slice(0, 3); lines.forEach((l, i) => ctx.fillText(l, 540, 1198 + i * 70, 880)); ctx.restore();
  }
}
function drawHand(ctx, t, p, D) {
  const kind = HAND_KINDS[p.object] ? p.object : "car", tt = t >= 9.0 ? 0 : t;   // 9.0-11.0 = EXACT frame-0 state (loop)
  const stream = tt >= 1.5 && tt < 5.7;
  if (stream) handStream(ctx, tt, p);
  else {
    const st = handState(tt), blink = tt >= 7.9 && tt < 9.0 && Math.sin((tt - 7.9) * Math.PI * 3) > 0;
    const z = st.zoom * 1.18, cy = 900 - (st.zoom - 1) * 250;   // frame 0: the object fills ~70% of the width
    ctx.save(); ctx.translate(540, cy); ctx.scale(z, z); ctx.translate(-540, -940);
    handWorld(ctx, tt); handObject(ctx, kind, tt, st, blink, tt);
    ctx.restore();
    if (tt >= 5.7 && tt < 7.9) {
      const a = tt - 5.7, k = easeBack(a / 0.14), lines = rows(p.punch).slice(0, 2);
      ctx.save(); ctx.translate(540, 1100); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k); ctx.translate(-540, -1100); ctx.globalAlpha = clamp(a / 0.08);
      let y = 1010; lines.forEach((l) => { y = SC.drawTopText(ctx, l, { y, size: 96, maxLines: 1 }); }); ctx.restore();
      if (tt >= 6.9 && String(p.topper || "").trim()) {
        const b = easeBack((tt - 6.9) / 0.14); ctx.save(); ctx.translate(540, 1330); ctx.scale(0.8 + 0.2 * b, 0.8 + 0.2 * b); ctx.translate(-540, -1330);
        SC.drawTopText(ctx, p.topper, { y: 1285, size: 72, maxLines: 1 }); ctx.restore();
      }
    }
  }
  SC.drawPovTag(ctx, String(p.tag || "HAND #1: you're his car"));
}

const dur = (base, per, count, min = 12, max = 45) => clamp(base + per * count, min, max);
export const END_CARD_S = 1.5;
export const TEMPLATES = [
  { id: "whatif-sim", name: "What If Sim", brand: "ranthesim", pro: false, blurb: "Our Ran The Sim look: a big WHAT IF question, a live ticking counter, escalating captions.",
    fields: [
      { key: "premise", label: "The question (1-3 lines, max 9 words; WHAT IF is added for you)", type: "textarea", def: "The Moon got 1 km closer\nevery second?" },
      { key: "label", label: "Counter label", type: "text", def: "Distance to Moon" },
      { key: "unit", label: "Counter unit (m, km/h, °C or % auto-generates comparison captions below)", type: "text", def: "km" },
      { key: "start", label: "Counter starts at", type: "number", def: "384400" },
      { key: "end", label: "Counter ends at", type: "number", def: "0" },
      { key: "rate", label: "Counter speed in sim time (units per second; sets the HUD clock)", type: "number", def: "1" },
      { key: "tag", label: "Short tag (shows after the question)", type: "text", def: "Moon +1 km/s" },
      { key: "rule", label: "Rule line (optional)", type: "text", def: "Rule: 1 km/s · not real orbital physics" },
      { key: "stages", label: "Captions, one per beat (one per line). Leave blank for automatic comparison cards", type: "textarea", def: "Tides start to climb\nCoastlines go under at dawn\nThe sky is mostly Moon\nIt doesn't stop." },
      { key: "episode", label: "Sim number", type: "text", def: "001" },
    ],
    duration: (p) => { const L = num(p.len, 0); if (L > 0) return clamp(L, 8, 60); const n = rows(p.stages).length;
      if (!n) return 35; // blank stages = auto comparison captions (CEO #5070 r2): needs real screen time for several beats, not the stage-count fallback's 8s floor
      return dur(HOLD + TAIL, n <= 4 ? 3.2 : Math.max(2.6, Math.min(3.2, 15.5 / n)), n, 8, 45); }, draw: drawWhatIfSim, bg: (ctx, t) => simBg(ctx, t),
    valueAt: simValueAt,
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
  { id: "hand", name: "Give him a big hand (meme)", brand: "sidecharpov", pro: false, blurb: "The meme format: the object that houses \"him\" hears the room applaud and takes it personally. Pick the object, type the punch and the topper.",
    fields: [
      { key: "tag", label: "Tag: HAND #n, then what you are to him (his car, his bed, his wallet...)", type: "text", def: "HAND #1: you're his car" },
      { key: "object", label: "The object (it's on his side)", type: "select", def: "car", options: [["car", "Car"], ["bed", "Bed"], ["wallet", "Wallet"]] },
      { key: "stage", label: "The line from the room (the meme's setup; keep it short and don't add insults)", type: "text", def: "\"Give him a big hand, guys. Homeless dude.\"" },
      { key: "punch", label: "Your object defends him: it's on his side (2 short lines)", type: "textarea", def: "HE'S NOT HOMELESS.\nHE HAS ME." },
      { key: "topper", label: "What it proudly gives him (a warm brag, ~4 words)", type: "text", def: "I HAVE HEATED SEATS." },
    ],
    duration: () => HAND_D, draw: drawHand, bg: (ctx, t) => handWorld(ctx, 0),
    cues: () => [{ t: 1.5, k: "cut" }, { t: 4.1, k: "applause" }, { t: 5.7, k: "punch" }, { t: 6.9, k: "topper" }, { t: 7.9, k: "hazard" }] },
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
    len: "35", tail: "2", // CEO #4609: full arc; free cuts off at 20s, well before 0%
    stages: "Oxygen drains every second.\nFull to zero in 100 seconds.\nDenver-thin air.\nCandles go out.\nGas flames die." } },
  // SIM #021 Moon farther (Hype #3203, counters = shared/scripts/2026-10-15-moon-farther-021.counters.json, Atlas). HELD until Muse GO + the Short is live.
  // curve = Moon km vs run progress from the counters (u = t/52 s); stages are the video's pinned captions (each true at its start: ocean 100 C at T+3m26s, oceans gone T+22m47s, day 26.5 h / 41.1 h, lock at 554,392 km).
  moonfar: { t: "whatif-sim", name: "The Moon moved 1 km farther every second", p: {
    premise: "THE MOON MOVED 1 KM\nFARTHER EVERY SECOND?", label: "DISTANCE TO THE MOON", unit: "km", start: "384400", end: "554392", rate: "1",
    tag: "MAKE YOUR OWN MOON SIM", episode: "none", rule: "Rule: 1 km/s · not real orbital physics", hero: "recede", endWord: "Locked",
    curve: "0:0,0.0673:0.00047,0.1731:0.00121,0.2308:0.00272,0.2885:0.00424,0.4038:0.00804,0.4423:0.03718,0.5048:0.08757,0.5577:0.14271,0.6346:0.16583,0.7115:0.18894,0.8077:0.40153,0.8462:0.48657,0.8846:0.86312,0.9423:0.98345,1:1",
    len: "35", tail: "2", int: "floor", // CEO #4609: full arc now; free cuts off at 20s mid-climb
    stages: "Whole ocean: 100\u00A0°C in ~3.5 minutes. @3.1\nEvery ocean boiled off in ~23 minutes. @7.3\nA day now lasts 26+ hours. @9.1\nA day now lasts 41+ hours. @14.6\nThe Moon stops moving. @30" } },
  // SIM #022 Runner (Hype #4521, IG 10.7k): first-person "world streaming past" hero, same sim-clock/counter/caption
  // machinery as every other whatif-sim demo — just a new `hero: "firstperson"` visual, no new template.
  runner: { t: "whatif-sim", name: "You ran 1 km/h faster every second", p: {
    premise: "You ran 1 km/h\nfaster every second?", label: "YOUR SPEED", unit: "km/h", start: "0", end: "30158", rate: "1",
    tag: "RUN, FASTER EVERY SECOND", rule: "Rule: +1 km/h every second · not real physics", episode: "022", hero: "firstperson", endWord: "Orbit",
    int: "floor", len: "35", tail: "2", // CEO #4609: full arc; free cuts off at 20s (well before orbit)
    // No literal numbers in the captions (HUD already shows the live exact figure): the default pow(2.2) curve
    // climbs from ~0 to 30,158 over the full length, so a caption's own number would drift wildly out of the
    // ±25% caption-vs-HUD tolerance by the time the NEXT caption takes over (first found in Muse's review, #4539).
    stages: "Speed climbs 1 km/h every second. @3\nAlready faster than a cheetah. @6\nFaster than the speed of sound. @9.5\nYour weight here: almost nothing. @13.5\nWeight: zero. You're in orbit. @30" } },
  life: { t: "whatif-sim", name: "Your life played at 1 second per year", p: {
    premise: "Your life played at\n1 second per year?", label: "Age", unit: "years", start: "0", end: "18", rate: "0.0000000316881",
    tag: "Your life", rule: "Rule: 1 second = 1 year · US averages", episode: "005", hero: "seasons", endWord: "Paused",
    ease: "linear", len: "20", tail: "2", int: "floor", clock: "years",
    stages: "Your life. 1 second = 1 year. @3\nAge 5: school starts. @5\nSleep so far: about 3.5 years. @7\nDouble digits: age 10. @10\n500 million heartbeats. @13.6\nTime with family: 4.3 hours a day. @15\nMost teens still live at home. @16.6\nAbout half your family time: used. @18" } },
  sleepless: { t: "whatif-sim", name: "You never slept again", p: {
    premise: "You never\nslept again?", label: "Hours awake", unit: "h", start: "0", end: "264", rate: "0.000277777778",
    tag: "Never sleep again", rule: "Rule: awake since 7:00 AM · up to 264 h", episode: "012", hero: "clock", endWord: "Stopped",
    curve: "0:0,0.4:0.0909,0.6:0.2727,1:1", len: "20", tail: "2", clock: "", int: "floor",
    stages: "By midnight, you'll react like you're tipsy. @3\n17 hours awake: performs like 0.05% BAC. @5.1\n24 hours: performs like 0.10% BAC. @7.2\n48 hours: rooms can start to move. @9\n72 hours: hallucinations can start. @10.8\nDay 7: our picture of hallucinations. @13.5\nEveryone sees something different. @15.6\n264 hours. Randy Gardner, age 17, 1964. @18" } },
  cools: { t: "whatif-sim", name: "Earth cooled 3 °C every second", p: {
    premise: "Earth cooled\n3 °C every second?", label: "Temperature", unit: "°C", start: "15", end: "-210", rate: "3",
    tag: "Earth cools 3 °C/s", rule: "Rule: 3 °C every second, everywhere", episode: "010", hero: "frost", endWord: "Frozen",
    curve: "0:0,0.1667:0.0489,0.2444:0.0667,0.3333:0.1467,0.4222:0.2444,0.5111:0.3689,0.6:0.4622,0.6889:0.64,0.7667:0.6978,0.8667:0.9156,1:1", len: "20", tail: "2",
    stages: "Cooling 3 °C every second. @3\n0 °C: water freezes. @4.4\n-18 °C: your freezer. @6\n-40 °C is -40 °F. @7.6\nOymyakon, Russia: -68 °C record. @9.2\n-89 °C: coldest air ever recorded. @10.8\n-129 °C: halfway to absolute zero. @12.4\nAbout -142 °C: CO2 snows out. @13.8\nAbout -191 °C: the air starts to rain. @15.6\n-210 °C: nitrogen freezes. @18" } },
  fold: { t: "whatif-sim", name: "You folded paper once every second", p: {
    premise: "You folded paper\nonce every second?", label: "Folds", unit: "folds", start: "0", end: "42", rate: "1",
    tag: "Fold paper 42x", rule: "Rule: 0.1 mm sheet, doubles every fold", episode: "013", hero: "ladder", ladder: "fold", endWord: "Past the Moon",
    ease: "linear", int: "floor", speedUnit: "folds", len: "20", tail: "1.5",
    stages: "One fold doubles the thickness. @3.1\nThicker than your palm now. @4.4\nTaller than you. Through the ceiling. @6.7\nTaller than a house. @7.9\nTaller than the Burj Khalifa. @10.1\nPast Mount Everest. @11.9\nPast 100 km: the edge of space. @13.3\nPast the Space Station. @14.5\nTaller than the Earth is wide. @16.3\n42 folds: past the Moon. Real record: 12 folds. @18.5" } },
  ants: { t: "whatif-sim", name: "The number of ants doubled every second", p: {
    premise: "The number of ants\ndoubled every second?", label: "Doublings", unit: "doublings", start: "0", end: "54", rate: "1",
    tag: "Ants x2 every second", rule: "Rule: 1 ant, doubles every second", episode: "015", hero: "ladder", ladder: "ants", endWord: "Earth's ants",
    ease: "linear", int: "floor", speedUnit: "doublings", len: "20", tail: "1.5",
    stages: "One ant. It doubles every second. @3\nPast 1,000 ants: a spoonful. @4.2\nPast 50,000: a coffee mug. @5.4\nPast a million: a small bucket. @7\nPast 30 million: a wheelie bin. @8.7\nPast a billion: a garden shed. @10.3\nPast 10 billion: a living room. @11.4\nPast 100 billion: a house. @12.6\nPast a trillion: over six storeys. @13.7\nPast 10 trillion: a 13-storey block. @15.1\nTaller than the Great Pyramid. @16.8\nAbout every ant on Earth: taller than the Empire State. @18.5" } },
  // CEO #5060/#5070: the self-serve "+1/second" picker demo. stages left blank -> autoStages() generates the comparison
  // captions from MILESTONES.m. Facts match the cleared houseplant script (shared/scripts/2026-10-15-plant-grows-007.md):
  // start 0.12 m seedling, rate 0.01 m/s = 1 cm/s, Eiffel (330 m) at ~9 h, Everest (8,849 m) at ~10 d, Karman (100,000 m) at ~115 d.
  houseplant: { t: "whatif-sim", name: "A houseplant grew 1 cm every second", p: {
    premise: "A houseplant grew\n1 cm every second?", label: "Height", unit: "m", start: "0.12", end: "100000", rate: "0.01",
    tag: "Houseplant +1 cm/s", rule: "Rule: 1 cm/s · no acceleration", episode: "007", endWord: "Karman line",
    len: "35", tail: "1.5", stages: "" } },
  hand: { t: "hand", name: "Give him a big hand: you're his car", p: {} },
  // HAND #2 copy from shared/scripts/2026-10-15-b5-big-hand-2-the-bed.md. HELD until HAND #2 has posted (Muse: the demo would spoil the post).
  handbed: { hold: true, t: "hand", name: "Give him a big hand: you're the empty bed", p: { tag: "HAND #2: you're the empty bed", object: "bed", punch: "BIG HAND?\nI'M KING SIZE.", topper: "I HAVE A MINT." } },
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
