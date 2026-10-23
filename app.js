(function () {
  var C = window.SITE_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var utm = {
    utm_source: q.get("utm_source") || "direct",
    utm_campaign: q.get("utm_campaign") || "none",
    utm_medium: q.get("utm_medium") || "",
  };
  // Remember first-touch attribution so signup/paid can be tied to the originating video link.
  try {
    var saved = JSON.parse(localStorage.getItem("utm") || "null");
    if (q.get("utm_source")) localStorage.setItem("utm", JSON.stringify(utm));
    else if (saved) utm = saved;
  } catch (e) {}

  function send(path, body) {
    if (!C.api) return Promise.resolve(null);
    var data = JSON.stringify(Object.assign({}, utm, body));
    return fetch(C.api + path, { method: "POST", headers: { "content-type": "application/json" }, body: data, keepalive: true })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; }); })
      .catch(function () { return null; });
  }

  var brandKey = document.documentElement.dataset.brand || C.defaultBrand;
  var B = (C.brands || {})[brandKey] || {};
  C.videos = B.videos || []; C.socials = B.socials || [];
  if (utm.utm_campaign === "none") utm.utm_campaign = brandKey; // ?brand= without UTMs
  $("title").textContent = B.title || $("title").textContent;
  $("tagline").textContent = B.tagline || $("tagline").textContent;
  if (B.sub) $("sub").textContent = B.sub;
  $("yr").textContent = new Date().getFullYear();

  var cta = $("cta");
  cta.textContent = B.cta || cta.textContent;
  if (C.paymentUrl) { var wl = $("waitlist"); if (wl) wl.hidden = true; } 
  cta.addEventListener("click", function () { send("/track", { event: "cta_click" }); });

  // CEO #5274: a card with a `live` UTC timestamp (ISO string) stays hidden until that post actually goes
  // live on IG, so the bio never shows a "make this one" link for a video nobody can see yet.
  var liveVideos = (C.videos || []).filter(function (v) { return !v.live || Date.now() >= new Date(v.live).getTime(); });
  if (liveVideos.length) {
    var ul = $("videos"); ul.innerHTML = "";
    liveVideos.forEach(function (v) {
      var li = document.createElement("li");
      // No IG permalink yet (CEO #5274): render the title as plain text, not a link, until v.url is filled in.
      var a = v.url ? document.createElement("a") : document.createElement("span");
      if (v.url) { a.href = v.url; a.rel = "noopener"; a.target = "_blank";
        a.addEventListener("click", function () { send("/track", { event: "video_click" }); if (window.POVTrack) window.POVTrack.track("video_click", { title: v.title }); }); }
      if (v.thumb) { var im = document.createElement("img"); im.src = v.thumb; im.alt = ""; im.width = 45; im.height = 80; im.loading = "lazy"; a.appendChild(im); }
      var t = document.createElement("span"); t.className = "vt"; t.textContent = v.title; a.appendChild(t);
      if (v.tag) { var g = document.createElement("span"); g.className = "tag"; g.textContent = v.tag; a.appendChild(g); }
      li.appendChild(a);
      if (v.make) { // second action inside the tile (Muse #3010): the title opens the reel, this line opens the editor on the matching preset
        li.className = "vwrap";
        var mk = document.createElement("a"); mk.className = "vmk"; mk.textContent = v.make.cta;
        mk.href = "make/?demo=" + encodeURIComponent(v.make.demo) + "&utm_source=bio&utm_medium=latest&utm_campaign=" + encodeURIComponent(brandKey) + "&utm_content=" + encodeURIComponent(v.make.demo);
        mk.addEventListener("click", function (e) {
          if (window.POVTrack) window.POVTrack.track("gallery_click", { demo: v.make.demo, from: "bio_latest" });
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
          e.preventDefault(); var h = mk.href; setTimeout(function () { location.href = h; }, 200); // let the beacon leave first
        });
        li.appendChild(mk);
      }
      ul.appendChild(li);
    });
  }
  (C.socials || []).forEach(function (s) {
    var a = document.createElement("a"); a.href = s.url; a.textContent = s.label; a.rel = "noopener"; a.target = "_blank";
    $("socials").appendChild(a);
  });

  var form = $("wl-form"), msg = $("wl-msg");
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("email").value.trim();
    msg.className = "msg";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = "Enter a valid email."; msg.className = "msg err"; return; }
    var ft = (window.POVTrack && window.POVTrack.firstTouch) || {};
    var src = ft.utm_source || ft.ref || utm.utm_source, camp = ft.utm_campaign || utm.utm_campaign;
    var mailto = function () {
      var sub = encodeURIComponent("POVMaker waitlist"), body = encodeURIComponent("Please add " + email + " to the POVMaker waitlist. (source: " + src + "/" + camp + ")");
      location.href = "mailto:" + (C.waitlistEmail || "") + "?subject=" + sub + "&body=" + body;
      msg.textContent = "Your email app should open. Send the message to join the list."; msg.className = "msg ok";
    };
    if (!C.waitlistEndpoint) return mailto();
    var btn = form.querySelector("button"); btn.disabled = true; msg.textContent = "Adding you…";
    fetch(C.waitlistEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email, _subject: "POVMaker waitlist: " + email, _template: "table", _honeypot: "",
        source: src, campaign: camp, medium: ft.utm_medium || utm.utm_medium || "", referrer: ft.ref || "", page: location.href }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (String(j.success) !== "true") throw new Error(j.message || "not accepted");
        msg.textContent = "You're on the list. We'll email you once when Pro opens."; msg.className = "msg ok";
        form.reset();
        if (window.POVTrack) window.POVTrack.track("waitlist_signup", { page: "index" });
      })
      .catch(function () { mailto(); })
      .then(function () { btn.disabled = false; });
  });

  send("/track", { event: "visit" });
  if (window.POVTrack) window.POVTrack.track("visit_bio", { brand: brandKey, source: utm.utm_source, campaign: utm.utm_campaign });
  // Header Pro CTA is always visible on this page (CEO #7083): count it as an upsell impression, once per session (trial #39: was 92 of 99 views).
  try {
    if (window.POVTrack && (C.checkoutUrls || {})[C.mode === "live" ? "live" : "test"] && !sessionStorage.getItem("povmaker.hdrview")) {
      sessionStorage.setItem("povmaker.hdrview", "1");
      window.POVTrack.track("upsell_view", { where: "header", page: "index" });
    }
  } catch (e) {}
})();
