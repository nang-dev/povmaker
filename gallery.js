// "Start from one of ours" gallery (CEO #2941 B). Tiles come from SITE_CONFIG.gallery: our real posted Shorts (frame-0 thumb)
// each opening /make/ on the matching ?demo= preset. Copy rule (Muse): never "like this/like mine"; the free export is a simpler look.
(function () {
  var C = window.SITE_CONFIG || {}, g = C.gallery || [], el = document.getElementById("gallery");
  if (!el || !g.length) return;
  var root = el.getAttribute("data-root") || "", from = el.getAttribute("data-from") || "page";
  var strip = el.querySelector(".gal-strip");
  g.forEach(function (t) {
    var a = document.createElement("a");
    a.className = "gal-tile";
    a.href = root + "make/?demo=" + encodeURIComponent(t.demo) + "&utm_source=gallery&utm_medium=" + encodeURIComponent(from) + "&utm_campaign=ranthesim&utm_content=" + encodeURIComponent(t.demo);
    var im = document.createElement("img"); im.src = root + t.thumb; im.alt = ""; im.width = 56; im.height = 100;
    var tx = document.createElement("span"); tx.className = "gal-tx";
    var h = document.createElement("b"); h.textContent = t.title;
    var c = document.createElement("em"); c.textContent = t.cta;
    tx.appendChild(h); tx.appendChild(c); a.appendChild(im); a.appendChild(tx);
    a.addEventListener("click", function () { if (window.POVTrack) window.POVTrack.track("gallery_click", { demo: t.demo, from: from }); });
    strip.appendChild(a);
  });
  el.hidden = false;
})();
