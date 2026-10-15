import { W, H, loadFonts, drawSafeOverlay } from "./brand.js";
import { TEMPLATES, DEMOS, defaults, renderFrame, set3D, get3D, set3DRes } from "./engine.js";
import { exportMp4, canWebCodecs, bedWav } from "./export.js";
import { renderBed, RATE } from "./audio.js";
import * as Lic from "./licence.js";

const $ = (id) => document.getElementById(id);
const num = (x, d = 0) => { const n = Number(x); return Number.isFinite(n) ? n : d; };
const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
const FREE_PER_DAY = 3, FREE_MAX_S = 20, PRO_MAX_S = 45;
const q = new URLSearchParams(location.search);
// The 3D template is on a preview path until Muse GOes: hidden from the picker unless the link asks for it.
const showPreview = q.get("t") === "whatif-3d" || q.get("demo") === "moon3d" || q.get("preview") === "1";
let g3p = null;
// Lazy-load the three.js scene (~136 KB gzip) only when the 3D template is used. false = no WebGL / load failed.
const ensure3D = () => g3p || (g3p = (async () => {
  try {
    if (get3D() && !get3D().lost) return true;
    const m = await import("./scene3d.bundle.js"); set3D(m.createScene3D()); set3DRes(1280); return true;
  } catch (e) { console.warn("3D unavailable", e); return false; }
})());
const state = { tpl: TEMPLATES[0], demo: null, params: {}, playing: true, safe: false, pro: false, t0: performance.now(), editedOnce: false };

// ---- tracking: none on a static host; UTMs ride along to checkout (see bio page) ----
const track = (name, data) => window.POVTrack && window.POVTrack.track(name, data);

// ---- in-app browser detection (Instagram/Facebook/Threads/TikTok webviews often can't save files) ----
const UA = navigator.userAgent || "";
const inAppName = (() => {
  if (/\bInstagram\b/i.test(UA)) return "instagram";
  if (/FBAN|FBAV/i.test(UA)) return "facebook";
  if (/\bBarcelona\b/i.test(UA)) return "threads";
  if (/musical_ly|ByteLocale|BytedanceWebview/i.test(UA)) return "tiktok";
  return "";
})();
// Feature-detect (don't UA-sniff) whether this webview can actually hand back a saved file.
function canShareFiles() {
  try {
    const f = new File([""], "t.mp4", { type: "video/mp4" });
    return !!(navigator.canShare && navigator.canShare({ files: [f] }));
  } catch { return false; }
}
// Round-trip URL: same template + edited field values, so opening in Safari reopens this exact project.
function projectUrl() {
  const u = new URL(location.href);
  u.searchParams.delete("demo"); u.searchParams.set("t", state.tpl.id);
  Object.keys(state.params).forEach((k) => u.searchParams.set("p_" + k, state.params[k]));
  return u.toString();
}
// The one and only in-app-blocked state: hides the dead Export button (no point showing a primary CTA
// that can't work) and replaces it with the single working action — Copy link, open in Safari.
function showInAppExportBlocked() {
  const msg = $("expmsg");
  if (msg.dataset.blocked) return; // already shown; don't re-render or double-track
  msg.dataset.blocked = "1";
  const btn = $("export");
  // .btn{display:block} in style.css outranks the UA [hidden] rule at equal specificity (author
  // stylesheet beats user-agent stylesheet), so the `hidden` attribute alone wouldn't hide it.
  if (btn) { btn.style.display = "none"; btn.disabled = true; }
  $("prog").hidden = true;
  msg.className = "msg err";
  msg.innerHTML = `<b>This app's browser can't save videos. Open in Safari to export →</b><br>` +
    `<button id="copylinkbtn" class="btn primary" type="button" style="margin-top:8px">Copy link</button><br>` +
    `<span class="muted">Tap ••• (or the menu icon) → Open in browser</span>`;
  const linkBtn = $("copylinkbtn");
  // projectUrl() is read at click time, not here: this banner renders once on load, well before
  // the visitor has edited any field, so the URL has to be built fresh with whatever they've typed so far.
  linkBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(projectUrl()); linkBtn.textContent = "Copied!"; }
    catch { linkBtn.textContent = "Couldn't copy — select the address bar instead"; }
  };
  track("export_blocked_inapp", { ua_app: inAppName });
}
// Which free limit the visitor just hit; upgrade.js reads it so upgrade_click carries `limit` (also on pricing.html).
const setLimit = (l) => { try { sessionStorage.setItem("povmaker.limit", JSON.stringify({ l, t: Date.now() })); } catch {} };
const blocked = (limit, msg, html, extra = {}) => {
  setLimit(limit); msg.className = "msg err"; msg.innerHTML = html;
  track("export_blocked", { limit, template: state.tpl.id, ...extra });
};
document.addEventListener("click", (e) => { // in-message links to /pricing (no checkout yet): count them as the upsell step
  const a = e.target.closest && e.target.closest("a[data-limit]:not([data-checkout])");
  if (a) track("upsell_click", { limit: a.getAttribute("data-limit"), to: "pricing" });
});

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
    ["Exports", FREE_PER_DAY + "/day", "unlimited"], ["Length", "up to " + FREE_MAX_S + " s", "up to " + PRO_MAX_S + " s"], ["Templates", String(TEMPLATES.filter((t) => !t.preview && !t.pro).length), "all " + TEMPLATES.filter((t) => !t.preview).length]]
    .map((r, i) => "<tr>" + r.map((c, j) => (i === 0 ? "<th>" : "<td" + (j === (on ? 2 : 1) ? ' class="on"' : "") + ">") + c + (i === 0 ? "</th>" : "</td>")).join("") + "</tr>").join("");
  $("keymsg").textContent = msg || "";
  $("keymsg").className = "msg" + (msg ? " err" : "");
  buildTemplates();
  updateBar();
}
// Always-visible Pro bar + the preview watermark note (CEO #2941 A). Counts and caps come from the same constants/state the export uses.
const checkoutHref = () => (window.SITE_CONFIG || {}).paymentUrl || "";
function updateBar() {
  const bar = $("probar"), note = $("wmnote"), href = checkoutHref();
  const show = !state.pro && !!href;
  bar.hidden = !show; note.hidden = !show;
  if (!show) return;
  $("pbn").textContent = left() + "/" + FREE_PER_DAY;
  $("probarlink").href = href; $("wmlink").href = href;
  fitBar();
}
// keep the last row of the page (and Export) clear of the fixed bar whatever its height (1-3 lines)
function fitBar() { const b = $("probar"); document.body.style.paddingBottom = b.hidden ? "" : b.getBoundingClientRect().height + 12 + "px"; }
addEventListener("resize", fitBar);
$("probarlink").addEventListener("click", () => track("upgrade_click", { page: "make", checkout: "live", limit: "bar", exports_left: left() }));
$("wmlink").addEventListener("click", () => track("upgrade_click", { page: "make", checkout: "live", limit: "watermark_preview" }));
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

// ---- sound: original synth bed (audio.js). One toggle governs the preview and the export. ----
const sound = () => $("snd").checked;
let actx = null, src = null, bed = null, pq = 0;
function stopPreview() { try { src && src.stop(); } catch {} src = null; }
function startPreview() {
  stopPreview();
  if (!sound() || !state.playing || !gesture) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    actx.resume();
    const key = state.tpl.id + JSON.stringify(state.params);
    if (!bed || bed.key !== key) bed = { key, ...renderBed(state.tpl, state.params, { endCard: false }) };
    const buf = actx.createBuffer(1, bed.samples.length, RATE); buf.copyToChannel(bed.samples, 0);
    src = actx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(actx.destination);
    const D = state.tpl.duration(state.params);
    src.start(0, ((performance.now() - state.t0) / 1000) % D);
  } catch { /* no WebAudio: the export still has sound */ }
}
function queuePreview() { stopPreview(); clearTimeout(pq); pq = setTimeout(startPreview, 450); }
let gesture = false;
addEventListener("pointerdown", () => { if (!gesture) { gesture = true; startPreview(); } }, { capture: true });
addEventListener("keydown", () => { if (!gesture) { gesture = true; startPreview(); } }, { capture: true });
$("snd").checked = localStorage.getItem("povmaker.sound") !== "0";
$("snd").onchange = () => { localStorage.setItem("povmaker.sound", sound() ? "1" : "0"); gesture = true; sound() ? startPreview() : stopPreview(); };

// ---- UI ----
function buildTemplates() {
  const sel = $("tpl"), cur = state.tpl.id;
  sel.innerHTML = "";
  TEMPLATES.filter((t) => !t.preview || showPreview).forEach((t) => {
    const o = document.createElement("option"); o.value = t.id;
    o.textContent = t.name + (t.pro && !state.pro ? " (Pro)" : ""); sel.appendChild(o);
  });
  sel.value = cur;
}
// p_<key>=<value> round-tripped from the in-app-blocked interstitial (see projectUrl); applied once, to the template it was saved for.
let pOverrides = (() => {
  const o = {}; for (const [k, v] of q.entries()) if (k.startsWith("p_")) o[k.slice(2)] = v;
  return Object.keys(o).length ? o : null;
})();
function buildFields() {
  const f = $("fields"); f.innerHTML = ""; $("blurb").textContent = state.tpl.blurb;
  const fromUrl = pOverrides && q.get("t") === state.tpl.id ? pOverrides : null;
  state.params = { ...defaults(state.tpl), ...(state.demo && state.demo.t === state.tpl.id ? state.demo.p : {}), ...fromUrl };
  if (fromUrl) pOverrides = null; // only replay once, so switching templates afterwards doesn't re-apply stale values
  state.tpl.fields.forEach((fd) => {
    const l = document.createElement("label"); l.textContent = fd.label; l.htmlFor = "f-" + fd.key; f.appendChild(l);
    const el = document.createElement(fd.type === "textarea" ? "textarea" : fd.type === "select" ? "select" : "input");
    if (fd.type === "select") fd.options.forEach(([v, n]) => { const o = document.createElement("option"); o.value = v; o.textContent = n; el.appendChild(o); });
    el.id = "f-" + fd.key; el.value = state.params[fd.key]; if (fd.type === "number") el.inputMode = "numeric";
    el.oninput = () => {
      state.params[fd.key] = el.value; state.t0 = performance.now(); queuePreview();
      if (!state.editedOnce) { state.editedOnce = true; track("first_edit", { template: state.tpl.id }); }
    };
    f.appendChild(el);
  });
  document.documentElement.dataset.brand = state.tpl.brand;
  state.t0 = performance.now();
}
$("tpl").onchange = (e) => { state.tpl = TEMPLATES.find((t) => t.id === e.target.value); state.demo = null; buildFields(); queuePreview(); track("template_select", { template: state.tpl.id }); if (state.tpl.id === "whatif-3d") ensure3D(); };
$("play").onclick = () => { state.playing = !state.playing; $("play").textContent = state.playing ? "Pause" : "Play"; state.t0 = performance.now() - (state.frozen || 0); startPreview(); };
$("safe").onchange = (e) => { state.safe = e.target.checked; };

const cv = $("cv"), ctx = cv.getContext("2d");
function tick(now) {
  const D = state.tpl.duration(state.params);
  const t = state.playing ? ((now - state.t0) / 1000) % D : state.frozen ?? 0;
  if (state.playing) state.frozen = t;
  renderFrame(ctx, state.tpl, state.params, t, { watermark: !state.pro });
  const len = $("len"), over = !state.pro && D > FREE_MAX_S + 1e-6;
  const txt = `Length ${D.toFixed(1)} s · ${state.pro ? "Pro max " + PRO_MAX_S + " s" : "free exports " + FREE_MAX_S + " s, Pro up to " + PRO_MAX_S + " s"}`;
  if (len.textContent !== txt) len.textContent = txt;
  // CEO #4609: the value gap, honest and visible BEFORE export — where the free clip actually cuts off.
  const fc = $("freecap");
  if (over) {
    const unit = String(state.params.unit || "").trim();
    const vEndNum = num(state.params.end, 0), vEnd = fmtInt(vEndNum);
    const v20 = state.tpl.valueAt ? state.tpl.valueAt(state.params, D, FREE_MAX_S) : null;
    const verb = v20 !== null && vEndNum < v20 ? "drop" : "climb"; // oxygen-style demos count DOWN, not up
    const fcTxt = v20 !== null
      ? `Free export ends here: T+${FREE_MAX_S} s, ${fmtInt(v20)} ${unit}. Pro: the full ${verb} to ${vEnd} ${unit}.`
      : `Free exports stop at ${FREE_MAX_S} s (this one runs ${D.toFixed(1)} s) — Pro exports the rest, up to ${PRO_MAX_S} s.`;
    if (fc.textContent !== fcTxt) fc.textContent = fcTxt;
    fc.hidden = false;
  } else fc.hidden = true;
  if (state.safe) drawSafeOverlay(ctx);
  requestAnimationFrame(tick);
}

$("export").onclick = async () => {
  const msg = $("expmsg"), prog = $("prog");
  msg.className = "msg";
  track("export_start", { template: state.tpl.id, ua: inAppName || "browser" });
  if (inAppName && !canShareFiles()) { showInAppExportBlocked(); return; }
  if (state.tpl.pro && !state.pro) { blocked("template_locked", msg, 'This template is Pro. <a data-limit="template_locked" href="../pricing.html">See pricing</a> or enter your licence key.'); return; }
  const D = state.tpl.duration(state.params);
  // CEO #4609: free no longer blocks a long template — it exports the first FREE_MAX_S s of the real arc
  // (the value-gap marker above already told the visitor where it cuts off, before they clicked Export).
  const truncated = !state.pro && D > FREE_MAX_S + 1e-6;
  if (!state.pro && left() === 0) { blocked("daily_cap", msg, `You've used today's ${FREE_PER_DAY} free exports. <a data-limit="daily_cap" href="../pricing.html">Go Pro</a> for unlimited.`); return; }
  $("export").disabled = true; prog.hidden = false; prog.value = 0; msg.textContent = "Rendering…";
  let use = state.tpl, par = state.params, fell = false;
  // 3D template: if WebGL/the scene module isn't available (or the context is lost) export the 2D What If Sim with the same words.
  const to2D = () => {
    const sim = TEMPLATES.find((t) => t.id === "whatif-sim"), p = state.params; fell = true; use = sim;
    par = { ...defaults(sim), premise: String(p.premise || "").replace(/^\s*what if\s+/i, ""), label: p.label, unit: p.unit, start: p.start, end: p.end, rate: p.rate,
      tag: "", rule: p.rule, stages: p.stages };
  };
  try {
    if (use.id === "whatif-3d") { if (!(await ensure3D()) || get3D().lost) to2D(); else set3DRes(state.pro ? 1920 : 1280); }
    const doExport = () => exportMp4({ tpl: use, params: par, fps: state.pro ? 60 : 30, watermark: !state.pro, endCard: !state.pro, audio: sound(), maxDuration: truncated ? FREE_MAX_S : undefined, onProgress: (p) => (prog.value = p) });
    let blob = await doExport();
    if (use.id === "whatif-3d" && get3D() && get3D().lost) { to2D(); msg.textContent = "Rendering the 2D look…"; blob = await doExport(); }
    const url = URL.createObjectURL(blob);
    const wantSound = sound(), noAudio = wantSound && !blob.hasAudio;
    const wav = noAudio ? URL.createObjectURL(bedWav(use, par, { endCard: !state.pro, maxDuration: truncated ? FREE_MAX_S : undefined })) : "";
    const filename = `povmaker-${use.id}.mp4`;
    const file = new File([blob], filename, { type: blob.type || "video/mp4" });
    let canShareFile = false;
    try { canShareFile = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch { canShareFile = false; }
    // CEO #4609: the upsell card sells the PAYOFF (the ending the free clip doesn't reach), and sits
    // above Save/share — it's the first thing seen after a truncated export, not an afterthought below it.
    let upsellHtml = "";
    if (!state.pro) {
      const nT = TEMPLATES.filter((t) => !t.preview).length;
      upsellHtml = truncated
        ? `<div class="box upsell" style="margin-bottom:12px"><b>Your clip stops at ${FREE_MAX_S} s. Want the ending?</b><p style="margin:0"><a class="btn primary inline" data-checkout data-limit="after_export" data-variant="payoff1" data-label="Get the full video · ${(window.SITE_CONFIG || {}).priceLabel || "$9/mo"}" href="../pricing.html">Get the full video</a></p><p class="muted" style="margin:6px 0 0">Pro: up to ${PRO_MAX_S} s · no watermark · 60 fps · cancel anytime · 14-day refund</p></div>`
        : `<div class="box upsell" style="margin-bottom:12px"><b>Want this without the watermark?</b><p class="muted" style="margin:6px 0">Pro: no watermark or end card · up to ${PRO_MAX_S} s · 60 fps · unlimited exports · ${nT} templates</p><p style="margin:0"><a class="btn primary inline" data-checkout data-limit="after_export" data-variant="watermark1" href="../pricing.html">Go Pro</a> <span class="muted">14-day refund, cancel any time</span></p></div>`;
    }
    $("out").innerHTML = upsellHtml + `<video src="${url}" controls loop playsinline></video><p>` +
      (canShareFile ? `<button id="sharebtn" class="btn primary" type="button">Save / share video</button>` : `<a class="btn primary" download="${filename}" href="${url}">Download MP4</a>`) +
      `</p>` +
      (noAudio ? `<p class="muted">This browser can't put sound inside the MP4. <a download="povmaker-${use.id}.wav" href="${wav}">Download the sound (WAV)</a> and add it when you post (Instagram, TikTok and CapCut all take your own audio), or export on desktop Chrome / Safari 26 for a video with sound.</p>` : "");
    if (!state.pro) {
      const a = $("out").querySelector(".upsell a[data-checkout]");
      if (a) window.POVUpgrade && window.POVUpgrade.bind(a);
      track("upsell_view", { where: "after_export", variant: truncated ? "payoff1" : "watermark1", template: state.tpl.id });
    }
    if (canShareFile) {
      $("sharebtn").onclick = async () => {
        try { await navigator.share({ files: [file], title: "POVMaker video" }); }
        catch (e) {
          if (e && e.name === "AbortError") return; // user cancelled the share sheet, not an error
          track("export_error", { msg: "share_failed: " + (e && e.message || e), ua: inAppName || "browser" });
          const a = document.createElement("a"); a.className = "btn primary"; a.download = filename; a.href = url; a.textContent = "Download MP4";
          $("sharebtn").replaceWith(a);
          if (inAppName) {
            const hint = document.createElement("p"); hint.className = "muted"; hint.style.marginTop = "6px";
            hint.textContent = "If that didn't save, tap ••• (or the menu icon) → Open in browser, then export again.";
            a.insertAdjacentElement("afterend", hint);
          }
        }
      };
    }
    if (!state.pro) { bump(); setPro(false); setLimit(truncated ? "payoff" : "watermark"); }
    msg.className = "msg ok";
    msg.textContent = "Done. Post it with the AI-generated label on." + (truncated ? ` This clip stops at ${FREE_MAX_S} s — Pro exports the full climb.` : "") + (sound() && !blob.hasAudio ? " The video has no sound in this browser, but the sound is available below." : "") + (fell ? " 3D isn't available in this browser, so this export uses the 2D What If look." : "");
    track("export_done", { template: state.tpl.id, rendered: use.id, pro: state.pro ? 1 : 0, secs: Math.round(truncated ? FREE_MAX_S : D), truncated: truncated ? 1 : 0, audio: blob.hasAudio ? 1 : 0, demo: state.demo ? q.get("demo") : "" });
  } catch (e) {
    msg.className = "msg err"; msg.textContent = e.message || "Export failed.";
    track("export_error", { msg: String((e && e.message) || e).slice(0, 200), ua: inAppName || "browser", template: use.id });
  }
  finally { $("export").disabled = false; prog.hidden = true; if (get3D()) set3DRes(1280); }
};

await loadFonts();
if (!canWebCodecs()) { $("expmsg").className = "msg err"; $("expmsg").textContent = "Heads up: this browser can't export video. Use Chrome, Edge or Safari 16.4+."; }
const ALIAS = { "counter-sim": "whatif-sim" };
// Remix link: ?demo=<slug> preloads that demo's template + copy; wins over ?t= if they disagree. Unknown slug = ignored.
const demoSlug = (q.get("demo") || "").toLowerCase();
// `hold: true` = built but not yet GO'd by Muse: only reachable on localhost (the export harness), never on the live site.
const demoOk = (d) => d && (!d.hold || ["localhost", "127.0.0.1"].includes(location.hostname));
state.demo = Object.prototype.hasOwnProperty.call(DEMOS, demoSlug) && demoOk(DEMOS[demoSlug]) ? DEMOS[demoSlug] : null;
const initial = TEMPLATES.find((t) => t.id === (state.demo ? state.demo.t : ALIAS[q.get("t")] || q.get("t")));
if (initial) { state.tpl = initial; }
buildTemplates(); buildFields(); checkLicence();
if (state.tpl.id === "whatif-3d") ensure3D();
requestAnimationFrame(tick);
track("visit_make", { template: state.tpl.id, demo: state.demo ? demoSlug : "", source: (JSON.parse(localStorage.getItem("utm") || "{}").utm_source) || "direct" });
if (inAppName) { track("inapp", { app: inAppName }); if (!canShareFiles()) showInAppExportBlocked(); }
