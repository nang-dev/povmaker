// Templates are pure functions of (ctx, t, params): deterministic, so preview and export share one code path.
import { W, H, SAFE, SIM, MEME } from "./brand.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeBack = (x) => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const rows = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const mono = (px) => `700 ${px}px "JetBrains Mono", monospace`;
const grot = (px) => `700 ${px}px "Space Grotesk", system-ui, sans-serif`;
const inter = (px, w = 600) => `${w} ${px}px Inter, system-ui, sans-serif`;
const anton = (px) => `400 ${px}px Anton, Impact, sans-serif`;

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/), out = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = w; } else cur = test;
  }
  if (cur) out.push(cur);
  return out;
}
function fitFont(ctx, text, mk, size, maxW) {
  for (; size > 24; size -= 4) { ctx.font = mk(size); if (ctx.measureText(text).width <= maxW) break; }
  return size;
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
const TB = SAFE.textBox, TW = TB.x1 - TB.x0;
const num = (v, d) => { const n = Number(String(v).replace(/[, _]/g, "")); return Number.isFinite(n) ? n : d; };
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const clock = (t) => `T+${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

// ---------- 1. Counter sim (Ran The Sim look) ----------
function simBg(ctx, t) {
  ctx.fillStyle = SIM.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = SIM.line; ctx.lineWidth = 2;
  const off = (t * 20) % 80;
  for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = -80 + off; y <= H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}
function hud(ctx, tag, right) {
  ctx.strokeStyle = SIM.cyan; ctx.lineWidth = 4;
  const L = 48, m = 40, y0 = 230, y1 = 1430;
  [[m, y0, 1, 1], [W - m, y0, -1, 1], [m, y1, 1, -1], [W - m, y1, -1, -1]].forEach(([x, y, dx, dy]) => {
    ctx.beginPath(); ctx.moveTo(x + dx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * L); ctx.stroke();
  });
  ctx.font = mono(26); ctx.fillStyle = SIM.cyan; ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left"; ctx.fillText(tag, 84, 284);
  ctx.textAlign = "right"; ctx.fillText(right, W - 160, 284);
  ctx.textAlign = "left";
}
function drawCounterSim(ctx, t, p, D) {
  const stages = rows(p.stages), n = Math.max(1, stages.length);
  const intro = 2.2, stageT = (D - intro - 1.2) / n;
  const si = t < intro ? -1 : Math.min(n - 1, Math.floor((t - intro) / stageT));
  const sT = si < 0 ? t : t - intro - si * stageT;
  simBg(ctx, t);
  hud(ctx, "SIM #" + String(p.episode || "001").padStart(3, "0"), clock(t));
  // question
  ctx.fillStyle = SIM.text; ctx.font = grot(68); ctx.textAlign = "left";
  wrap(ctx, p.question, TW).slice(0, 3).forEach((l, i) => ctx.fillText(l, TB.x0, 400 + i * 82));
  // hero counter
  const u = clamp(t / (D - 1.0));
  const v = num(p.start, 0) + (num(p.end, 1e6) - num(p.start, 0)) * Math.pow(u, 2.2);
  const hit = si >= 0 && sT < 0.35;
  const txt = fmt(v);
  const size = fitFont(ctx, txt, mono, 160, TW);
  ctx.font = mono(size); ctx.fillStyle = hit ? SIM.red : SIM.amber;
  ctx.fillText(txt, TB.x0, 820);
  ctx.font = mono(30); ctx.fillStyle = SIM.cyan;
  ctx.fillText(String(p.label || "COUNT").toUpperCase(), TB.x0, 872);
  // stage readout
  if (si >= 0) {
    const k = easeBack(sT / 0.25);
    ctx.save(); ctx.globalAlpha = clamp(sT / 0.15);
    ctx.font = mono(28); ctx.fillStyle = SIM.red;
    ctx.fillText(`STAGE ${si + 1}/${n}`, TB.x0, 1090);
    ctx.font = grot(60); ctx.fillStyle = SIM.text; ctx.translate(TB.x0, 1175 + (1 - k) * 30);
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 12;
    wrap(ctx, stages[si], TW).slice(0, 2).forEach((l, i) => ctx.fillText(l, 0, i * 72));
    ctx.restore();
  } else {
    ctx.font = mono(28); ctx.fillStyle = SIM.green; ctx.fillText("SIMULATION RUNNING…", TB.x0, 1090);
  }
  // progress
  ctx.fillStyle = SIM.line; ctx.fillRect(TB.x0, 1350, TW, 6);
  ctx.fillStyle = SIM.amber; ctx.fillRect(TB.x0, 1350, TW * u, 6);
  if (hit && sT < 1 / 30) { ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(0, 0, W, H); }
}

// ---------- 2. Day timeline (Ran The Sim look) ----------
function drawTimeline(ctx, t, p, D) {
  const items = rows(p.lines).map((l) => { const i = l.indexOf(":"); return i > 0 && i < 24 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ["", l]; });
  const n = Math.max(1, items.length), gap = (D - 2.0 - 1.2) / n;
  simBg(ctx, t); hud(ctx, "SIM #" + String(p.episode || "001").padStart(3, "0"), clock(t));
  ctx.fillStyle = SIM.text; ctx.font = grot(64); ctx.textAlign = "left";
  wrap(ctx, p.question, TW).slice(0, 2).forEach((l, i) => ctx.fillText(l, TB.x0, 390 + i * 78));
  const cur = Math.min(n - 1, Math.floor((t - 0.4) / gap));
  const rowH = 190, top = 600, maxRows = 4;
  const first = Math.max(0, cur - (maxRows - 1));
  ctx.strokeStyle = SIM.line; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(TB.x0 + 14, top - 20); ctx.lineTo(TB.x0 + 14, top + maxRows * rowH - 70); ctx.stroke();
  for (let i = first; i <= cur; i++) {
    if (i < 0) continue;
    const y = top + (i - first) * rowH, age = t - (0.4 + i * gap), k = easeBack(age / 0.3);
    const latest = i === cur;
    ctx.save(); ctx.globalAlpha = (latest ? 1 : 0.45) * clamp(age / 0.15);
    ctx.fillStyle = latest ? SIM.amber : SIM.cyan;
    ctx.beginPath(); ctx.arc(TB.x0 + 14, y + 20, 14 * (0.6 + 0.4 * k), 0, 7); ctx.fill();
    ctx.font = mono(34); ctx.fillText(items[i][0].toUpperCase(), TB.x0 + 56, y + 32);
    ctx.fillStyle = SIM.text; ctx.font = grot(46);
    wrap(ctx, items[i][1], TW - 70).slice(0, 2).forEach((l, j) => ctx.fillText(l, TB.x0 + 56, y + 92 + j * 54));
    ctx.restore();
  }
}

// ---------- 3. POV chat (Side Character look) ----------
function povTag(ctx, text, tilt = -0.05) {
  ctx.save(); ctx.translate(TB.x0, 262); ctx.rotate(tilt);
  ctx.font = anton(52);
  const w = Math.min(TW, ctx.measureText(text).width + 56);
  ctx.fillStyle = MEME.yellow; rrect(ctx, 0, 0, w, 84, 14); ctx.fill();
  ctx.strokeStyle = MEME.ink; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = MEME.ink; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillText(text, 28, 44, TW - 56);
  ctx.restore();
}
function drawPovChat(ctx, t, p, D) {
  const msgs = rows(p.messages).map((l) => /^me\s*:/i.test(l) ? { me: true, text: l.replace(/^me\s*:\s*/i, "") } : { me: false, text: l.replace(/^(them|\w+)\s*:\s*/i, (m, a) => (a.length < 14 ? "" : m)) });
  const n = Math.max(1, msgs.length), gap = (D - 1.0 - 1.4) / n, start = 0.9;
  ctx.fillStyle = MEME.paper; ctx.fillRect(0, 0, W, H);
  // shake on the final punchline
  const lastAt = start + (n - 1) * gap, sh = t >= lastAt + 0.3 && t < lastAt + 0.7 ? (Math.sin(t * 90) * 8) : 0;
  ctx.save(); ctx.translate(sh, 0);
  povTag(ctx, p.pov || "POV: you're the side character");
  // chat header
  ctx.fillStyle = MEME.grey; rrect(ctx, TB.x0, 370, TW, 90, 22); ctx.fill();
  ctx.fillStyle = MEME.pink; ctx.beginPath(); ctx.arc(TB.x0 + 52, 415, 28, 0, 7); ctx.fill();
  ctx.fillStyle = MEME.ink; ctx.font = inter(34, 800); ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillText(p.contact || "Group chat", TB.x0 + 100, 415);
  // layout bubbles
  ctx.font = inter(46, 600);
  const bw = TW * 0.8, lay = [];
  let y = 500;
  msgs.forEach((m, i) => {
    const ls = wrap(ctx, m.text, bw - 56), h = ls.length * 62 + 48;
    lay.push({ m, ls, y, h, at: start + i * gap }); y += h + 30;
  });
  const shown = lay.filter((b) => t >= b.at);
  const bottom = shown.length ? shown[shown.length - 1].y + shown[shown.length - 1].h : 500;
  const scroll = Math.max(0, bottom - (TB.y1 - 70));
  ctx.save(); ctx.beginPath(); ctx.rect(0, 480, W, TB.y1 - 480 + 20); ctx.clip();
  ctx.translate(0, -scroll);
  for (const b of lay) {
    const age = t - b.at;
    if (age < 0) {
      // typing dots for the next received message
      if (!b.m.me && age > -0.8 && lay.indexOf(b) === shown.length) {
        ctx.fillStyle = MEME.grey; rrect(ctx, TB.x0, b.y, 150, 70, 35); ctx.fill();
        ctx.fillStyle = "#9CA3AF";
        for (let d = 0; d < 3; d++) { ctx.beginPath(); ctx.arc(TB.x0 + 42 + d * 34, b.y + 35 - Math.abs(Math.sin(t * 8 + d)) * 8, 9, 0, 7); ctx.fill(); }
      }
      continue;
    }
    const k = easeBack(age / 0.22), bwid = Math.min(bw, Math.max(...b.ls.map((l) => ctx.measureText(l).width)) + 56);
    const x = b.m.me ? TB.x1 - bwid : TB.x0;
    ctx.save(); ctx.translate(x + (b.m.me ? bwid : 0), b.y + b.h); ctx.scale(k, k); ctx.translate(-(x + (b.m.me ? bwid : 0)), -(b.y + b.h));
    ctx.fillStyle = b.m.me ? MEME.blue : MEME.grey; rrect(ctx, x, b.y, bwid, b.h, 30); ctx.fill();
    ctx.fillStyle = b.m.me ? "#fff" : MEME.ink; ctx.font = inter(46, 600); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    b.ls.forEach((l, i) => ctx.fillText(l, x + 28, b.y + 24 + 46 + i * 62 - 6));
    ctx.restore();
  }
  ctx.restore(); ctx.restore();
}

// ---------- 4. Notification stack (Pro, Side Character look) ----------
function drawNotifs(ctx, t, p, D) {
  const items = rows(p.notifs).map((l) => { const i = l.indexOf(":"); return i > 0 && i < 22 ? [l.slice(0, i), l.slice(i + 1).trim()] : ["Messages", l]; });
  const n = Math.max(1, items.length), gap = (D - 1.0 - 1.4) / n;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1f2a5a"); g.addColorStop(1, "#7a2d6b");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  [[200, 500, 300], [850, 1200, 380], [500, 1500, 260]].forEach(([x, y, r], i) => { ctx.beginPath(); ctx.arc(x + Math.sin(t + i) * 30, y + Math.cos(t * .8 + i) * 30, r, 0, 7); ctx.fill(); });
  povTag(ctx, p.pov || "POV: your phone at 3 a.m.");
  ctx.fillStyle = "#fff"; ctx.font = inter(150, 800); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(p.time || "3:07", W / 2, 560);
  const cur = Math.min(n - 1, Math.floor((t - 0.6) / gap));
  const cardH = 150, step = 168, maxCards = Math.floor((TB.y1 - 640) / step);
  const first = Math.max(0, cur - maxCards + 1);
  ctx.textAlign = "left";
  for (let i = first; i <= cur; i++) {
    if (i < 0) continue;
    const age = t - (0.6 + i * gap), k = easeBack(age / 0.28);
    const y = 640 + (i - first) * step, off = (1 - k) * -120;
    ctx.save(); ctx.globalAlpha = clamp(age / 0.12); ctx.translate(0, off);
    ctx.fillStyle = "rgba(245,245,250,.92)"; rrect(ctx, TB.x0, y, TW, cardH, 34); ctx.fill();
    ctx.fillStyle = [MEME.blue, MEME.pink, MEME.red, "#10B981"][i % 4]; rrect(ctx, TB.x0 + 24, y + 28, 64, 64, 16); ctx.fill();
    ctx.fillStyle = "#6B7280"; ctx.font = inter(26, 600); ctx.fillText(items[i][0].toUpperCase(), TB.x0 + 112, y + 50);
    ctx.fillStyle = MEME.ink; ctx.font = inter(36, 600);
    ctx.fillText(wrap(ctx, items[i][1], TW - 150)[0] || "", TB.x0 + 112, y + 104);
    ctx.restore();
  }
}

// ---------- 5. Big caption (Pro, meme-native Anton) ----------
function drawBigCaption(ctx, t, p, D) {
  const lines = rows(p.lines), n = Math.max(1, lines.length), gap = (D - 1.0) / n;
  const i = Math.min(n - 1, Math.floor(t / gap)), age = t - i * gap;
  ctx.fillStyle = MEME.yellow; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(17,17,17,.07)";
  for (let s = -H; s < W + H; s += 140) { ctx.beginPath(); ctx.moveTo(s + t * 40, 0); ctx.lineTo(s + 70 + t * 40, 0); ctx.lineTo(s - H + 70 + t * 40, H); ctx.lineTo(s - H + t * 40, H); ctx.fill(); }
  povTag(ctx, p.pov || "POV: you're the side character");
  const k = easeBack(age / 0.2), sh = age < 0.25 ? Math.sin(age * 120) * 10 * (1 - age / 0.25) : 0;
  ctx.save(); ctx.translate(W / 2 + sh, 640); ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  let size = 110, ls;
  for (; size > 50; size -= 6) { ctx.font = anton(size); ls = wrap(ctx, lines[i].toUpperCase(), TW); if (ls.length <= 4) break; }
  ctx.lineWidth = 12; ctx.strokeStyle = MEME.ink; ctx.fillStyle = "#fff";
  ls.forEach((l, j) => { const yy = (j - (ls.length - 1) / 2) * size * 1.15; ctx.strokeText(l, 0, yy); ctx.fillText(l, 0, yy); });
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
    ctx.font = mono(46); ctx.fillStyle = SIM.amber; ctx.fillText("povmaker.com", W / 2, 790);
    ctx.font = inter(34, 600); ctx.fillStyle = SIM.cyan; ctx.fillText("Make videos like this", W / 2, 870);
  } else {
    tpl.draw(ctx, Math.min(t, D - 1 / 60), params, D);
    // blend the last 0.35s back into frame 0 so the video loops cleanly
    if (!opts.endCard && t > D - 0.35) {
      ctx.globalAlpha = clamp((t - (D - 0.35)) / 0.35); tpl.draw(ctx, 0, params, D); ctx.globalAlpha = 1;
    }
  }
  if (opts.watermark && !(opts.endCard && t >= D)) {
    const label = "made with POVMaker · povmaker.com";
    ctx.font = inter(26, 800); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(label).width + 40;
    ctx.fillStyle = "rgba(10,14,20,.78)"; rrect(ctx, (W - w) / 2, 1380, w, 46, 23); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(label, W / 2, 1404);
  }
  ctx.restore();
  return total;
}
