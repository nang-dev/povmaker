// Funnel events with no backend. window.POVTrack.track(name, data). Provider script loads only when
// SITE_CONFIG.analytics.websiteId is set. Events queue until the provider is ready; a local ring buffer
// (localStorage "povmaker.events") is kept for debugging: JSON.parse(localStorage["povmaker.events"]).
(function () {
  var C = (window.SITE_CONFIG || {}).analytics || {};
  var queue = [], ready = false;
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
  function send(name, data) {
    try {
      if (window.umami && window.umami.track) window.umami.track(name, data || {});
      else if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: name, title: name, event: true });
    } catch (e) {}
  }
  function flush() { ready = true; queue.splice(0).forEach(function (q) { send(q[0], q[1]); }); }
  if (C.websiteId) {
    var s = document.createElement("script");
    s.defer = true; s.src = C.src; s.setAttribute("data-website-id", C.websiteId);
    s.onload = flush; s.onerror = function () { queue.length = 0; };
    document.head.appendChild(s);
  }
  window.POVTrack = {
    firstTouch: FT,
    track: function (name, data) {
      data = stamp(data);
      local(name, data);
      if (!C.websiteId) return;
      if (ready) send(name, data); else queue.push([name, data]);
    },
  };
})();
