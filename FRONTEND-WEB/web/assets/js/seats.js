/* Seat selection for lifex (business 1-2-1 flatbed, economy 3-3-3). Sample data. */
(function () {
  "use strict";
  LX.add({
    es: {
      title: "Selección de asientos", leg: "{from} – {to}", "avail": "Disponible", "sel": "Seleccionado", "unav": "No disponible", "none": "Sin selección", "pax": "Pasajero {n}",
      confirm: "Confirmar selección", later: "Elegir asiento después", announce: "Asiento {id} seleccionado para {name}", cont: "Continuar", totalPay: "Total a pagar", free: "Gratis", from: "Desde",
      "z.plus": "Asiento Plus", "z.std": "Asiento Economy", "z.exit": "Salida de emergencia", "z.biz": "Asiento Business flatbed", lav: "Baño",
      "d.plus": "Asientos en la parte delantera del avión con más espacio para las piernas, reclinación y pantalla integrada.", "d.std": "Asiento estándar de la cabina Economy.", "d.exit": "Mayor espacio para las piernas. Requisitos de seguridad: debes poder asistir en caso de emergencia.",
      "d.biz": "Disfruta de un espacio reservado para ti, con reclinación de 180°, menú de alta cocina y amenity kit. Detalles pensados para ofrecerte una experiencia única.",
      "ref": "Imagen de referencia", remove: "Quitar", back: "Volver", seatIn: "Asiento {id}", rows: "fila"
    },
    en: {
      title: "Seat selection", leg: "{from} – {to}", "avail": "Available", "sel": "Selected", "unav": "Unavailable", "none": "No selection", "pax": "Passenger {n}",
      confirm: "Confirm selection", later: "Choose seat later", announce: "Seat {id} selected for {name}", cont: "Continue", totalPay: "Total to pay", free: "Free", from: "From",
      "z.plus": "Plus seat", "z.std": "Economy seat", "z.exit": "Emergency exit", "z.biz": "Business flatbed seat", lav: "Lavatory",
      "d.plus": "Seats at the front of the aircraft with extra legroom, recline and an integrated screen.", "d.std": "Standard seat in the Economy cabin.", "d.exit": "Extra legroom. Safety requirements apply: you must be able to assist in an emergency.",
      "d.biz": "Enjoy a space reserved for you, with 180° recline, a fine-dining menu and an amenity kit. Details designed to give you a unique experience.",
      "ref": "Reference image", remove: "Remove", back: "Back", seatIn: "Seat {id}", rows: "row"
    }
  });

  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return h >>> 0; }

  function build(type) {
    var rows = [], cols, aisleAfter, gapAfter = [];
    if (type === "business") {
      cols = ["A", "D", "E", "K"]; aisleAfter = [0, 2]; gapAfter = [1];
      for (var r = 1; r <= 5; r++) rows.push({ n: r, zone: "biz", seats: cols.map(function (c) { return { c: c, un: (r === 1 || r === 3) && c === "K" }; }) });
    } else {
      cols = ["A", "B", "C", "D", "E", "F", "G", "J", "K"]; aisleAfter = [2, 5];
      var spec = [];
      for (var a = 8; a <= 11; a++) spec.push([a, "plus"]);
      spec.push({ zone: "std" }); [12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27].forEach(function (n) { spec.push([n, "std"]); });
      spec.push({ fac: true }); spec.push([28, "std", "DEF"]); spec.push({ zone: "exit" }); spec.push([29, "exit"]); spec.push({ zone: "std" });
      for (var b = 30; b <= 38; b++) spec.push([b, "std"]);
      spec.push([39, "std", "BCDEFGJ"]); spec.push([40, "std", "DEF"]); spec.push([41, "std", "DEF", true]); spec.push({ fac: true });
      spec.forEach(function (it) {
        if (Array.isArray(it)) {
          var n = it[0], z = it[1], only = it[2], allUn = it[3];
          rows.push({ n: n, zone: z, seats: cols.map(function (c) {
            var avail = !only || only.indexOf(c) >= 0, id = n + c;
            if (!avail) return null;
            var zz = z === "exit" && "DEF".indexOf(c) >= 0 ? "std" : z;
            return { c: c, zone: zz, un: allUn || (hash(id) % 100 < 17) };
          }) });
        } else rows.push(it);
      });
      // zone headers for plus and first std
      rows.splice(0, 0, { zone: "plus" });
    }
    return { rows: rows, cols: cols, aisleAfter: aisleAfter, gapAfter: gapAfter };
  }

  window.LXSeats = {
    init: function (type) {
      var $ = function (id) { return document.getElementById(id); };
      var S = LX.ensureFare(), biz = type === "business", N = S.pax || 1;
      var map = build(type), seats = (S.seats || []).slice(0, N), active = 0;
      var tpl = biz ? "minmax(0, 78px) minmax(24px, 1fr) minmax(0, 78px) 12px minmax(0, 78px) minmax(24px, 1fr) minmax(0, 78px)" : "repeat(3, 1fr) 30px repeat(3, 1fr) 30px repeat(3, 1fr)";
      var names = function (i) { var p = (S.passengers || [])[i]; return p && p.ok ? { n: p.first + " " + p.last, ini: (p.first[0] + p.last[0]).toUpperCase() } : { n: LX.t("pax", { n: i + 1 }), ini: "P" + (i + 1) }; };

      function priceOf(z) { return LX.seatPrice(z, S); }
      function sync() {
        var sum = seats.reduce(function (a, s) { return a + (s ? s.price : 0); }, 0);
        LX.save({ seats: seats, seat: seats.some(Boolean) ? { id: seats.filter(Boolean).map(function (s) { return s.id; }).join(", "), zone: "x", price: sum } : null });
        S = LX.state();
      }
      LX.init({ kind: "co", step: 3 });

      function paxCards() {
        var h = "";
        for (var i = 0; i < N; i++) {
          var nm = names(i), s = seats[i];
          h += '<div class="pax-card' + (s ? " has" : "") + (i === active ? " active" : "") + '" data-i="' + i + '"><button class="pax-pick" type="button" data-i="' + i + '" aria-pressed="' + (i === active) + '"' + (i === active ? ' aria-current="true"' : "") + '><span class="av">' + (s ? s.id : nm.ini) + '</span><span><b>' + nm.n + "</b><small>" + (s ? LX.t(s.zone === "biz" ? "z.biz" : "z." + s.zone) + " · " + (s.price ? LX.money(s.price) : LX.t("free")) : LX.t("none")) + '</small></span></button><button class="rm" type="button" data-rm="' + i + '">' + LX.t("remove") + "</button></div>";
        }
        $("pax").innerHTML = h;
        $("pax").querySelectorAll(".pax-pick").forEach(function (c) { c.addEventListener("click", function () { active = +c.getAttribute("data-i"); render(); var nb = $("pax").querySelector('.pax-pick[data-i="' + active + '"]'); nb && nb.focus(); }); });
        $("pax").querySelectorAll("[data-rm]").forEach(function (b) { b.addEventListener("click", function () { seats[+b.getAttribute("data-rm")] = null; sync(); render(); }); });
      }
      function legend() {
        $("legend").innerHTML = '<div><span class="seat' + (biz ? " biz-seat" : "") + '" data-zone="' + (biz ? "biz" : "std") + '" style="width:30px;display:inline-block;pointer-events:none"></span>' + LX.t("avail") + '</div><div><span class="seat" aria-pressed="true" style="width:30px;display:inline-block;pointer-events:none;transform:none"></span>' + LX.t("sel") + '</div><div><span class="seat" disabled style="width:30px;display:inline-block;pointer-events:none"></span>' + LX.t("unav") + "</div>";
      }
      function mapHtml() {
        var h = '<div class="cols" style="grid-template-columns:' + tpl + '">';
        var ci = 0;
        for (var i = 0; i < map.cols.length; i++) { h += "<span>" + map.cols[i] + "</span>"; if (map.aisleAfter.indexOf(i) >= 0) h += "<span></span>"; if (map.gapAfter.indexOf(i) >= 0) h += "<span></span>"; }
        h += "</div>";
        map.rows.forEach(function (r) {
          if (r.zone && !r.seats) {
            var low = r.zone === "plus" ? priceOf("plus") : r.zone === "exit" ? priceOf("exit") : priceOf("std");
            h += '<div class="zone ' + r.zone + '"><span>' + LX.t("z." + r.zone) + "</span><b>" + LX.t("from") + " " + LX.money(low) + "</b></div>"; return;
          }
          if (r.fac) { h += '<div class="facility">' + LX.t("lav") + "</div>"; return; }
          var row = '<div class="seatrow" style="grid-template-columns:' + tpl + '">';
          r.seats.forEach(function (s, i) {
            if (!s) row += "<span></span>";
            else {
              var id = r.n + s.c, z = biz ? "biz" : s.zone, sel = seats.some(function (x) { return x && x.id === id; }), who = sel ? seats.findIndex(function (x) { return x && x.id === id; }) : -1;
              row += '<button type="button" class="seat' + (biz ? " biz-seat" : "") + '" data-id="' + id + '" data-zone="' + z + '"' + (s.un ? " disabled" : "") + ' aria-pressed="' + sel + '" aria-label="' + LX.t("seatIn", { id: id }) + " · " + LX.t(z === "biz" ? "z.biz" : "z." + z) + (s.un ? " · " + LX.t("unav") : "") + '">' + (sel ? names(who).ini : "") + "</button>";
            }
            if (map.aisleAfter.indexOf(i) >= 0) row += '<span class="rownum num">' + r.n + "</span>";
            if (map.gapAfter.indexOf(i) >= 0) row += "<span></span>";
          });
          h += row + "</div>";
        });
        return h;
      }
      function bindMap() {
        var tip = $("tip");
        $("map").querySelectorAll(".seat:not([disabled])").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = b.getAttribute("data-id"), z = b.getAttribute("data-zone"), cur = seats.findIndex(function (x) { return x && x.id === id; });
            if (cur >= 0) { seats[cur] = null; }
            else { seats[active] = { id: id, zone: z, price: priceOf(z) }; var nx = seats.findIndex(function (x, i) { return !x; }); if (nx >= 0 && nx < N) active = nx; }
            sync(); render();
            var nb = $("map").querySelector('[data-id="' + id + '"]'); if (nb) nb.focus();
            $("live").textContent = cur >= 0 ? "" : LX.t("announce", { id: id, name: names(seats.findIndex(function (x) { return x && x.id === id; })).n });
          });
          function show(e) { var z = b.getAttribute("data-zone"), p = priceOf(z), r = b.getBoundingClientRect(); tip.innerHTML = '<i style="--seat-bg:' + getComputedStyle(b).getPropertyValue("--seat-bg") + '">' + b.getAttribute("data-id") + "</i><div><b>" + LX.t(z === "biz" ? "z.biz" : "z." + z) + "</b>" + (p ? LX.money(p) : LX.t("free")) + "</div>"; tip.classList.add("on"); tip.style.left = Math.max(8, Math.min(innerWidth - 220, r.left + r.width / 2 - 90)) + "px"; tip.style.top = Math.max(8, r.top - 64) + "px"; }
          b.addEventListener("mouseenter", show); b.addEventListener("focus", show);
          b.addEventListener("mouseleave", function () { tip.classList.remove("on"); }); b.addEventListener("blur", function () { tip.classList.remove("on"); });
        });
      }
      function side() {
        if (biz) {
          $("side").innerHTML = '<h3><i style="--seat-bg:#3B1F26"></i>' + LX.t("z.biz") + "</h3><p>" + LX.t("d.biz") + '</p><div class="pic"><img src="assets/img/business-seat.jpg" alt=""></div><p style="margin:10px 0 0;font-size:12.5px;color:var(--gray)">' + LX.t("ref") + "</p>";
        } else {
          var z = [["plus", "#86A0AF"], ["std", "#CFD5DC"], ["exit", "#F0B867"]];
          $("side").innerHTML = '<div class="pic" style="margin-bottom:6px"><img src="assets/img/economy-cabin.jpg" alt=""></div><p style="margin:8px 0 0;font-size:12.5px;color:var(--gray)">' + LX.t("ref") + "</p>" + z.map(function (x, i) { return "<details" + (i === 0 ? " open" : "") + '><summary><i style="--seat-bg:' + x[1] + '"></i>' + LX.t("z." + x[0]) + "</summary><p>" + LX.t("d." + x[0]) + "</p></details>"; }).join("");
        }
      }
      function footer() {
        var sum = seats.reduce(function (a, s) { return a + (s ? s.price : 0); }, 0), any = seats.some(Boolean), all = seats.filter(Boolean).length === N;
        $("sfoot").innerHTML = '<div class="wrap"><a class="btn btn-ghost" href="personaliza.html">' + LX.t("back") + '</a><div class="acts"><div class="tot"><small>' + LX.t("totalPay") + '</small><b class="num">' + LX.money(sum) + "</b></div><a class=\"btn btn-ghost only-m\" href=\"personaliza.html\">" + LX.t("back") + "</a>" +
          (biz ? "" : '<a class="btn btn-ghost" href="personaliza.html" id="later">' + LX.t("later") + "</a>") +
          '<button class="btn btn-dark" type="button" id="ok"' + (all ? "" : ' aria-disabled="true" disabled') + ">" + LX.t(biz ? "confirm" : "cont") + "</button></div></div>";
        var ok = $("ok"); ok.addEventListener("click", function () { if (all) location.href = "personaliza.html"; });
        var later = $("later"); if (later) later.addEventListener("click", function () { seats = []; sync(); });
      }
      function render() {
        $("title").textContent = LX.t("title");
        $("tab").innerHTML = (seats.some(Boolean) ? LX.ico("check") : "") + " " + LX.t("leg", { from: S.from, to: S.to });
        $("tab").style.display = "inline-flex"; $("tab").style.alignItems = "center"; $("tab").style.gap = "8px";
        paxCards(); legend(); $("map").innerHTML = mapHtml(); bindMap(); side(); footer();
      }
      LX.onLang(function () { render(); LX.apply(); });
    }
  };
})();
