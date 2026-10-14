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
  if (B.title) document.title = B.title + " · make videos like ours";
  $("title").textContent = B.title || $("title").textContent;
  $("tagline").textContent = B.tagline || $("tagline").textContent;
  if (B.sub) $("sub").textContent = B.sub;
  $("yr").textContent = new Date().getFullYear();

  var cta = $("cta");
  cta.textContent = B.cta || cta.textContent;
  if (C.paymentUrl) { var wl = $("waitlist"); if (wl) wl.hidden = true; } 
  cta.addEventListener("click", function () { send("/track", { event: "cta_click" }); });

  if (C.videos && C.videos.length) {
    var ul = $("videos"); ul.innerHTML = "";
    C.videos.forEach(function (v) {
      var li = document.createElement("li"), a = document.createElement("a");
      a.href = v.url; a.rel = "noopener"; a.target = "_blank";
      a.addEventListener("click", function () { send("/track", { event: "video_click" }); });
      var t = document.createElement("span"); t.textContent = v.title; a.appendChild(t);
      if (v.tag) { var g = document.createElement("span"); g.className = "tag"; g.textContent = v.tag; a.appendChild(g); }
      li.appendChild(a); ul.appendChild(li);
    });
  }
  (C.socials || []).forEach(function (s) {
    var a = document.createElement("a"); a.href = s.url; a.textContent = s.label; a.rel = "noopener"; a.target = "_blank";
    $("socials").appendChild(a);
  });

  var form = $("wl-form"), msg = $("wl-msg");
  form.addEventListener("submit", function (e) {
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
})();
