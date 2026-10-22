// Wires every [data-checkout] link from ONE constant (SITE_CONFIG.checkoutUrls[mode]), carrying first-touch UTMs.
// [data-checkout-pass] links wire to checkoutUrls.pass (CEO #7117: one-time 30-day pass, no subscription) and
// stay hidden when that URL is empty (product not live yet).
// No checkout URL yet = the link stays on its waitlist href and says "Pro launching this week, get notified".
(function () {
  var C = window.SITE_CONFIG || {};
  var urls = C.checkoutUrls || {};
  var url = urls[C.mode === "live" ? "live" : "test"] || C.paymentUrl || "";
  C.paymentUrl = url;
  var passUrl = urls.pass || "";
  var price = C.priceLabel || "$9/mo";
  var utm = {}; try { utm = JSON.parse(localStorage.getItem("utm") || "{}"); } catch (e) {}
  var q = new URLSearchParams(location.search); // direct hit on /make/?utm_source=... counts too (first touch wins on the bio page)
  if (q.get("utm_source") && !utm.utm_source) { utm = { utm_source: q.get("utm_source"), utm_campaign: q.get("utm_campaign") || "none", utm_medium: q.get("utm_medium") || "" }; try { localStorage.setItem("utm", JSON.stringify(utm)); } catch (e) {} }
  function buildHref(raw) {
    if (!raw) return "";
    var u = new URL(raw);
    // Lemon Squeezy keeps checkout[custom][*] on the order; Gumroad drops unknown params, so do not send them there (attribution = Umami).
    if (C.provider !== "gumroad") ["utm_source", "utm_campaign", "utm_medium"].forEach(function (k) { if (utm[k] && utm[k] !== "none") u.searchParams.set("checkout[custom][" + k + "]", utm[k]); });
    return u.toString();
  }
  var href = buildHref(url);
  var hrefPass = buildHref(passUrl);
  // Which free-tier limit the visitor just ran into (set by /make/ on export_blocked / free export_done; 30 min session memory).
  function lastLimit() {
    try { var l = JSON.parse(sessionStorage.getItem("povmaker.limit") || "null"); if (l && Date.now() - l.t < 30 * 60e3) return l.l; } catch (e) {}
    return "";
  }
  function bind(a) {
    if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = a.getAttribute("data-label") || ("Upgrade to Pro · " + price); }
    else a.textContent = "Pro launching this week, get notified";
    a.addEventListener("click", function () {
      if (window.POVTrack) window.POVTrack.track("upgrade_click", { page: location.pathname.split("/").pop() || "index", checkout: href ? "live" : "waitlist", limit: a.getAttribute("data-limit") || lastLimit() || "header", variant: a.getAttribute("data-variant") || "", plan: "monthly" });
    });
  }
  function bindPass(a) {
    if (!hrefPass) { a.hidden = true; return; }
    a.hidden = false;
    a.href = hrefPass; a.target = "_blank"; a.rel = "noopener";
    a.textContent = a.getAttribute("data-label") || "or $9 once — 30 days, no subscription";
    a.addEventListener("click", function () {
      if (window.POVTrack) window.POVTrack.track("upgrade_click", { page: location.pathname.split("/").pop() || "index", checkout: "live", limit: a.getAttribute("data-limit") || lastLimit() || "header", variant: a.getAttribute("data-variant") || "", plan: "pass" });
    });
  }
  window.POVUpgrade = { bind: bind, bindPass: bindPass };
  document.querySelectorAll("[data-checkout]").forEach(bind);
  document.querySelectorAll("[data-checkout-pass]").forEach(bindPass);
  document.querySelectorAll("[data-testmode]").forEach(function (el) { el.hidden = C.mode === "live" || !url; });
})();
