/* Site Antoine THOMAS : réalisations avant/après en carrousels par type de travaux, finitions, formulaire de contact */
(function () {
  "use strict";

  // Adresse du webhook Make qui reçoit le formulaire de contact (vide = repli sur un e-mail).
  var CONTACT_WEBHOOK = "https://hook.eu1.make.com/f9vt4q53scfdkujh4ibsqx4yflvwmoh7";
  var PORTFOLIO_URL = "portfolio.json";
  var FINITIONS_URL = "finitions.json";

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Groupes de la section Réalisations, dans l'ordre d'affichage.
     Le nom du dossier Drive porte tout : « Type | Ville | note privée » ; seul le type et la ville servent. */
  var TYPES = [
    { match: /^salle/, title: "Salles de bain", one: "Salle de bain" },
    { match: /^douche/, title: "Douches", one: "Douche" },
    { match: /^(wc|toilette)/, title: "WC", one: "WC" },
    { match: /^(electri|tableau)/, title: "Électricité", one: "Électricité" }
  ];

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var mobileNav = document.getElementById("mobile-nav");
  function closeMobileNav() {
    if (!toggle || !mobileNav) return;
    mobileNav.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }
  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      var open = mobileNav.hidden;
      mobileNav.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMobileNav);
    });
    mobileNav.addEventListener("focusout", function (e) {
      if (!mobileNav.hidden && e.relatedTarget && e.relatedTarget !== toggle && !mobileNav.contains(e.relatedTarget)) closeMobileNav();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || mobileNav.hidden) return;
      var inside = mobileNav.contains(document.activeElement);
      closeMobileNav();
      if (inside) toggle.focus();
    });
  }

  /* ---------- Contact rapide : appel, SMS ou WhatsApp ----------
     <details> natif : s'ouvre sans JavaScript. Ici : fermeture au clic ailleurs, à Échap, à la sortie au clavier, après un choix,
     et un seul panneau ouvert à la fois avec le menu mobile. */
  var contact = document.querySelector(".topbar-contact");
  if (contact) {
    var contactBtn = contact.querySelector("summary");
    contact.addEventListener("toggle", function () { if (contact.open) closeMobileNav(); });
    document.addEventListener("click", function (e) {
      if (contact.open && !contact.contains(e.target)) contact.open = false;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !contact.open) return;
      var inside = contact.contains(document.activeElement);
      contact.open = false;
      if (inside) contactBtn.focus();
    });
    contact.addEventListener("focusout", function (e) {
      if (contact.open && e.relatedTarget && !contact.contains(e.relatedTarget)) contact.open = false;
    });
    contact.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { contact.open = false; });
    });
  }

  /* ---------- Images Drive ---------- */
  function imgUrl(id, width) {
    return "https://lh3.googleusercontent.com/d/" + encodeURIComponent(id) + "=w" + (width || 1200);
  }
  function fallbackUrl(id, width) {
    return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w" + (width || 1200);
  }

  /* Largeurs servies selon l'écran : la largeur affichée de la photo (3:4 dans la bande, deux par écran sur tablette),
     densité plafonnée à 2 (au-delà, aucune différence à l'œil pour le double du poids) */
  var DPR_CAP = Math.min(1, 2 / (window.devicePixelRatio || 1));
  var BA_MOBILE = "(max-width: 560px) " + Math.round(100 * DPR_CAP) + "vw, (max-width: 900px) " + Math.round(50 * DPR_CAP) + "vw, ";
  var BA_WIDTHS = [480, 800, 1200], BA_SIZES = BA_MOBILE + "clamp(315px, 45vh, 480px)";
  var BA_SIZES_PAYSAGE = BA_MOBILE + "80vh";
  var FINISH_WIDTHS = [480, 900], FINISH_SIZES = "(max-width: 900px) 260px, 25vw";

  function makeImg(id, alt, cls, width, widths, sizes) {
    var img = document.createElement("img");
    img.className = cls || "";
    img.alt = alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    img.referrerPolicy = "no-referrer";
    if (widths && sizes) {
      img.sizes = sizes;
      img.srcset = widths.map(function (w) { return imgUrl(id, w) + " " + w + "w"; }).join(", ");
    }
    img.src = imgUrl(id, width || 1200);
    img.addEventListener("error", function onErr() {
      img.removeEventListener("error", onErr);
      img.removeAttribute("srcset");
      img.src = fallbackUrl(id, width || 1200);
    });
    return img;
  }

  function svgIcon(paths, size) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", size || 16);
    svg.setAttribute("height", size || 16);
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    paths.forEach(function (d) {
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    });
    return svg;
  }
  var CHEVRON_LEFT = ["M15 6l-6 6 6 6"];
  var CHEVRON_RIGHT = ["M9 6l6 6-6 6"];

  /* ---------- Réalisations ---------- */
  var grid = document.getElementById("portfolio");
  var projects = [];

  function plain(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  /* « Type | Ville | note » → type, ville ; sans « | », le nom entier vaut type */
  function parseTitle(raw) {
    var parts = String(raw || "").split("|").map(function (s) { return s.trim(); });
    return { type: parts[0] || "", city: parts[1] || "" };
  }

  function findType(typeText) {
    var key = plain(typeText);
    for (var i = 0; i < TYPES.length; i++) {
      if (TYPES[i].match.test(key)) return TYPES[i];
    }
    return null;
  }

  /* La coupe s'arrête avant le bord : le disque reste entier, jamais rogné */
  function setCut(ba, range, pct) {
    var w = ba.clientWidth, m = w ? Math.min(50, 26 / w * 100) : 0;
    pct = Math.max(m, Math.min(100 - m, pct));
    ba.style.setProperty("--cut", pct + "%");
    range.value = Math.round(pct);
  }

  function bindHandle(ba, handle, range) {
    var dragging = false;
    function move(e) {
      var r = ba.getBoundingClientRect();
      if (!r.width) return;
      setCut(ba, range, (e.clientX - r.left) / r.width * 100);
    }
    handle.addEventListener("pointerdown", function (e) {
      dragging = true;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      move(e);
    });
    handle.addEventListener("pointermove", function (e) { if (dragging) move(e); });
    function end() { dragging = false; }
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  /* Une diapositive = un comparateur avant / après, sans texte (le titre du groupe suffit) */
  function renderSlide(p, label, index, total) {
    var art = document.createElement("article");
    art.className = "slide";
    art.setAttribute("aria-roledescription", "diapositive");
    art.setAttribute("aria-label", "Chantier " + (index + 1) + " sur " + total + " : " + label);

    var ba = document.createElement("div");
    ba.className = "ba";
    ba.style.setProperty("--cut", "50%");
    ba.appendChild(makeImg(p.before, "Avant : " + label, "ba-before", 1200, BA_WIDTHS, BA_SIZES));
    var afterImg = makeImg(p.after, "Après : " + label, "ba-after", 1200, BA_WIDTHS, BA_SIZES);
    /* Photos prises au téléphone, en hauteur par défaut ; cadre horizontal si la photo l'est */
    afterImg.addEventListener("load", function () {
      if (afterImg.naturalWidth > afterImg.naturalHeight * 1.1) {
        art.classList.add("slide-landscape");
        art.querySelectorAll("img").forEach(function (im) { if (im.srcset) im.sizes = BA_SIZES_PAYSAGE; });
      }
    });
    ba.appendChild(afterImg);

    var handle = document.createElement("div");
    handle.className = "ba-handle";

    var range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "100";
    range.value = "50";
    range.className = "ba-range";
    range.setAttribute("aria-label", "Comparer avant et après : " + label);
    range.addEventListener("input", function () {
      setCut(ba, range, Number(range.value));
    });
    ba.appendChild(range);
    ba.appendChild(handle);
    bindHandle(ba, handle, range);
    ba.addEventListener("click", function (e) {
      if (e.target === range || handle.contains(e.target)) return;
      var r = ba.getBoundingClientRect();
      if (r.width) setCut(ba, range, (e.clientX - r.left) / r.width * 100);
    });

    var tagB = document.createElement("span");
    tagB.className = "ba-tag ba-tag-before";
    tagB.textContent = "Avant";
    var tagA = document.createElement("span");
    tagA.className = "ba-tag ba-tag-after";
    tagA.textContent = "Après";
    ba.appendChild(tagB);
    ba.appendChild(tagA);

    art.appendChild(ba);
    return art;
  }

  function navButton(cls, label, paths) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "car-btn " + cls;
    b.setAttribute("aria-label", label);
    b.appendChild(svgIcon(paths, 22));
    return b;
  }

  /* Un carrousel par groupe : bande à défilement magnétique, flèches, points */
  function buildCarousel(list, one, title) {
    var car = document.createElement("div");
    car.className = "carousel";
    car.setAttribute("role", "group");
    car.setAttribute("aria-roledescription", "carrousel");
    car.setAttribute("aria-label", title);
    var track = document.createElement("div");
    track.className = "track";
    var slides = list.map(function (p, i) {
      var t = parseTitle(p.title);
      var label = one + (t.city ? ", " + t.city : "");
      var s = renderSlide(p, label, i, list.length);
      track.appendChild(s);
      return s;
    });
    car.appendChild(track);
    if (slides.length < 2) return car;

    var prev = navButton("car-prev", "Chantier précédent", CHEVRON_LEFT);
    var next = navButton("car-next", "Chantier suivant", CHEVRON_RIGHT);
    car.appendChild(prev);
    car.appendChild(next);

    var dots = document.createElement("div");
    dots.className = "dots";
    dots.setAttribute("role", "group");
    dots.setAttribute("aria-label", title + " : position");
    car.appendChild(dots);

    /* Arrêts : chaque photo calée au bord gauche, sauf en fin de bande où la dernière se cale au bord droit.
       Un point par arrêt réellement atteignable : jamais de vide après la dernière photo. */
    var stops = [], dotEls = [], current = 0;
    function computeStops() {
      var max = Math.max(0, track.scrollWidth - track.clientWidth), out = [];
      for (var i = 0; i < slides.length; i++) {
        var x = Math.min(slides[i].offsetLeft - track.offsetLeft, max);
        if (!out.length || x - out[out.length - 1] > 2) out.push(x);
      }
      return out;
    }
    function buildDots(n) {
      dotEls.forEach(function (d) { d.remove(); });
      dotEls = [];
      for (var i = 0; i < n; i++) {
        var d = document.createElement("button");
        d.type = "button";
        d.className = "dot";
        d.setAttribute("aria-label", "Position " + (i + 1) + " sur " + n);
        d.addEventListener("click", goTo.bind(null, i));
        dots.insertBefore(d, dots.querySelector(".car-play"));
        dotEls.push(d);
      }
    }
    function goTo(i) {
      if (!stops.length) return;
      i = Math.max(0, Math.min(stops.length - 1, i));
      track.scrollTo({ left: stops[i], behavior: reduced ? "auto" : "smooth" });
    }
    function update() {
      var fresh = computeStops();
      if (fresh.length !== stops.length) buildDots(fresh.length);
      stops = fresh;
      var x = track.scrollLeft, best = 0, dist = Infinity;
      for (var i = 0; i < stops.length; i++) {
        var d = Math.abs(stops[i] - x);
        if (d < dist) { dist = d; best = i; }
      }
      current = best;
      dotEls.forEach(function (d, i) {
        if (i === current) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
      });
      dots.hidden = stops.length < 2;
      var atStart = x <= 2;
      var atLast = current === stops.length - 1;
      /* Ne jamais laisser le focus clavier sur un bouton qui se désactive */
      if (atLast && document.activeElement === next) prev.focus({ preventScroll: true });
      if (atStart && document.activeElement === prev) next.focus({ preventScroll: true });
      prev.disabled = atStart;
      next.disabled = atLast;
    }
    prev.addEventListener("click", function () { goTo(current - 1); });
    next.addEventListener("click", function () { goTo(current + 1); });
    var pending = false;
    track.addEventListener("scroll", function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; update(); }, 40);
    }, { passive: true });
    /* Mesures prises une fois le carrousel dans la page, puis à chaque photo chargée (le cadre peut changer) */
    function refresh() { setTimeout(update, 0); }
    window.addEventListener("resize", refresh);
    window.addEventListener("load", refresh);
    slides.forEach(function (s) {
      var im = s.querySelector(".ba-after");
      if (im) im.addEventListener("load", refresh);
    });
    refresh();

    /* Ordinateur : la bande défile seule quand la souris approche d'un bord, plus vite près du bord */
    var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (fine && !reduced) {
      var dir = 0, force = 0, raf = 0, lastTs = 0;
      var stopEdge = function () {
        dir = 0; force = 0; lastTs = 0;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        track.style.scrollSnapType = "";
      };
      var step = function (ts) {
        if (!dir) { raf = 0; return; }
        var dt = lastTs ? Math.min(50, ts - lastTs) : 16;
        lastTs = ts;
        var max = track.scrollWidth - track.clientWidth;
        var x = track.scrollLeft + dir * (160 + 640 * force) * dt / 1000;
        track.scrollLeft = Math.max(0, Math.min(max, x));
        if ((dir < 0 && track.scrollLeft <= 0) || (dir > 0 && track.scrollLeft >= max - 0.5)) { stopEdge(); return; }
        raf = requestAnimationFrame(step);
      };
      car.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse") return;
        var r = track.getBoundingClientRect();
        var zone = Math.max(60, Math.min(140, r.width * 0.14));
        var x = e.clientX - r.left;
        var d = 0, f = 0;
        var onControl = e.target && e.target.closest && e.target.closest(".car-btn, .dots");
        var v = slides[0].getBoundingClientRect();
        /* Bouton enfoncé = on fait glisser le curseur avant/après : la bande ne bouge pas ; hors des photos non plus */
        if (e.buttons || onControl || e.clientY < v.top || e.clientY > v.bottom) {
          d = 0;
        } else if (x < zone) {
          d = -1; f = (zone - x) / zone;
        } else if (x > r.width - zone) {
          d = 1; f = (x - (r.width - zone)) / zone;
        }
        if (!d) { if (dir) stopEdge(); return; }
        dir = d;
        force = Math.min(1, Math.max(0, f));
        track.style.scrollSnapType = "none";
        if (!raf) { lastTs = 0; raf = requestAnimationFrame(step); }
      });
      car.addEventListener("pointerleave", stopEdge);
      car.addEventListener("pointerdown", stopEdge);
    }

    /* Écran tactile : le groupe visible avance seul toutes les 5 s, pause 8 s après un toucher */
    var coarse = window.matchMedia && window.matchMedia("(hover: none)").matches;
    if (coarse && !reduced && "IntersectionObserver" in window) {
      var timer = 0, visible = false, holdUntil = 0, stopped = false;
      var tick = function () {
        timer = 0;
        if (stopped || !visible || document.hidden) return;
        if (Date.now() >= holdUntil) goTo((current + 1) % stops.length);
        schedule();
      };
      var schedule = function () { if (!timer && !stopped) timer = setTimeout(tick, 5000); };
      var hold = function () { holdUntil = Date.now() + 8000; };
      /* Bouton pause / lecture (WCAG 2.2.2) : arrêt aussi dès qu'un élément du carrousel prend le focus */
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "car-play";
      var icoPause = svgIcon(["M9 6v12", "M15 6v12"], 18);
      icoPause.classList.add("ico-pause");
      var icoPlay = svgIcon(["M9 6l9 6-9 6z"], 18);
      icoPlay.classList.add("ico-play");
      toggle.appendChild(icoPause);
      toggle.appendChild(icoPlay);
      var setStopped = function (v) {
        stopped = v;
        toggle.classList.toggle("is-stopped", v);
        toggle.setAttribute("aria-label", v ? "Relancer le défilement automatique" : "Arrêter le défilement automatique");
        if (v) { if (timer) { clearTimeout(timer); timer = 0; } } else schedule();
      };
      toggle.setAttribute("aria-label", "Arrêter le défilement automatique");
      toggle.addEventListener("click", function () { setStopped(!stopped); });
      car.addEventListener("focusin", function (e) { if (e.target !== toggle && !stopped) setStopped(true); });
      dots.appendChild(toggle);
      /* Réarmé à chaque contact : un glisser lent du curseur ne voit jamais la bande partir sous le doigt */
      ["pointerdown", "pointermove", "pointerup", "touchstart", "touchend"].forEach(function (ev) {
        car.addEventListener(ev, hold, { passive: true });
      });
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          visible = en.isIntersecting && en.intersectionRatio >= 0.5;
          if (visible) schedule();
        });
      }, { threshold: [0, 0.5, 1] });
      cio.observe(car);
      document.addEventListener("visibilitychange", function () { if (!document.hidden && visible) schedule(); });
    }
    return car;
  }

  function renderGroups() {
    if (!grid) return;
    grid.innerHTML = "";
    if (!projects.length) {
      var empty = document.createElement("p");
      empty.className = "portfolio-empty";
      empty.textContent = "Les premières réalisations arrivent bientôt.";
      grid.appendChild(empty);
      return;
    }
    var groups = TYPES.map(function (t) { return { title: t.title, one: t.one, items: [] }; });
    var extras = {};
    projects.forEach(function (p) {
      var t = parseTitle(p.title);
      var type = findType(t.type);
      if (type) {
        groups[TYPES.indexOf(type)].items.push(p);
        return;
      }
      /* Type inconnu : groupe à part, nommé d'après le dossier (ou le métier) */
      var name = t.type || p.category || "Autres réalisations";
      if (!extras[name]) {
        extras[name] = { title: name, one: name, items: [] };
        groups.push(extras[name]);
      }
      extras[name].items.push(p);
    });
    groups.forEach(function (g, gi) {
      if (!g.items.length) return;
      var group = document.createElement("section");
      group.className = "group";
      var head = document.createElement("div");
      head.className = "group-head";
      var h3 = document.createElement("h3");
      h3.id = "groupe-" + gi;
      h3.textContent = g.title;
      group.setAttribute("aria-labelledby", h3.id);
      var count = document.createElement("p");
      count.className = "group-count";
      count.textContent = g.items.length + (g.items.length > 1 ? " chantiers" : " chantier");
      head.appendChild(h3);
      head.appendChild(count);
      group.appendChild(head);
      group.appendChild(buildCarousel(g.items, g.one, g.title));
      grid.appendChild(group);
    });
  }

  if (grid) {
    fetch(PORTFOLIO_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        projects = (data && data.projects ? data.projects : []).filter(function (p) { return p.before && p.after; });
        projects.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
        renderGroups();
      })
      .catch(function () {
        grid.innerHTML = "";
        var p = document.createElement("p");
        p.className = "portfolio-empty";
        p.setAttribute("role", "status");
        p.innerHTML = "Les réalisations ne s'affichent pas pour le moment. Retrouvez-les sur Instagram : <a href=\"https://www.instagram.com/antoinethomas.fr/\" target=\"_blank\" rel=\"noopener\">@antoinethomas.fr</a>.";
        grid.appendChild(p);
      });
  }

  /* ---------- Finitions ---------- */
  /* Une galerie par thème (onglets) : finitions.json = { groups: [{id, title, text}], items: [{id, group, alt}] } */
  function buildFinishes(root, data) {
    var items = (data && data.items ? data.items : []).filter(function (it) { return it.id && it.group; });
    var groups = (data && data.groups ? data.groups : []).filter(function (g) {
      return items.some(function (it) { return it.group === g.id; });
    });
    if (!groups.length) { root.closest("section").hidden = true; return; }

    var tablist = document.createElement("div");
    tablist.className = "finish-tabs";
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Finitions par thème");
    root.appendChild(tablist);

    var tabs = [], panels = [];
    groups.forEach(function (g, gi) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "finish-tab";
      tab.id = "fin-tab-" + g.id;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "fin-panel-" + g.id);
      tab.textContent = g.title;
      tablist.appendChild(tab);
      tabs.push(tab);

      var panel = document.createElement("div");
      panel.className = "finish-panel";
      panel.id = "fin-panel-" + g.id;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      if (g.text) {
        var p = document.createElement("p");
        p.className = "finish-text";
        p.textContent = g.text;
        panel.appendChild(p);
      }
      var ul = document.createElement("ul");
      ul.className = "finish-strip";
      ul.setAttribute("aria-label", g.title);
      items.forEach(function (it) {
        if (it.group !== g.id) return;
        var li = document.createElement("li");
        li.className = "finish";
        var frame = document.createElement("div");
        frame.className = "finish-frame";
        frame.appendChild(makeImg(it.id, it.alt || g.title, "", 900, FINISH_WIDTHS, FINISH_SIZES));
        li.appendChild(frame);
        ul.appendChild(li);
      });
      panel.appendChild(ul);
      root.appendChild(panel);
      panels.push(panel);
    });

    function select(i, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
      });
      var strip = panels[i].querySelector(".finish-strip");
      if (strip) strip.scrollLeft = 0;
      if (!reduced) {
        panels[i].classList.remove("is-entering");
        void panels[i].offsetWidth;
        panels[i].classList.add("is-entering");
      }
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i, false); });
    });
    tablist.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = tabs.length, to = -1;
      if (e.key === "ArrowRight") to = (i + 1) % n;
      else if (e.key === "ArrowLeft") to = (i - 1 + n) % n;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = n - 1;
      if (to < 0) return;
      e.preventDefault();
      select(to, true);
    });
    select(0, false);
    panels[0].classList.remove("is-entering");

    /* La bande défile au clavier sous 900 px seulement : en grille, pas d'arrêt de tabulation vide */
    var narrow = window.matchMedia ? window.matchMedia("(max-width: 900px)") : null;
    function setStripFocus() {
      var on = !narrow || narrow.matches;
      root.querySelectorAll(".finish-strip").forEach(function (s) {
        if (on) s.tabIndex = 0; else s.removeAttribute("tabindex");
      });
    }
    setStripFocus();
    if (narrow && narrow.addEventListener) narrow.addEventListener("change", setStripFocus);
    else if (narrow && narrow.addListener) narrow.addListener(setStripFocus);
  }

  var finishes = document.getElementById("finitions-galerie");
  if (finishes) {
    fetch(FINITIONS_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { buildFinishes(finishes, data); })
      .catch(function () { finishes.closest("section").hidden = true; });
  }

  /* ---------- Vidéos : lecture au scroll, bouton pause (WCAG 2.2.2), apparitions ---------- */
  var videos = document.querySelectorAll("video.scrollplay");
  videos.forEach(function (v) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "phone-pause";
    var icoPause = svgIcon(["M9 6v12", "M15 6v12"], 20);
    icoPause.classList.add("ico-pause");
    var icoPlay = svgIcon(["M9 6l9 6-9 6z"], 20);
    icoPlay.classList.add("ico-play");
    btn.appendChild(icoPause);
    btn.appendChild(icoPlay);
    function sync() {
      btn.classList.toggle("is-paused", v.paused);
      btn.setAttribute("aria-label", v.paused ? "Lire la vidéo" : "Mettre la vidéo en pause");
    }
    /* Pause choisie par le visiteur : la lecture au scroll ne relance plus cette vidéo */
    btn.addEventListener("click", function () {
      if (v.paused) {
        v.dataset.userPaused = "";
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        v.dataset.userPaused = "1";
        v.pause();
      }
    });
    v.addEventListener("play", sync);
    v.addEventListener("pause", sync);
    sync();
    v.parentNode.appendChild(btn);
    if (v.hasAttribute("data-sound")) addSound(v);
  });

  /* Son au choix du visiteur : la vidéo démarre muette (seule lecture automatique permise), le bouton coupe ou remet le son */
  function addSound(v) {
    var speaker = "M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6a1.4 1.4 0 0 1-1 .4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z";
    var b = document.createElement("button");
    b.type = "button";
    b.className = "phone-sound";
    var icoOff = svgIcon([speaker, "M22 9l-6 6", "M16 9l6 6"], 18);
    icoOff.classList.add("ico-off");
    var icoOn = svgIcon([speaker, "M16 9a5 5 0 0 1 0 6", "M19.4 18.4a9 9 0 0 0 0-12.8"], 18);
    icoOn.classList.add("ico-on");
    var txt = document.createElement("span");
    b.appendChild(icoOff);
    b.appendChild(icoOn);
    b.appendChild(txt);
    function syncSound() {
      b.classList.toggle("is-on", !v.muted);
      txt.textContent = v.muted ? "Activer le son" : "Couper le son";
    }
    b.addEventListener("click", function () {
      v.muted = !v.muted;
      if (!v.muted && v.paused) {
        v.dataset.userPaused = "";
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      }
    });
    v.addEventListener("volumechange", syncSound);
    syncSound();
    v.parentNode.appendChild(b);
  }
  if ("IntersectionObserver" in window && videos.length) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting && en.intersectionRatio >= 0.4 && !reduced && v.dataset.userPaused !== "1") {
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: [0, 0.4, 1] });
    videos.forEach(function (v) { vio.observe(v); });
  }
  var reveals = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
  } else {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); rio.unobserve(en.target); }
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { rio.observe(el); });
  }

  /* ---------- Formulaire de contact ---------- */
  var form = document.getElementById("contact-form");
  var status = document.getElementById("form-status");

  function setStatus(msg, cls) {
    if (!status) return;
    status.textContent = msg;
    status.className = "form-status" + (cls ? " " + cls : "");
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {
        nom: form.nom.value.trim(),
        telephone: form.telephone.value.trim(),
        email: form.email.value.trim(),
        ville: form.ville.value.trim(),
        message: form.message.value.trim(),
        site: form.site.value.trim(),
        page: location.href
      };
      var manque = {
        nom: !data.nom,
        telephone: data.telephone.replace(/\D/g, "").length < 8,
        message: !data.message
      };
      var premier = null, manquants = [];
      var LIBELLES = { nom: "votre nom", telephone: "un numéro de téléphone d'au moins 8" + "\u00a0" + "chiffres", message: "vos travaux" };
      Object.keys(manque).forEach(function (k) {
        if (manque[k]) { form[k].setAttribute("aria-invalid", "true"); form[k].setAttribute("aria-describedby", "form-status"); premier = premier || form[k]; manquants.push(LIBELLES[k]); }
        else { form[k].removeAttribute("aria-invalid"); form[k].removeAttribute("aria-describedby"); }
      });
      if (premier) {
        setStatus("Merci d'indiquer " + manquants.join(", ").replace(/, ([^,]*)$/, " et $1") + ".", "err");
        premier.focus();
        return;
      }
      if (data.site) { setStatus("Merci, votre demande a bien été envoyée.", "ok"); form.reset(); return; }

      if (!CONTACT_WEBHOOK) {
        var body = "Nom : " + data.nom + "\nTéléphone : " + data.telephone + "\nE-mail : " + data.email +
          "\nVille : " + data.ville + "\n\n" + data.message;
        location.href = "mailto:contact@antoinethomas.fr?subject=" + encodeURIComponent("Demande de devis : " + data.nom) +
          "&body=" + encodeURIComponent(body);
        return;
      }

      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      setStatus("Envoi en cours…");
      var params = new URLSearchParams();
      Object.keys(data).forEach(function (k) { params.append(k, data[k]); });
      fetch(CONTACT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      })
        .then(function (r) { if (!r.ok) throw new Error(r.status); })
        .then(function () { setStatus("Merci ! Votre demande est envoyée, je vous réponds très vite.", "ok"); form.reset(); })
        .catch(function () { setStatus("L'envoi a échoué. Appelez-moi au 06 30 72 15 56 ou écrivez à contact@antoinethomas.fr.", "err"); })
        .then(function () { btn.disabled = false; });
    });
  }
})();
