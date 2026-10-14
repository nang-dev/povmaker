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
const epi = (p) => "SIM #" + String(p.episode || "001").padStart(3, "0");
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

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
// The moving sim behind everything: a body that spirals inward as the run escalates, with debris.
function simHero(ctx, t, u, hot) {
  const cx = 540, cy = 960;
  ctx.save(); ctx.globalAlpha = 0.6;
  ctx.strokeStyle = "rgba(61,214,245,.18)"; ctx.lineWidth = 2;
  for (const r of [200, 320, 440]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  const g = ctx.createRadialGradient(cx - 40, cy - 40, 20, cx, cy, 150);
  g.addColorStop(0, "#5FA8D8"); g.addColorStop(1, "#14304A");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 104, 0, 7); ctx.fill();
  const orbR = 440 - 250 * Math.pow(u, 1.4), ang = t * (0.45 + 0.8 * u);
  const ox = cx + Math.cos(ang) * orbR, oy = cy + Math.sin(ang) * orbR * 0.8;
  for (let i = 1; i <= 14; i++) {
    const a = ang - i * 0.04, r = 440 - 250 * Math.pow(u, 1.4);
    ctx.fillStyle = `rgba(255,176,32,${0.32 * (1 - i / 14)})`;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 20 - i, 0, 7); ctx.fill();
  }
  ctx.fillStyle = hot ? P.alert : P.amber; ctx.beginPath(); ctx.arc(ox, oy, 24, 0, 7); ctx.fill();
  for (let i = 0; i < 26; i++) {
    const k = (i * 0.618) % 1, a = i * 2.4 + t * (0.1 + k * 0.25), r = 150 + ((i * 97) % 300) * (1 - 0.3 * u);
    ctx.fillStyle = `rgba(242,244,247,${0.12 + 0.3 * k})`;
    ctx.fillRect(cx + Math.cos(a) * r - 3, cy + Math.sin(a) * r * 0.8 - 3, 6, 6);
  }
  ctx.restore();
}
function drawWhatIfSim(ctx, t, p, D) {
  const stages = rows(p.stages), n = Math.max(1, stages.length), run = D - HOLD - 1.0;
  const stageT = run / n;
  const si = t < HOLD ? -1 : Math.min(n - 1, Math.floor((t - HOLD) / stageT));
  const sT = si < 0 ? 0 : t - HOLD - si * stageT;
  const hit = si >= 0 && sT < 0.35;
  const u = clamp(t / (D - 1.0));
  const v = num(p.start, 0) + (num(p.end, 1e6) - num(p.start, 0)) * Math.pow(u, 2.2);
  simBg(ctx, t); simHero(ctx, t, u, hit);
  const unit = String(p.unit || "").trim(), lbl = String(p.label || "COUNT");
  if (t < HOLD) {
    const b = premiseHook(ctx, t, premiseLines(p));
    RTS.drawCounter(ctx, fmt(v), { y: b + 24, size: 96, unit, label: "" });
  } else {
    RTS.drawHudFrame(ctx, { scrim: true });
    RTS.drawPovTag(ctx, `${epi(p)} · ${String(p.tag || "").trim() || "WHAT IF"}`, { right: clock(t - HOLD) });
    const cb = RTS.drawCounter(ctx, fmt(v), { y: 290, size: 150, unit, label: lbl,
      desc: `STAGE ${si + 1}/${n}`, color: hit ? P.alert : P.amber });
    if (String(p.rule || "").trim()) {
      ctx.save(); ctx.font = mono(28); track(ctx, 1.6); ctx.fillStyle = "rgba(242,244,247,.78)"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(String(p.rule).toUpperCase(), 64, cb + 40, 876); ctx.restore();
    }
    const k = easeBack(sT / 0.25);
    ctx.save(); ctx.globalAlpha = clamp(sT / 0.15); ctx.translate(0, (1 - k) * 30);
    RTS.drawCaption(ctx, stages[si] || "", { y: 1262, maxLines: 2 });
    ctx.restore();
    ctx.fillStyle = P.line; ctx.fillRect(TB.x0, 1240, TW, 6);
    ctx.fillStyle = P.amber; ctx.fillRect(TB.x0, 1240, TW * u, 6);
    if (hit && sT < 1 / 30) { ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(0, 0, W, H); }
  }
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
  let t = 0.9; const gap = 1.7;
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
  const lastAt = times[n - 1], sh = t >= lastAt + 0.3 && t < lastAt + 0.7 ? (Math.sin(t * 90) * 8) : 0;
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
      if (!b.m.me && age > -0.8 && lay.indexOf(b) === shown.length) {
        ctx.fillStyle = M.recv; rrect(ctx, x0, b.y, 140, 66, 33); ctx.fill();
        ctx.fillStyle = "#9CA3AF";
        for (let d = 0; d < 3; d++) { ctx.beginPath(); ctx.arc(x0 + 38 + d * 32, b.y + 33 - Math.abs(Math.sin(t * 8 + d)) * 8, 9, 0, 7); ctx.fill(); }
      }
      continue;
    }
    ctx.font = inter(fsz, 600);
    const k = easeBack(age / 0.22), bwid = Math.min(bw, Math.max(...b.ls.map((l) => ctx.measureText(l).width)) + 48);
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
function drawNotifs(ctx, t, p, D) {
  const items = rows(p.notifs).map((l) => { const i = l.indexOf(":"); return i > 0 && i < 22 ? [l.slice(0, i), l.slice(i + 1).trim()] : ["Messages", l]; });
  const n = Math.max(1, items.length), gap = (D - 1.0 - 1.4) / n;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1f2a5a"); g.addColorStop(1, "#7a2d6b");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  [[200, 500, 300], [850, 1200, 380], [500, 1500, 260]].forEach(([x, y, r], i) => { ctx.beginPath(); ctx.arc(x + Math.sin(t + i) * 30, y + Math.cos(t * .8 + i) * 30, r, 0, 7); ctx.fill(); });
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
function drawBigCaption(ctx, t, p, D) {
  const lines = rows(p.lines), n = Math.max(1, lines.length), gap = (D - 1.0) / n;
  const i = Math.min(n - 1, Math.floor(t / gap)), age = t - i * gap;
  ctx.fillStyle = M.sent; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  for (let s = -H; s < W + H; s += 140) { ctx.beginPath(); ctx.moveTo(s + t * 40, 0); ctx.lineTo(s + 70 + t * 40, 0); ctx.lineTo(s - H + 70 + t * 40, H); ctx.lineTo(s - H + t * 40, H); ctx.fill(); }
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
      { key: "tag", label: "Short tag (shows after the question)", type: "text", def: "Moon +1 km/s" },
      { key: "rule", label: "Rule line (optional)", type: "text", def: "Rule: 1 km/s · not real orbital physics" },
      { key: "stages", label: "Captions, one per beat (one per line)", type: "textarea", def: "Tides start to climb\nCoastlines go under at dawn\nThe sky is mostly Moon\nThen it stops. Almost." },
      { key: "episode", label: "Sim number", type: "text", def: "001" },
    ],
    duration: (p) => dur(HOLD + 1.0, 3.2, rows(p.stages).length, 8, 45), draw: drawWhatIfSim },
  { id: "day-timeline", name: "Day 1 → Day 10,000", brand: "ranthesim", pro: false, blurb: "A timeline that escalates, one beat at a time.",
    fields: [
      { key: "question", label: "The question", type: "text", def: "What if nobody slept for a week?" },
      { key: "lines", label: "Beats: 'When: what happens'", type: "textarea", def: "Day 1: Everyone is fine. Coffee sales spike.\nDay 3: Focus drops by a third.\nDay 5: Hallucinations are common.\nDay 7: Cities run on pure adrenaline." },
    ],
    duration: (p) => dur(4, 4.5, rows(p.lines).length), draw: drawTimeline },
  { id: "pov-chat", name: "POV Chat", brand: "sidecharpov", pro: false, blurb: "Our Side Character look: a POV tag + a group chat from the side character's phone, up to 6 messages.",
    fields: [
      { key: "pov", label: "POV tag", type: "text", def: "POV: you're the goose 🪿" },
      { key: "contact", label: "Chat name", type: "text", def: "Pond group chat" },
      { key: "scene", label: "Scene behind the phone", type: "select", def: "pond", options: [["pond", "Pond"], ["meadow", "Meadow"], ["night", "Night"], ["plain", "Plain grey"]] },
      { key: "messages", label: "Messages, max 6: 'Name: text'. Start yours with 'me:'. Optional ' @3.5' = seconds in.", type: "textarea",
        def: "Duck: a jogger is on the path\nme: on it\nFrog: he's literally just jogging\nme: he made eye contact\nDuck: he's sprinting now\nme: you're welcome for the cardio @9.4" },
    ],
    duration: chatDuration, draw: drawPovChat },
  { id: "notif-stack", name: "Notification Stack", brand: "sidecharpov", pro: true, blurb: "Lock-screen notifications pile up. Pure chaos.",
    fields: [
      { key: "pov", label: "POV tag", type: "text", def: "POV: your phone at 3 a.m." },
      { key: "time", label: "Clock", type: "text", def: "3:07" },
      { key: "notifs", label: "Notifications ('App: text')", type: "textarea", def: "Mum: you up?\nBank: unusual activity detected\nGroup chat: 47 new messages\nCalendar: Meeting in 5 hours\nBattery: 1% remaining" },
    ],
    duration: (p) => dur(3, 2.2, rows(p.notifs).length), draw: drawNotifs },
  { id: "big-caption", name: "Big Caption", brand: "sidecharpov", pro: true, blurb: "Meme-native Anton captions that hit one at a time.",
    fields: [
      { key: "pov", label: "POV tag", type: "text", def: "POV: the other driver" },
      { key: "lines", label: "Captions (one per line)", type: "textarea", def: "Me, going the speed limit\nHim, doing it the hard way\nThe light was green for 11 seconds\nHe still hasn't moved" },
    ],
    duration: (p) => dur(2.5, 2.4, rows(p.lines).length), draw: drawBigCaption },
];

export function defaults(tpl) { return Object.fromEntries(tpl.fields.map((f) => [f.key, f.def])); }

// Render one frame. opts: {safe, watermark, endCard}
export function renderFrame(ctx, tpl, params, t, opts = {}) {
  const D = tpl.duration(params), total = D + (opts.endCard ? END_CARD_S : 0);
  ctx.save(); ctx.clearRect(0, 0, W, H);
  if (t >= D && opts.endCard) {
    ctx.fillStyle = "#0A0E14"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = grot(104); ctx.fillText("Made with", W / 2, 800); ctx.fillText("POVMaker", W / 2, 920);
    ctx.font = inter(58, 800); ctx.fillStyle = RTS.PALETTE.cyan; ctx.fillText("Make videos like this", W / 2, 1060);
    if (SITE) { ctx.font = mono(50); ctx.fillStyle = RTS.PALETTE.amber; ctx.fillText(SITE, W / 2, 1150, 960); }
  } else {
    tpl.draw(ctx, Math.min(t, D - 1 / 60), params, D);
    // blend the last 0.35s back into frame 0 so the video loops cleanly
    if (!opts.endCard && t > D - 0.35) {
      ctx.globalAlpha = clamp((t - (D - 0.35)) / 0.35); tpl.draw(ctx, 0, params, D); ctx.globalAlpha = 1;
    }
  }
  if (opts.watermark && !(opts.endCard && t >= D)) {
    // single line inside the safe box (y <= 1440, x <= 940), right-aligned, above the platform caption zone
    ctx.save(); ctx.globalAlpha = 0.75; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.font = inter(30, 800); ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText("Made with POVMaker" + (SITE ? " · " + SITE : ""), 940, 1432);
    ctx.restore();
  }
  ctx.restore();
  return total;
}
