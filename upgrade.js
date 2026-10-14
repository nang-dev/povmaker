// Wires every [data-checkout] link to the Lemon Squeezy checkout for the current mode, carrying first-touch UTMs.
(function () {
  var C = window.SITE_CONFIG || {};
  var url = (C.checkoutUrls || {})[C.mode === "live" ? "live" : "test"] || C.paymentUrl || "";
  C.paymentUrl = url;
  if (!url) return;
  var utm = {}; try { utm = JSON.parse(localStorage.getItem("utm") || "{}"); } catch (e) {}
  var u = new URL(url);
  ["utm_source", "utm_campaign", "utm_medium"].forEach(function (k) { if (utm[k] && utm[k] !== "none") u.searchParams.set("checkout[custom][" + k + "]", utm[k]); });
  var base = (document.currentScript && document.currentScript.src) || "";
  document.querySelectorAll("[data-checkout]").forEach(function (a) { a.href = u.toString(); a.rel = "noopener"; });
  document.querySelectorAll("[data-testmode]").forEach(function (el) { el.hidden = C.mode === "live"; });
})();
