import { W, H, loadFonts, drawSafeOverlay } from "./brand.js";
import { TEMPLATES, defaults, renderFrame } from "./engine.js";
import { exportMp4, canWebCodecs } from "./export.js";
import * as Lic from "./licence.js";

const $ = (id) => document.getElementById(id);
const FREE_PER_DAY = 3, FREE_MAX_S = 20, PRO_MAX_S = 45;
const q = new URLSearchParams(location.search);
const state = { tpl: TEMPLATES[0], params: {}, playing: true, safe: false, pro: false, t0: performance.now() };

// ---- tracking: none on a static host; UTMs ride along to checkout (see bio page) ----
const track = (name, data) => window.POVTrack && window.POVTrack.track(name, data);

// ---- licence (logic in licence.js; shared with thanks.html) ----
async function checkLicence() {
  const l = Lic.stored();
  if (!l) return setPro(false);
  const fresh = Date.now() - l.checked < 24 * 3600e3;
  if (fresh) return setPro(true);
  try {
    const r = await Lic.check({ key: l.key, instance_id: l.instance_id });
    if (r.valid) { Lic.store({ ...l, checked: Date.now() }); setPro(true); }
    else { Lic.clear(); setPro(false, "Your Pro licence is no longer active."); }
  } catch { setPro(Date.now() - l.checked < 7 * 24 * 3600e3); } // offline grace: 7 days
}
function setPro(on, msg) {
  state.pro = on;
  $("plan").innerHTML = on ? "<b>Pro</b> · no watermark, unlimited exports, 60 fps" : `<b>Free</b> · watermark + end card · ${left()} of ${FREE_PER_DAY} exports left today`;
  $("cmp").innerHTML = [["", "Free", "Pro"], ["Watermark + end card", "yes", "no"], ["Frame rate", "30 fps", "60 fps"],
    ["Exports", FREE_PER_DAY + "/day", "unlimited"], ["Length", "up to " + FREE_MAX_S + " s", "up to " + PRO_MAX_S + " s"], ["Templates", "3", "all 5"]]
    .map((r, i) => "<tr>" + r.map((c, j) => (i === 0 ? "<th>" : "<td" + (j === (on ? 2 : 1) ? ' class="on"' : "") + ">") + c + (i === 0 ? "</th>" : "</td>")).join("") + "</tr>").join("");
  $("keymsg").textContent = msg || "";
  $("keymsg").className = "msg" + (msg ? " err" : "");
  buildTemplates();
}
$("activate").onclick = async () => {
  const key = $("key").value.trim(); if (!key) return;
  $("keymsg").className = "msg"; $("keymsg").textContent = "Checking…";
  const r = await Lic.activate(key);
  if (r.ok) { setPro(true); $("keymsg").className = "msg ok"; $("keymsg").textContent = "Pro activated. Thank you!"; $("key").value = ""; }
  else { $("keymsg").className = "msg err"; $("keymsg").textContent = r.error; }
};

// ---- free quota ----
const today = () => new Date().toISOString().slice(0, 10);
const used = () => { try { const o = JSON.parse(localStorage.getItem("povmaker.exports") || "{}"); return o.d === today() ? o.n : 0; } catch { return 0; } };
const left = () => Math.max(0, FREE_PER_DAY - used());
const bump = () => localStorage.setItem("povmaker.exports", JSON.stringify({ d: today(), n: used() + 1 }));

// ---- UI ----
function buildTemplates() {
  const sel = $("tpl"), cur = state.tpl.id;
  sel.innerHTML = "";
  TEMPLATES.forEach((t) => {
    const o = document.createElement("option"); o.value = t.id;
    o.textContent = t.name + (t.pro && !state.pro ? " (Pro)" : ""); sel.appendChild(o);
  });
  sel.value = cur;
}
function buildFields() {
  const f = $("fields"); f.innerHTML = ""; $("blurb").textContent = state.tpl.blurb;
  state.params = defaults(state.tpl);
  state.tpl.fields.forEach((fd) => {
    const l = document.createElement("label"); l.textContent = fd.label; l.htmlFor = "f-" + fd.key; f.appendChild(l);
    const el = document.createElement(fd.type === "textarea" ? "textarea" : fd.type === "select" ? "select" : "input");
    if (fd.type === "select") fd.options.forEach(([v, n]) => { const o = document.createElement("option"); o.value = v; o.textContent = n; el.appendChild(o); });
    el.id = "f-" + fd.key; el.value = fd.def; if (fd.type === "number") el.inputMode = "numeric";
    el.oninput = () => { state.params[fd.key] = el.value; state.t0 = performance.now(); };
    f.appendChild(el);
  });
  document.documentElement.dataset.brand = state.tpl.brand;
  state.t0 = performance.now();
}
$("tpl").onchange = (e) => { state.tpl = TEMPLATES.find((t) => t.id === e.target.value); buildFields(); track("template_select", { template: state.tpl.id }); };
$("play").onclick = () => { state.playing = !state.playing; $("play").textContent = state.playing ? "Pause" : "Play"; state.t0 = performance.now() - (state.frozen || 0); };
$("safe").onchange = (e) => { state.safe = e.target.checked; };

const cv = $("cv"), ctx = cv.getContext("2d");
function tick(now) {
  const D = state.tpl.duration(state.params);
  const t = state.playing ? ((now - state.t0) / 1000) % D : state.frozen ?? 0;
  if (state.playing) state.frozen = t;
  renderFrame(ctx, state.tpl, state.params, t, { watermark: !state.pro });
  const len = $("len"), over = !state.pro && D > FREE_MAX_S + 1e-6;
  const txt = `Length ${D.toFixed(1)} s · ${state.pro ? "Pro max " + PRO_MAX_S : "free max " + FREE_MAX_S} s` + (over ? " · too long for free" : "");
  if (len.textContent !== txt) { len.textContent = txt; len.style.color = over ? "var(--err, #ff6b6b)" : ""; }
  if (state.safe) drawSafeOverlay(ctx);
  requestAnimationFrame(tick);
}

$("export").onclick = async () => {
  const msg = $("expmsg"), prog = $("prog");
  msg.className = "msg";
  if (state.tpl.pro && !state.pro) { msg.className = "msg err"; msg.innerHTML = 'This template is Pro. <a href="../pricing.html">See pricing</a> or enter your licence key.'; return; }
  const D = state.tpl.duration(state.params);
  if (!state.pro && D > FREE_MAX_S + 1e-6) { msg.className = "msg err"; msg.innerHTML = `Free exports are limited to ${FREE_MAX_S} s (this one is ${D.toFixed(1)} s). Remove a beat, or <a href="../pricing.html">go Pro</a> for up to ${PRO_MAX_S} s.`; return; }
  if (!state.pro && left() === 0) { msg.className = "msg err"; msg.innerHTML = "You've used today's 3 free exports. <a href=\"../pricing.html\">Go Pro</a> for unlimited."; return; }
  $("export").disabled = true; prog.hidden = false; prog.value = 0; msg.textContent = "Rendering…";
  try {
    const blob = await exportMp4({ tpl: state.tpl, params: state.params, fps: state.pro ? 60 : 30, watermark: !state.pro, endCard: !state.pro, onProgress: (p) => (prog.value = p) });
    const url = URL.createObjectURL(blob);
    $("out").innerHTML = `<video src="${url}" controls loop playsinline></video><p><a class="btn primary" download="povmaker-${state.tpl.id}.mp4" href="${url}">Download MP4</a></p>`;
    if (!state.pro) { bump(); setPro(false); }
    msg.className = "msg ok"; msg.textContent = "Done. Post it with the AI-generated label on.";
    track("export_done", { template: state.tpl.id, pro: state.pro ? 1 : 0, secs: Math.round(D) });
  } catch (e) { msg.className = "msg err"; msg.textContent = e.message || "Export failed."; }
  finally { $("export").disabled = false; prog.hidden = true; }
};

await loadFonts();
if (!canWebCodecs()) { $("expmsg").className = "msg err"; $("expmsg").textContent = "Heads up: this browser can't export video. Use Chrome, Edge or Safari 16.4+."; }
const ALIAS = { "counter-sim": "whatif-sim" };
const initial = TEMPLATES.find((t) => t.id === (ALIAS[q.get("t")] || q.get("t")));
if (initial) { state.tpl = initial; }
buildTemplates(); buildFields(); checkLicence();
requestAnimationFrame(tick);
track("visit_make", { template: state.tpl.id, source: (JSON.parse(localStorage.getItem("utm") || "{}").utm_source) || "direct" });
