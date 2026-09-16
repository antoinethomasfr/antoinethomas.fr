/* Site Antoine THOMAS — portfolio avant/après + formulaire de contact */
(function () {
  "use strict";

  // Adresse du webhook Make qui reçoit le formulaire de contact (vide = repli sur un e-mail).
  var CONTACT_WEBHOOK = "https://hook.eu1.make.com/f9vt4q53scfdkujh4ibsqx4yflvwmoh7";
  var PORTFOLIO_URL = "portfolio.json";

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var mobileNav = document.getElementById("mobile-nav");
  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      var open = mobileNav.hidden;
      mobileNav.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { mobileNav.hidden = true; toggle.setAttribute("aria-expanded", "false"); });
    });
  }

  /* ---------- Portfolio ---------- */
  var grid = document.getElementById("portfolio");
  var projects = [];
  var currentFilter = "all";

  function imgUrl(id, width) {
    return "https://lh3.googleusercontent.com/d/" + encodeURIComponent(id) + "=w" + (width || 1200);
  }
  function fallbackUrl(id, width) {
    return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w" + (width || 1200);
  }

  function makeImg(id, alt, cls) {
    var img = document.createElement("img");
    img.className = cls;
    img.alt = alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    img.referrerPolicy = "no-referrer";
    img.src = imgUrl(id, 1200);
    img.addEventListener("error", function onErr() {
      img.removeEventListener("error", onErr);
      img.src = fallbackUrl(id, 1200);
    });
    return img;
  }

  function renderProject(p) {
    var art = document.createElement("article");
    art.className = "project";
    art.dataset.category = p.category || "";

    var head = document.createElement("div");
    head.className = "project-head";
    var h3 = document.createElement("h3");
    h3.textContent = p.title || "Réalisation";
    var cat = document.createElement("span");
    cat.className = "project-cat";
    cat.textContent = p.category || "";
    head.appendChild(h3);
    head.appendChild(cat);
    art.appendChild(head);

    if (p.note) {
      var note = document.createElement("p");
      note.className = "project-note";
      note.textContent = p.note;
      art.appendChild(note);
    }

    var ba = document.createElement("div");
    ba.className = "ba";
    ba.style.setProperty("--cut", "50%");
    ba.appendChild(makeImg(p.before, "Avant — " + (p.title || ""), "ba-before"));
    ba.appendChild(makeImg(p.after, "Après — " + (p.title || ""), "ba-after"));

    var handle = document.createElement("div");
    handle.className = "ba-handle";
    ba.appendChild(handle);

    var tagB = document.createElement("span");
    tagB.className = "ba-tag ba-tag-before";
    tagB.textContent = "Avant";
    var tagA = document.createElement("span");
    tagA.className = "ba-tag ba-tag-after";
    tagA.textContent = "Après";
    ba.appendChild(tagB);
    ba.appendChild(tagA);

    var range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "100";
    range.value = "50";
    range.className = "ba-range";
    range.setAttribute("aria-label", "Comparer avant et après : " + (p.title || ""));
    range.addEventListener("input", function () {
      ba.style.setProperty("--cut", range.value + "%");
    });
    ba.appendChild(range);

    art.appendChild(ba);
    return art;
  }

  function applyFilter() {
    if (!grid) return;
    grid.innerHTML = "";
    var list = projects.filter(function (p) {
      return currentFilter === "all" || p.category === currentFilter;
    });
    if (!list.length) {
      var empty = document.createElement("p");
      empty.className = "portfolio-empty";
      empty.textContent = projects.length
        ? "Aucune réalisation dans cette catégorie pour le moment."
        : "Les premières réalisations arrivent bientôt.";
      grid.appendChild(empty);
      return;
    }
    list.forEach(function (p) { grid.appendChild(renderProject(p)); });
  }

  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-active"); });
      chip.classList.add("is-active");
      currentFilter = chip.dataset.filter || "all";
      applyFilter();
    });
  });

  if (grid) {
    fetch(PORTFOLIO_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        projects = (data && data.projects ? data.projects : []).filter(function (p) { return p.before && p.after; });
        projects.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
        applyFilter();
      })
      .catch(function () {
        grid.innerHTML = "";
        var p = document.createElement("p");
        p.className = "portfolio-empty";
        p.innerHTML = "Les réalisations ne s'affichent pas pour le moment. Retrouvez-les sur Instagram : <a href=\"https://www.instagram.com/antoinethomas.fr/\" target=\"_blank\" rel=\"noopener\">@antoinethomas.fr</a>.";
        grid.appendChild(p);
      });
  }

  /* ---------- Vidéos : lecture au scroll, apparitions ---------- */
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var videos = document.querySelectorAll("video.scrollplay");
  if ("IntersectionObserver" in window && videos.length) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting && en.intersectionRatio >= 0.4) {
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
      if (!data.nom || !data.telephone || !data.message) {
        setStatus("Merci d'indiquer au moins votre nom, votre téléphone et vos travaux.", "err");
        return;
      }
      if (data.site) { setStatus("Merci, votre demande a bien été envoyée.", "ok"); form.reset(); return; }

      if (!CONTACT_WEBHOOK) {
        var body = "Nom : " + data.nom + "\nTéléphone : " + data.telephone + "\nE-mail : " + data.email +
          "\nVille : " + data.ville + "\n\n" + data.message;
        location.href = "mailto:contact@antoinethomas.fr?subject=" + encodeURIComponent("Demande de devis — " + data.nom) +
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
        .then(function () { setStatus("Merci ! Votre demande est envoyée, je vous réponds très vite.", "ok"); form.reset(); })
        .catch(function () { setStatus("L'envoi a échoué. Appelez-moi au 06 30 72 15 56 ou écrivez à contact@antoinethomas.fr.", "err"); })
        .then(function () { btn.disabled = false; });
    });
  }
})();
