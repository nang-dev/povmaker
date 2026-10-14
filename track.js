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
    track: function (name, data) {
      local(name, data);
      if (!C.websiteId) return;
      if (ready) send(name, data); else queue.push([name, data]);
    },
  };
})();
