// Wires every [data-checkout] link from ONE constant (SITE_CONFIG.checkoutUrls[mode]), carrying first-touch UTMs.
// No checkout URL yet = the link stays on its waitlist href and says "Pro launching this week, get notified".
(function () {
  var C = window.SITE_CONFIG || {};
  var url = (C.checkoutUrls || {})[C.mode === "live" ? "live" : "test"] || C.paymentUrl || "";
  C.paymentUrl = url;
  var price = C.priceLabel || "$9/mo";
  var href = "";
  if (url) {
    var utm = {}; try { utm = JSON.parse(localStorage.getItem("utm") || "{}"); } catch (e) {}
    var q = new URLSearchParams(location.search); // direct hit on /make/?utm_source=... counts too (first touch wins on the bio page)
    if (q.get("utm_source") && !utm.utm_source) { utm = { utm_source: q.get("utm_source"), utm_campaign: q.get("utm_campaign") || "none", utm_medium: q.get("utm_medium") || "" }; try { localStorage.setItem("utm", JSON.stringify(utm)); } catch (e) {} }
    var u = new URL(url);
    ["utm_source", "utm_campaign", "utm_medium"].forEach(function (k) { if (utm[k] && utm[k] !== "none") u.searchParams.set("checkout[custom][" + k + "]", utm[k]); });
    href = u.toString();
  }
  document.querySelectorAll("[data-checkout]").forEach(function (a) {
    if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Upgrade to Pro · " + price; }
    else a.textContent = "Pro launching this week, get notified";
    a.addEventListener("click", function () {
      if (window.POVTrack) window.POVTrack.track("upgrade_click", { page: location.pathname.split("/").pop() || "index", checkout: href ? "live" : "waitlist" });
    });
  });
  document.querySelectorAll("[data-testmode]").forEach(function (el) { el.hidden = C.mode === "live" || !url; });
})();
