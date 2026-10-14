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

// ---------- 1. Counter sim ----------
function drawCounterSim(ctx, t, p, D) {
  const stages = rows(p.stages), n = Math.max(1, stages.length);
  const intro = 2.2, stageT = (D - intro - 1.2) / n;
  const si = t < intro ? -1 : Math.min(n - 1, Math.floor((t - intro) / stageT));
  const sT = si < 0 ? t : t - intro - si * stageT;
  simFrame(ctx, t, p);
  const qb = RTS.drawTopText(ctx, p.question || "");
  const u = clamp(t / (D - 1.0));
  const v = num(p.start, 0) + (num(p.end, 1e6) - num(p.start, 0)) * Math.pow(u, 2.2);
  const hit = si >= 0 && sT < 0.35;
  const cb = RTS.drawCounter(ctx, fmt(v), { y: Math.max(qb + 90, 520), size: 160, label: String(p.label || "COUNT"),
    desc: si >= 0 ? `STAGE ${si + 1}/${n}` : "SIMULATION RUNNING…", color: hit ? P.alert : P.amber });
  if (si >= 0) {
    const k = easeBack(sT / 0.25);
    ctx.save(); ctx.globalAlpha = clamp(sT / 0.15); ctx.translate(0, (1 - k) * 30);
    RTS.drawCaption(ctx, stages[si], { y: Math.max(cb + 60, 1000), maxLines: 3 });
    ctx.restore();
  }
  ctx.fillStyle = P.line; ctx.fillRect(TB.x0, 1350, TW, 6);
  ctx.fillStyle = P.amber; ctx.fillRect(TB.x0, 1350, TW * u, 6);
  if (hit && sT < 1 / 30) { ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(0, 0, W, H); }
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

// ---------- 3. POV chat (Side Character look: sticker + phone) ----------
function drawPovChat(ctx, t, p, D) {
  const msgs = rows(p.messages).map((l) => /^me\s*:/i.test(l) ? { me: true, text: l.replace(/^me\s*:\s*/i, "") } : { me: false, text: l.replace(/^(them|\w+)\s*:\s*/i, (m, a) => (a.length < 14 ? "" : m)) });
  const n = Math.max(1, msgs.length), gap = (D - 1.0 - 1.4) / n, start = 0.9;
  ctx.fillStyle = "#EEF0F4"; ctx.fillRect(0, 0, W, H);
  const lastAt = start + (n - 1) * gap, sh = t >= lastAt + 0.3 && t < lastAt + 0.7 ? (Math.sin(t * 90) * 8) : 0;
  ctx.save(); ctx.translate(sh, 0);
  SC.drawPovTag(ctx, p.pov || "POV: you're the side character");
  const S = SC.drawHudFrame(ctx, { y: 548, h: 880 });
  const pad = 26, x0 = S.x + pad, x1 = S.x + S.w - pad, tw = x1 - x0;
  // chat header
  ctx.fillStyle = M.recv; rrect(ctx, S.x, S.y, S.w, 110, 0); ctx.fill();
  ctx.fillStyle = M.accent; ctx.beginPath(); ctx.arc(x0 + 30, S.y + 62, 28, 0, 7); ctx.fill();
  ctx.fillStyle = M.ink; ctx.font = inter(34, 800); ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillText(p.contact || "Group chat", x0 + 76, S.y + 62, tw - 80);
  // layout bubbles (>= 40 px text per the kit)
  const fsz = 40, lh = 54;
  ctx.font = inter(fsz, 600);
  const bw = tw * 0.82, top = S.y + 140, bottomLimit = S.y + S.h - 24, lay = [];
  let y = top;
  msgs.forEach((m, i) => { const ls = wrap(ctx, m.text, bw - 48), h = ls.length * lh + 36; lay.push({ m, ls, y, h, at: start + i * gap }); y += h + 24; });
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
    ctx.fillStyle = b.m.me ? M.sent : M.recv; rrect(ctx, x, b.y, bwid, b.h, 28); ctx.fill();
    ctx.fillStyle = b.m.me ? "#fff" : M.ink; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    b.ls.forEach((l, i) => ctx.fillText(l, x + 24, b.y + 18 + 40 + i * lh - 4));
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
export const TEMPLATES = [
  { id: "counter-sim", name: "Counter Sim", brand: "ranthesim", pro: false, blurb: "A live counter escalates through stages. 'What if' format.",
    fields: [
      { key: "question", label: "The question", type: "text", def: "What if the Moon vanished?" },
      { key: "label", label: "Counter label", type: "text", def: "People affected" },
      { key: "start", label: "Counter starts at", type: "number", def: "0" },
      { key: "end", label: "Counter ends at", type: "number", def: "8000000000" },
      { key: "stages", label: "Stages (one per line)", type: "textarea", def: "Tides collapse worldwide\nNights get 40% darker\nEarth's tilt starts to wobble\nClimate zones shift for good" },
    ],
    duration: (p) => dur(5, 5, rows(p.stages).length), draw: drawCounterSim },
  { id: "day-timeline", name: "Day 1 → Day 10,000", brand: "ranthesim", pro: false, blurb: "A timeline that escalates, one beat at a time.",
    fields: [
      { key: "question", label: "The question", type: "text", def: "What if nobody slept for a week?" },
      { key: "lines", label: "Beats: 'When: what happens'", type: "textarea", def: "Day 1: Everyone is fine. Coffee sales spike.\nDay 3: Focus drops by a third.\nDay 5: Hallucinations are common.\nDay 7: Cities run on pure adrenaline." },
    ],
    duration: (p) => dur(4, 4.5, rows(p.lines).length), draw: drawTimeline },
  { id: "pov-chat", name: "POV Chat", brand: "sidecharpov", pro: false, blurb: "A group chat from the side character's phone.",
    fields: [
      { key: "pov", label: "POV tag", type: "text", def: "POV: you're the fish 🐟" },
      { key: "contact", label: "Chat name", type: "text", def: "Fish tank group chat" },
      { key: "messages", label: "Messages (start yours with 'me:')", type: "textarea", def: "Did you see that?\nHe just got the girl\nme: i've been right here for 3 years\nme: i literally do tricks\nBro it's a fish bowl, relax" },
    ],
    duration: (p) => dur(3.5, 2.4, rows(p.messages).length), draw: drawPovChat },
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
  const D = tpl.duration(params), total = D + (opts.endCard ? 1.2 : 0);
  ctx.save(); ctx.clearRect(0, 0, W, H);
  if (t >= D && opts.endCard) {
    ctx.fillStyle = "#0A0E14"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = grot(74); ctx.fillText("Made with POVMaker", W / 2, 700);
    ctx.font = mono(38); ctx.fillStyle = RTS.PALETTE.amber; ctx.fillText(SITE, W / 2, 790);
    ctx.font = inter(34, 600); ctx.fillStyle = RTS.PALETTE.cyan; ctx.fillText("Make videos like this", W / 2, 870);
  } else {
    tpl.draw(ctx, Math.min(t, D - 1 / 60), params, D);
    // blend the last 0.35s back into frame 0 so the video loops cleanly
    if (!opts.endCard && t > D - 0.35) {
      ctx.globalAlpha = clamp((t - (D - 0.35)) / 0.35); tpl.draw(ctx, 0, params, D); ctx.globalAlpha = 1;
    }
  }
  if (opts.watermark && !(opts.endCard && t >= D)) {
    const label = "made with POVMaker · " + SITE;
    ctx.font = inter(26, 800); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(label).width + 40;
    ctx.fillStyle = "rgba(10,14,20,.78)"; rrect(ctx, (W - w) / 2, 1472, w, 46, 23); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(label, W / 2, 1496);
  }
  ctx.restore();
  return total;
}
