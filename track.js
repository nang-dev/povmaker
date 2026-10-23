// Funnel events with no backend. window.POVTrack.track(name, data). Provider script loads only when
// SITE_CONFIG.analytics.websiteId is set. Events queue until the provider is ready; a local ring buffer
// (localStorage "povmaker.events") is kept for debugging: JSON.parse(localStorage["povmaker.events"]).
(function () {
  var C = (window.SITE_CONFIG || {}).analytics || {};
  function local(name, data) {
    try {
      var a = JSON.parse(localStorage.getItem("povmaker.events") || "[]");
      a.push({ t: Date.now(), e: name, d: data || {} });
      localStorage.setItem("povmaker.events", JSON.stringify(a.slice(-50)));
    } catch (e) {}
  }
  // First-touch attribution (survives page changes, so events on /make/ still say where the visitor came from).
  // The Umami pageview reads utm_* from the URL on its own; custom events don't, so every event carries ft_*.
  var FT = (function () {
    var k = "povmaker.ft", s = null;
    try { s = JSON.parse(localStorage.getItem(k) || "null"); } catch (e) {}
    var q = new URLSearchParams(location.search), us = q.get("utm_source") || "";
    var ref = ""; try { var r = new URL(document.referrer); if (r.host && r.host !== location.host) ref = r.host; } catch (e) {}
    if (!s || (!s.utm_source && us)) {
      s = { utm_source: us, utm_medium: q.get("utm_medium") || "", utm_campaign: q.get("utm_campaign") || q.get("brand") || "", utm_content: q.get("utm_content") || "", utm_term: q.get("utm_term") || "", ref: (s && s.ref) || ref };
      try { localStorage.setItem(k, JSON.stringify(s)); } catch (e) {}
    }
    return s;
  })();
  function stamp(data) {
    var d = Object.assign({}, data || {});
    d.ft_source = FT.utm_source || FT.ref || "direct";
    if (FT.utm_medium) d.ft_medium = FT.utm_medium;
    if (FT.utm_campaign) d.ft_campaign = FT.utm_campaign;
    if (FT.utm_content) d.ft_content = FT.utm_content;
    if (FT.utm_term) d.ft_term = FT.utm_term;
    if (FT.ref) d.ft_ref = FT.ref;
    return d;
  }
  // Carry the tag to the next page: internal links get the first-touch utm_* so the next Umami pageview is attributed too.
  document.addEventListener("DOMContentLoaded", function () {
    if (!FT.utm_source) return;
    document.querySelectorAll("a[href]").forEach(function (a) {
      try {
        var u = new URL(a.href, location.href);
        if (u.origin !== location.origin || u.searchParams.get("utm_source") || !/^https?:$/.test(u.protocol)) return;
        u.searchParams.set("utm_source", FT.utm_source);
        if (FT.utm_medium) u.searchParams.set("utm_medium", FT.utm_medium);
        if (FT.utm_campaign) u.searchParams.set("utm_campaign", FT.utm_campaign);
        if (FT.utm_content) u.searchParams.set("utm_content", FT.utm_content);
        if (FT.utm_term) u.searchParams.set("utm_term", FT.utm_term);
        a.href = u.toString();
      } catch (e) {}
    });
  });
  // CEO #7549: custom events fired right after export/upgrade taps were going missing (post_export
  // upsell_view ~1 of 6 export_done) — the most likely moment to lose them is exactly when the page
  // backgrounds (share sheet opens, tab switches) a beat later, and window.umami.track()'s own fetch
  // has no keepalive guarantee against that. Send events ourselves via sendBeacon (survives unload)
  // with a fetch keepalive fallback, straight to Umami's collect endpoint — no "ready"/queue race either.
  var endpoint = (C.src || "").replace(/\/[^/]*$/, "/api/send");
  function send(name, data) {
    if (!C.websiteId) return;
    try {
      var body = JSON.stringify({ payload: { website: C.websiteId, hostname: location.hostname, screen: screen.width + "x" + screen.height, language: navigator.language, title: document.title, url: location.pathname + location.search, referrer: document.referrer, name: name, data: data || {} }, type: "event" });
      // text/plain is CORS-safelisted (no preflight, no credentialed request against Umami's wildcard ACAO);
      // application/json is not, and a cross-origin sendBeacon with it is silently dropped by the browser
      // while sendBeacon() itself still returns true (#7621).
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain" }))) return;
      fetch(endpoint, { method: "POST", body: body, headers: { "Content-Type": "text/plain" }, keepalive: true, credentials: "omit" }).catch(function () {});
    } catch (e) {}
  }
  if (C.websiteId) {
    var s = document.createElement("script"); // kept only for Umami's automatic pageview tracking
    s.defer = true; s.src = C.src; s.setAttribute("data-website-id", C.websiteId);
    document.head.appendChild(s);
  }
  window.POVTrack = {
    firstTouch: FT,
    track: function (name, data) {
      data = stamp(data);
      local(name, data);
      send(name, data);
    },
  };
})();
