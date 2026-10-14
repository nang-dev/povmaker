// POVMaker sound: an ORIGINAL synthesised bed per template, rendered offline in plain JS (no samples, no network, deterministic).
// Cue times come from engine.js (tpl.cues), so the sound can never drift from the picture.
//   renderBed(tpl, params, { endCard }) -> { samples: Float32Array (mono), rate, seconds, lufs }
// Mixed to about -14 LUFS (BS.1770 gated, stereo-duplicated like the export) with a soft limiter, sample peak <= -6 dBFS.
export const RATE = 48000;
const TAU = Math.PI * 2;

function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz

class Mix {
  constructor(secs) { this.n = Math.ceil(secs * RATE); this.d = new Float32Array(this.n); this.noise = rng(7); }
  // generic voice: fn(tt, i) -> sample for tt seconds after t0 (len seconds), summed in with gain
  voice(t0, len, gain, fn) {
    const s = Math.max(0, Math.round(t0 * RATE)), e = Math.min(this.n, Math.round((t0 + len) * RATE));
    for (let i = s; i < e; i++) this.d[i] += gain * fn((i - s) / RATE, i - s);
  }
  // sine sweep from f0 to f1 (exponential) with exponential decay; phase-accumulated so sweeps don't zipper
  sweep(t0, len, f0, f1, gain, decay, { tri = 0, atk = 0.002 } = {}) {
    let ph = 0;
    this.voice(t0, len, gain, (tt) => {
      const f = f0 * Math.pow(f1 / f0, clamp(tt / len));
      ph += (TAU * f) / RATE;
      const a = Math.min(1, tt / atk) * Math.exp(-tt * decay);
      return a * (Math.sin(ph) + tri * 0.3 * Math.sin(ph * 2));
    });
  }
  // noise through a state-variable filter whose cutoff sweeps f0 -> f1; mode "bp" | "lp" | "hp"; env(tt/len) shapes level
  noiseSweep(t0, len, f0, f1, gain, env, mode = "bp", q = 0.35) {
    let low = 0, band = 0;
    this.voice(t0, len, gain, (tt) => {
      const fc = f0 * Math.pow(f1 / f0, clamp(tt / len)), f = 2 * Math.sin((Math.PI * Math.min(fc, 12000)) / RATE);
      const x = this.noise(), high = x - low - q * band;
      band += f * high; low += f * band;
      return env(tt / len) * (mode === "lp" ? low : mode === "hp" ? high : band) * 2.2;
    });
  }
  // ---- instruments ----
  kick(t, g = 0.7, f = 52) { this.sweep(t, 0.4, f * 2.2, f * 0.9, g, 9, { atk: 0.001 }); }
  pulse(t, g = 0.5) { this.sweep(t, 0.3, 120, 46, g, 11, { atk: 0.002 }); }
  tick(t, f = 1900, g = 0.05) { this.sweep(t, 0.03, f, f * 1.05, g, 80, { atk: 0.0005 }); }
  blip(t, f = 880, g = 0.2) { this.sweep(t, 0.16, f, f * 1.5, g, 17, { tri: 1 }); }
  pop(t, f = 700, g = 0.4) {
    this.sweep(t, 0.16, f * 1.7, f, g, 22, { atk: 0.0008 });
    this.noiseSweep(t, 0.012, 5000, 3000, g * 0.35, (k) => 1 - k, "hp");
  }
  hat(t, g = 0.05) { this.noiseSweep(t, 0.05, 7500, 7500, g, (k) => Math.pow(1 - k, 3), "hp", 0.5); }
  bell(t, f = 880, g = 0.3) {
    this.voice(t, 1.1, g, (tt) => {
      const idx = 2.6 * Math.exp(-tt * 7);
      return Math.exp(-tt * 5.5) * Math.sin(TAU * f * tt + idx * Math.sin(TAU * f * 3.5 * tt));
    });
  }
  buzz(t, g = 0.18) { this.voice(t, 0.07, g, (tt) => Math.sign(Math.sin(TAU * 140 * tt)) * 0.5 * Math.sin(Math.PI * tt / 0.07)); }
  whoosh(t0, t1, g = 0.35, tail = 0.18) { // rising band-passed noise that peaks at t1 and falls away
    const len = t1 - t0 + tail, k1 = (t1 - t0) / len;
    this.noiseSweep(t0, len, 350, 7000, g, (k) => (k < k1 ? Math.pow(k / k1, 2) : Math.pow(1 - (k - k1) / (1 - k1), 2)), "bp", 0.45);
  }
  riser(t0, t1, g = 0.3) { // tone climbs under the noise whoosh
    const len = t1 - t0;
    this.sweep(t0, len, 110, 880, g * 0.9, 0, { tri: 1, atk: 0.05 });
    this.whoosh(t0, t1, g, 0.12);
  }
  boom(t, g = 0.9) { // sub impact + noise burst
    this.sweep(t, 1.0, 90, 36, g, 4.2, { atk: 0.001 });
    this.noiseSweep(t, 0.3, 4000, 300, g * 0.6, (k) => Math.pow(1 - k, 2.2), "lp", 0.6);
  }
  slam(t, g = 0.9) { // punchy meme hit: kick + snare-ish noise
    this.kick(t, g, 58);
    this.noiseSweep(t, 0.16, 2400, 1800, g * 0.5, (k) => Math.pow(1 - k, 2.5), "bp", 0.5);
  }
  pad(t0, t1, notes, g = 0.1, fade = 0.5) { // soft detuned sine pad with a slow swell
    const len = t1 - t0, det = [0.997, 1.003];
    this.voice(t0, len, g, (tt) => {
      const env = Math.min(1, tt / fade, (len - tt) / fade) * (0.8 + 0.2 * Math.sin(TAU * 0.25 * tt));
      let s = 0;
      for (const n of notes) { const f = hz(n); for (const d of det) s += Math.sin(TAU * f * d * tt); }
      return (env * s) / (notes.length * 2) * 2;
    });
  }
  drone(t0, t1, lvl, f = 55) { // sub drone; lvl(k) 0..1 over the span
    const len = t1 - t0;
    this.voice(t0, len, 1, (tt) => lvl(tt / len) * (0.7 * Math.sin(TAU * f * tt) + 0.3 * Math.sin(TAU * f * 1.5 * tt)) * Math.min(1, tt / 0.1));
  }
}

// ---- loudness (ITU-R BS.1770-4, 48 kHz K-weighting, 400 ms blocks / 75 % overlap, -70 abs + -10 rel gates) ----
function kweight(x) {
  const biq = (b, a) => { let z1 = 0, z2 = 0; return (v) => { const y = b[0] * v + z1; z1 = b[1] * v - a[1] * y + z2; z2 = b[2] * v - a[2] * y; return y; }; };
  const s1 = biq([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
  const s2 = biq([1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = s2(s1(x[i]));
  return y;
}
export function lufs(x, channels = 2) {
  const y = kweight(x), blk = Math.round(0.4 * RATE), hop = Math.round(0.1 * RATE);
  const c = new Float64Array(y.length + 1);
  for (let i = 0; i < y.length; i++) c[i + 1] = c[i] + y[i] * y[i];
  const z = [];
  for (let s = 0; s + blk <= y.length; s += hop) z.push(((c[s + blk] - c[s]) / blk) * channels);
  const L = (m) => -0.691 + 10 * Math.log10(m);
  const abs = z.filter((m) => L(m) > -70);
  if (!abs.length) return -70;
  const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const g = abs.filter((m) => L(m) > rel);
  return g.length ? L(g.reduce((a, b) => a + b, 0) / g.length) : -70;
}
function master(d, secs, target = -14, peak = 0.5) { // peak 0.5 = -6 dBFS sample peak: Safari's AAC encoder overshoots by ~4 dB, so the MP4 stays <= ~-1.5 dBTP
  const fade = Math.round(0.25 * RATE);
  for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;       // never click at the end
  for (let i = 0; i < Math.round(0.004 * RATE); i++) d[i] *= i / Math.round(0.004 * RATE);
  const lim = (v, g) => { const x = v * g; const a = Math.abs(x); return a < peak * 0.7 ? x : Math.sign(x) * (peak * 0.7 + (peak - peak * 0.7) * Math.tanh((a - peak * 0.7) / (peak - peak * 0.7))); };
  let g = 1, out = new Float32Array(d.length);
  for (let it = 0; it < 6; it++) {
    for (let i = 0; i < d.length; i++) out[i] = lim(d[i], g);
    const l = lufs(out);
    if (Math.abs(l - target) < 0.25) break;
    g *= Math.pow(10, (target - l) / 20);
  }
  return { out, lufs: lufs(out) };
}

// ---- the beds ----
const BEDS = {
  "whatif-sim"(m, cues, D, endCard) {
    const hold = cues.find((c) => c.k === "exit")?.t ?? 3, stages = cues.filter((c) => c.k === "stage"), last = stages[stages.length - 1];
    m.drone(0, D, (k) => 0.14 + 0.36 * k);
    // heartbeat that speeds up as the run escalates (0.5 s -> 0.26 s)
    for (let t = 0; t < D - 0.8; ) { m.pulse(t, 0.5 + 0.2 * (t / D)); t += 0.5 - 0.24 * (t / D); }
    for (let t = 0.25; t < D - 0.9; t += 0.22) m.tick(t, 1500 + 900 * (t / D), 0.035);
    m.riser(0.05, hold - 0.02, 0.28); m.boom(hold, 0.75);
    stages.forEach((s, i) => {
      m.blip(s.t + 0.03, 520 * Math.pow(1.12, i), 0.22);
      if (s !== last) { m.pulse(s.t, 0.7); }
    });
    const hit = cues.find((c) => c.k === "hit")?.t ?? last?.t; // contact = the payoff
    if (last && hit != null) { const r0 = Math.max(hold + 0.6, hit - 1.4); m.riser(r0, hit - 0.02, 0.34); m.boom(hit, 1.0); m.pad(hit, D + (endCard ? 1.3 : 0.3), [45, 52, 57, 64], 0.2, 0.3); }
  },
  "pov-chat"(m, cues, D, endCard) {
    const msgs = cues.filter((c) => c.k === "send" || c.k === "recv"), end = D + (endCard ? 1.4 : 0.3);
    m.pad(0, end, [48, 55, 59, 64], 0.2, 0.7);       // C3 G3 B3 E4 : warm, a little wistful
    m.pad(0, end, [60, 67, 71, 76], 0.07, 0.7);
    for (let t = 0.2, i = 0; t < D; t += 0.425, i++) { m.hat(t + 0.2125, 0.045); if (i % 2 === 0) m.kick(t, 0.22, 48); }
    msgs.forEach((c, i) => {
      if (c.k === "recv") m.pop(c.t, 520 + (i % 3) * 70, 0.5);
      else { m.pop(c.t, 880, 0.42); m.noiseSweep(c.t, 0.18, 1800, 5200, 0.1, (k) => Math.sin(Math.PI * k), "bp", 0.5); }
    });
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg) { // the punch: whoosh up into it, thump on the phone shake
      m.whoosh(lastMsg.t - 0.45, lastMsg.t, 0.5, 0.2);
      m.boom(lastMsg.t, 0.55);
      m.slam(lastMsg.t + 0.3, 0.35);
    }
  },
  "day-timeline"(m, cues, D, endCard) {
    const items = cues.filter((c) => c.k === "pop"), end = D + (endCard ? 1.4 : 0.3);
    m.drone(0, D, (k) => 0.12 + 0.3 * k, 55);
    m.pad(0, end, [45, 52, 57, 60], 0.17, 0.7);
    for (let t = 0; t < D - 0.5; t += 1) m.pulse(t, 0.35);
    items.forEach((c, i) => {
      m.pop(c.t, 480 * Math.pow(1.08, i), 0.45); m.pulse(c.t, 0.4);
      if (i === items.length - 1) { m.riser(Math.max(0, c.t - 1.1), c.t, 0.3); m.boom(c.t, 0.8); }
    });
  },
  "notif-stack"(m, cues, D, endCard) {
    const items = cues.filter((c) => c.k === "ding"), end = D + (endCard ? 1.4 : 0.3);
    m.drone(0, D, (k) => 0.2 + 0.4 * k, 49);
    m.pad(0, end, [41, 48, 53, 58], 0.14, 0.6);
    items.forEach((c, i) => {
      m.buzz(c.t - 0.12); m.buzz(c.t - 0.04);
      m.bell(c.t, [880, 1046.5, 784, 988][i % 4], 0.3);
      if (i === items.length - 1) { m.riser(Math.max(0, c.t - 0.9), c.t, 0.3); m.boom(c.t, 0.6); }
    });
  },
  "big-caption"(m, cues, D, endCard) {
    const items = cues.filter((c) => c.k === "slam"), end = D + (endCard ? 1.4 : 0.3);
    m.drone(0, D, (k) => 0.15 + 0.25 * k, 58);
    m.pad(0, end, [46, 53, 58], 0.08, 0.5);
    for (let t = 0, i = 0; t < D - 0.4; t += 0.375, i++) { m.hat(t + 0.1875, 0.05); if (i % 2 === 0) m.kick(t, 0.28, 54); }
    items.forEach((c, i) => {
      m.slam(c.t, 0.8);
      if (i === items.length - 1) { m.riser(Math.max(0, c.t - 0.8), c.t, 0.3); m.boom(c.t, 0.5); }
    });
  },
};

export function renderBed(tpl, params, { endCard = false } = {}) {
  const D = tpl.duration(params), secs = D + (endCard ? 1.5 : 0);
  const m = new Mix(secs);
  (BEDS[tpl.id] || BEDS["day-timeline"])(m, tpl.cues ? tpl.cues(params, D) : [], D, endCard);
  const { out, lufs: l } = master(m.d, secs);
  return { samples: out, rate: RATE, seconds: secs, lufs: l };
}
