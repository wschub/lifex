/* lifex prototype core: i18n (ES/EN), COP/USD, booking state, shared shell. All data is sample data. */
(function () {
  "use strict";

  /* ---------- Sample data (synthetic: replace with real routes and fares) ---------- */
  var CITIES = {
    BOG: { es: "Bogotá", en: "Bogotá", country: "CO" },
    MDE: { es: "Medellín", en: "Medellín", country: "CO" },
    CTG: { es: "Cartagena", en: "Cartagena", country: "CO" },
    SAI: { es: "San Andrés", en: "San Andrés", country: "CO" },
    MIA: { es: "Miami", en: "Miami", country: "US" },
    MAD: { es: "Madrid", en: "Madrid", country: "ES" },
    LHR: { es: "Londres", en: "London", country: "GB" }
  };
  /* base = Economy Light, price per passenger, taxes included (COP) */
  var DEST = {
    MDE: { base: 189900, dep: "06:30", dur: 55, tz: 0, seatF: .2, img: "med" },
    CTG: { base: 214500, dep: "08:20", dur: 85, tz: 0, seatF: .2, img: "cart" },
    SAI: { base: 356900, dep: "10:05", dur: 110, tz: 0, seatF: .25, img: "sai" },
    MIA: { base: 1126000, dep: "07:10", dur: 225, tz: 0, seatF: .6, img: "mia" },
    MAD: { base: 2104000, dep: "19:40", dur: 595, tz: 6, seatF: 1, img: "mad" },
    LHR: { base: 2318000, dep: "23:25", dur: 610, tz: 5, seatF: 1, img: "lon" },
    BOG: { base: 189900, dep: "07:15", dur: 55, tz: 0, seatF: .2, img: "bog" }
  };
  var FARES = {
    light:   { cab: "economy", mult: 1 },
    classic: { cab: "economy", mult: 1.25 },
    flex:    { cab: "economy", mult: 1.53 },
    elite:   { cab: "business", mult: 8.4 },
    royal:   { cab: "business", mult: 10.6 }
  };
  var RATE = 4000;            // sample COP per USD
  var TAX_SHARE = 0.2073;     // taxes as share of ticket subtotal
  var BAG = 595800, SPORT = 430300;

  /* ---------- Language ---------- */
  var DICT = { es: {}, en: {} };
  var lang = "es";
  try { lang = localStorage.getItem("lx-lang") || "es"; } catch (e) {}
  if (lang !== "en") lang = "es";
  var hooks = [];

  function add(d) {
    ["es", "en"].forEach(function (l) { if (d[l]) Object.keys(d[l]).forEach(function (k) { DICT[l][k] = d[l][k]; }); });
  }
  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]);
    if (s == null) s = DICT.es[key];
    if (s == null) return key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  function locale() { return lang === "en" ? "en-US" : "es-CO"; }
  function money(cop) {
    var n = lang === "en" ? Math.round(cop / RATE) : Math.round(cop);
    var s = new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(n);
    return (lang === "en" ? "USD " : "COP ") + s;
  }
  function fmtDate(iso, opts) {
    var p = iso.split("-"); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    return new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: "UTC" }, opts)).format(d);
  }
  function city(code) { return CITIES[code] ? CITIES[code][lang] : code; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function flightTimes(dep, durMin, tz, shiftMin) {
    var p = dep.split(":"), m = (+p[0]) * 60 + (+p[1]) + (shiftMin || 0), start = ((m % 1440) + 1440) % 1440, end = start + durMin + (tz || 0) * 60;
    var day = Math.floor(end / 1440); end = ((end % 1440) + 1440) % 1440;
    return { dep: pad(Math.floor(start / 60)) + ":" + pad(start % 60), arr: pad(Math.floor(end / 60)) + ":" + pad(end % 60), next: day };
  }
  function fareLabel(id) { return FARES[id].cab === 'business' ? t('cabin.business') + ' ' + t('fare.' + id) : t('cabin.' + FARES[id].cab) + ' · ' + t('fare.' + id); }
  function dur(min) { var h = Math.floor(min / 60), m = min % 60; return h + "h " + (m < 10 ? "0" : "") + m + "m"; }

  /* ---------- State ---------- */
  var DEFAULT = { from: "BOG", to: "LHR", dep: "2026-11-24", pax: 1, cabin: "economy", fare: "", seat: null, bags: 0, sport: 0, passenger: null, holder: null, pay: "card", code: "" };
  function load() {
    try { var s = JSON.parse(sessionStorage.getItem("lx") || "null"); s = s || {}; if (s.fare === 'business') s.fare = 'elite'; return Object.assign({}, DEFAULT, s); } catch (e) { return Object.assign({}, DEFAULT); }
  }
  var S = load();
  function save(patch) { if (patch) Object.assign(S, patch); try { sessionStorage.setItem("lx", JSON.stringify(S)); } catch (e) {} }
  function reset() { S = Object.assign({}, DEFAULT); save(); }

  function routeInfo(from, to) {
    var d = DEST[to] || DEST.LHR; var f = from === "BOG" ? 1 : 1.07;
    return { dep: d.dep, dur: d.dur, tz: d.tz || 0, factor: f, seatF: d.seatF, img: d.img };
  }
  function farePrice(fareId, st) {
    st = st || S; var r = routeInfo(st.from, st.to); var d = DEST[st.to] || DEST.LHR;
    return Math.round(d.base * r.factor * FARES[fareId].mult / 100) * 100;
  }
  function seatPrice(zone, st) {
    st = st || S; var f = routeInfo(st.from, st.to).seatF;
    if (zone === "biz") return 0;
    var base = { plus: 321100, std: 107600, exit: 307800 }[zone] || 0;
    return Math.round(base * f / 100) * 100;
  }
  function extras(st) {
    st = st || S; var f = Math.max(routeInfo(st.from, st.to).seatF, .35);
    return { seat: st.seat ? st.seat.price : 0, bags: Math.round(BAG * f / 100) * 100 * (st.bags || 0), sport: Math.round(SPORT * f / 100) * 100 * (st.sport || 0), bagUnit: Math.round(BAG * f / 100) * 100, sportUnit: Math.round(SPORT * f / 100) * 100 };
  }
  function totals(st) {
    st = st || S; var fp = st.fare ? farePrice(st.fare, st) * (st.pax || 1) : 0; var e = extras(st);
    var services = e.seat + e.bags + e.sport; var tickets = Math.round(fp / (1 + TAX_SHARE) / 100) * 100; var taxes = fp - tickets;
    return { fare: fp, tickets: tickets, taxes: taxes, services: services, total: fp + services };
  }

  /* ---------- Icons ---------- */
  var ICONS = {
    plane: '<path d="M21 15.5v-1.6l-8-5V4.5a1.5 1.5 0 0 0-3 0v4.4l-8 5v1.6l8-2.3v4.4l-2 1.5V21l3.5-1 3.5 1v-1.4l-2-1.5v-4.4z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M2.8 19.5c.6-3.4 3-5 6.2-5s5.6 1.6 6.2 5M16 5.5a3 3 0 0 1 0 6M18 14.8c2 .5 3.2 2 3.6 4.7"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    luggage: '<rect x="6" y="7" width="12" height="13" rx="2.5"/><path d="M9.5 7V4.5h5V7M9.5 11v5M14.5 11v5"/>',
    bag: '<path d="M6 8h12l1 12H5L6 8zM9 8V6.5a3 3 0 0 1 6 0V8"/>',
    seat: '<path d="M7 3.5h5a2.5 2.5 0 0 1 2.5 2.5v6.5H7V3.5zM7 12.5l-1.5 8M14.5 12.5 17 20.5M4.5 16h13"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.1"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16v.1"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    meal: '<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M17 21V3c-2 1.5-3 4-3 8h3"/>',
    wifi: '<path d="M3 9.5a14 14 0 0 1 18 0M6 13a9 9 0 0 1 12 0M9.2 16.3a4.5 4.5 0 0 1 5.6 0M12 19.5v.1"/>',
    refund: '<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4"/><path d="M12 8v4l2.5 1.5"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5z"/>',
    edit: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1zM14.5 6.5l3 3"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>',
    bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8H8M13 8l-3 8"/>',
    cabin: '<path d="M4 19V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11M4 14h16M8 19v-5M16 19v-5"/>',
    crown: '<path d="M4 18.5h16M4.5 17 3.5 7.5l5 4 3.5-6 3.5 6 5-4-1 9.5"/>',
    wing: '<path d="M3 17c6 0 10-3 13-9-.5 5-4 10-13 9zM3 21c5 0 9-1.5 11-5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4 4 0 0 1 12 7.8a4 4 0 0 1 7.5 2C19.5 15.4 12 20 12 20z"/>'
  };
  function ico(n, cls) { return '<svg class="ico ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || "") + "</svg>"; }

  function flag(c) {
    if (c === "us") {
      var st = ""; for (var i = 0; i < 7; i++) st += '<rect y="' + (i * 15 / 7 * 1) + '" width="22" height="' + (15 / 7) + '" fill="' + (i % 2 ? "#fff" : "#B22234") + '"/>';
      return '<svg class="flag" viewBox="0 0 22 15" aria-hidden="true">' + st + '<rect width="10" height="8.1" fill="#3C3B6E"/></svg>';
    }
    return '<svg class="flag" viewBox="0 0 22 15" aria-hidden="true"><rect width="22" height="7.5" fill="#FCD116"/><rect y="7.5" width="22" height="3.75" fill="#003893"/><rect y="11.25" width="22" height="3.75" fill="#CE1126"/></svg>';
  }

  /* ---------- Common strings ---------- */
  add({
    es: {
      "i.bag3": "3 equipajes de bodega (32 kg)", "i.fast": "Elección prioritaria de asiento", "i.miles12": "12 millas lifexperience por USD", "i.freeChg": "Cambios y reembolsos sin cargo",
      "i.seatE": "Asiento Economy", "i.seatP": "Asiento Plus (sujeto a disponibilidad)", "i.seatB": "Asiento Business flatbed", "i.menuB": "Menú de alta cocina", "i.personal": "1 artículo personal (bajo el asiento)", "i.carry": "1 equipaje de mano (10 kg)", "i.bag": "1 equipaje de bodega (23 kg)", "i.bag2": "2 equipajes de bodega (32 kg)", "i.checkin": "Check-in en aeropuerto", "i.meal": "Menú a bordo", "i.miles3": "3 millas lifexperience por USD", "i.miles6": "6 millas lifexperience por USD", "i.miles8": "8 millas lifexperience por USD", "i.miles10": "10 millas lifexperience por USD", "i.change": "Cambios (antes del vuelo)", "i.refund": "Reembolsos (antes del vuelo)", "i.priority": "Servicio prioritario", "i.lounge": "Salas VIP (sujeto a disponibilidad)",
      "nav.book": "Reservar", "nav.offers": "Ofertas", "nav.trips": "Mi reserva", "nav.lx": "lifexperience",
      "login": "Iniciar sesión", "lang.es": "Español", "lang.en": "English", "lang.es.cur": "COP", "lang.en.cur": "USD", "lang.label": "Idioma y moneda",
      "step.1": "Vuelo", "step.2": "Pasajeros", "step.3": "Personaliza", "step.4": "Pago", "step.of": "Paso {n} de 4",
      "cabin.economy": "Economy", "cabin.business": "Business",
      "fare.light": "Light", "fare.classic": "Classic", "fare.flex": "Flex", "fare.business": "Business", "fare.elite": "Elite", "fare.royal": "Royal", "fare.elite": "Elite", "fare.royal": "Royal",
      "direct": "Directo", "operated": "Operado por lifex", "next.day": "+1 día", "adult": "adulto", "adults": "adultos", "pax1": "1 adulto", "paxN": "{n} adultos",
      "from": "Desde", "per.pax": "Precio por pasajero", "total.res": "Total de tu reserva", "taxes.incl": "Todos los impuestos están incluidos en el precio total",
      "continue": "Continuar", "back": "Volver", "pay": "Ir a pagar", "next": "Siguiente", "edit": "Editar", "remove": "Quitar",
      "foot.about": "Sobre lifex", "foot.links": "Enlaces rápidos", "foot.legal": "Información legal", "foot.help": "Ayuda",
      "foot.who": "Quiénes somos", "foot.dest": "Destinos", "foot.manage": "Gestiona tu reserva", "foot.checkin": "Check-in online", "foot.bags": "Equipaje", "foot.status": "Estado de vuelos",
      "foot.privacy": "Política de privacidad", "foot.contract": "Contrato de transporte", "foot.cookies": "Política de cookies", "foot.access": "Plan de accesibilidad",
      "foot.contact": "Contáctanos", "foot.whatsapp": "Chatea por WhatsApp", "foot.credits": "Créditos de fotos",
      "foot.tag": "The best experience, always.", "foot.copy": "© 2026 lifex. Prototipo con datos de ejemplo.",
      "sample": "Datos de ejemplo: rutas, horarios y precios no son reales.",
      "skip": "Saltar al contenido"
    },
    en: {
      "i.bag3": "3 checked bags (32 kg)", "i.fast": "Priority seat selection", "i.miles12": "12 lifexperience miles per USD", "i.freeChg": "Changes and refunds at no charge",
      "i.seatE": "Economy seat", "i.seatP": "Plus seat (subject to availability)", "i.seatB": "Business flatbed seat", "i.menuB": "Fine-dining menu", "i.personal": "1 personal item (under the seat)", "i.carry": "1 carry-on bag (10 kg)", "i.bag": "1 checked bag (23 kg)", "i.bag2": "2 checked bags (32 kg)", "i.checkin": "Airport check-in", "i.meal": "Onboard meal", "i.miles3": "3 lifexperience miles per USD", "i.miles6": "6 lifexperience miles per USD", "i.miles8": "8 lifexperience miles per USD", "i.miles10": "10 lifexperience miles per USD", "i.change": "Changes (before the flight)", "i.refund": "Refunds (before the flight)", "i.priority": "Priority service", "i.lounge": "VIP lounges (subject to availability)",
      "nav.book": "Book", "nav.offers": "Offers", "nav.trips": "My booking", "nav.lx": "lifexperience",
      "login": "Log in", "lang.es": "Español", "lang.en": "English", "lang.es.cur": "COP", "lang.en.cur": "USD", "lang.label": "Language and currency",
      "step.1": "Flight", "step.2": "Passengers", "step.3": "Customize", "step.4": "Payment", "step.of": "Step {n} of 4",
      "cabin.economy": "Economy", "cabin.business": "Business",
      "fare.light": "Light", "fare.classic": "Classic", "fare.flex": "Flex", "fare.business": "Business", "fare.elite": "Elite", "fare.royal": "Royal",
      "direct": "Nonstop", "operated": "Operated by lifex", "next.day": "+1 day", "adult": "adult", "adults": "adults", "pax1": "1 adult", "paxN": "{n} adults",
      "from": "From", "per.pax": "Price per passenger", "total.res": "Your booking total", "taxes.incl": "All taxes are included in the total price",
      "continue": "Continue", "back": "Back", "pay": "Go to payment", "next": "Next", "edit": "Edit", "remove": "Remove",
      "foot.about": "About lifex", "foot.links": "Quick links", "foot.legal": "Legal", "foot.help": "Help",
      "foot.who": "Who we are", "foot.dest": "Destinations", "foot.manage": "Manage your booking", "foot.checkin": "Online check-in", "foot.bags": "Baggage", "foot.status": "Flight status",
      "foot.privacy": "Privacy policy", "foot.contract": "Contract of carriage", "foot.cookies": "Cookie policy", "foot.access": "Accessibility plan",
      "foot.contact": "Contact us", "foot.whatsapp": "Chat on WhatsApp", "foot.credits": "Photo credits",
      "foot.tag": "The best experience, always.", "foot.copy": "© 2026 lifex. Prototype with sample data.",
      "sample": "Sample data: routes, schedules and prices are not real.",
      "skip": "Skip to content"
    }
  });


  var ECON_ITEMS = {
    light:   [["i.personal", 1, "bag"], ["i.carry", 1, "luggage"], ["i.meal", 1, "meal"], ["i.miles3", 1, "star"]],
    classic: [["i.personal", 1, "bag"], ["i.carry", 1, "luggage"], ["i.bag", 1, "luggage"], ["i.checkin", 1, "check"], ["i.seatE", 1, "seat"], ["i.meal", 1, "meal"], ["i.miles6", 1, "star"], ["i.change", 0, "x"], ["i.refund", 0, "x"]],
    flex:    [["i.personal", 1, "bag"], ["i.carry", 1, "luggage"], ["i.bag", 1, "luggage"], ["i.checkin", 1, "check"], ["i.seatP", 1, "seat"], ["i.meal", 1, "meal"], ["i.miles8", 1, "star"], ["i.change", 1, "refund"], ["i.refund", 1, "refund"]],
    elite:   [["i.personal", 1, "bag"], ["i.carry", 1, "luggage"], ["i.bag2", 1, "luggage"], ["i.seatB", 1, "seat"], ["i.menuB", 1, "meal"], ["i.miles10", 1, "star"], ["i.priority", 1, "crown"], ["i.lounge", 1, "crown"], ["i.change", 1, "refund"], ["i.refund", 1, "refund"]],
    royal:   [["i.personal", 1, "bag"], ["i.carry", 1, "luggage"], ["i.bag3", 1, "luggage"], ["i.seatB", 1, "seat"], ["i.fast", 1, "seat"], ["i.menuB", 1, "meal"], ["i.miles12", 1, "star"], ["i.priority", 1, "crown"], ["i.lounge", 1, "crown"], ["i.freeChg", 1, "refund"]]
  };
  function fareItems(id) { return ECON_ITEMS[id] || []; }

  /* ---------- Shell ---------- */
  function langMenu() {
    return '<div class="lang" id="lang">' +
      '<button class="lang-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="' + t("lang.label") + '">' +
      flag(lang === "en" ? "us" : "co") + '<span>' + (lang === "en" ? "EN · USD" : "ES · COP") + '</span>' + ico("chev", "chev") + '</button>' +
      '<div class="lang-menu" role="menu">' +
      '<button type="button" role="menuitemradio" aria-checked="' + (lang === "es") + '" data-lang="es">' + flag("co") + t("lang.es") + '<small>COP</small></button>' +
      '<button type="button" role="menuitemradio" aria-checked="' + (lang === "en") + '" data-lang="en">' + flag("us") + t("lang.en") + '<small>USD</small></button>' +
      '</div></div>';
  }
  function siteHeader(cur) {
    return '<header class="site-header"><div class="wrap">' +
      '<a class="brand" href="index.html" aria-label="lifex"><img src="assets/logo/lifex-horizontal.svg" alt="lifex" width="123" height="49"></a>' +
      '<nav class="nav" aria-label="Principal">' +
      '<a href="index.html#buscar"' + (cur === "home" ? ' aria-current="page"' : "") + '>' + t("nav.book") + '</a>' +
      '<a href="index.html#ofertas">' + t("nav.offers") + '</a>' +
      '<a href="confirmacion.html?demo=1">' + t("nav.trips") + '</a>' +
      '<a href="index.html#lifexperience">' + t("nav.lx") + '</a></nav>' +
      '<div class="tools">' + langMenu() + '<a class="login" href="#">' + ico("user") + '<span>' + t("login") + '</span></a></div>' +
      '</div></header>';
  }
  function coHeader(step) {
    var r = S.from + " → " + S.to, items = "";
    for (var i = 1; i <= 4; i++) {
      var cls = i < step ? "done" : i === step ? "current" : "";
      items += '<li class="' + cls + '"' + (i === step ? ' aria-current="step"' : "") + '><span class="step-win" title="' + t("step." + i) + '">' +
        (i < step ? ico("check") : i) + '</span><span class="sr-only">' + t("step." + i) + "</span></li>";
    }
    return '<header class="co-header"><div class="wrap">' +
      '<a class="brand" href="index.html" aria-label="lifex"><img src="assets/logo/lifex-horizontal.svg" alt="lifex" width="85" height="34"></a>' +
      '<div class="trip-pill"><span class="route">' + S.from + ico("arrow") + S.to + '</span><span>' + fmtDate(S.dep, { day: "numeric", month: "short" }) + '</span><span>' + ico("user") + " " + t(S.pax > 1 ? "paxN" : "pax1", { n: S.pax }) + '</span></div>' +
      '<ol class="stepper" aria-label="' + t("step.of", { n: step }) + '">' + items + "</ol>" +
      '<div class="tools">' + langMenu() + "</div></div></header>";
  }
  function siteFooter(compact) {
    if (compact) return '<footer class="site-footer compact"><div class="wrap foot-note" style="margin-top:0;border:0;padding-top:0"><span>' + t("foot.copy") + '</span><span>' + t("taxes.incl") + '</span></div></footer>';
    return '<footer class="site-footer"><div class="wrap"><div class="foot-grid">' +
      '<div class="foot-brand"><img src="assets/logo/lifex-horizontal.svg" alt="lifex"><p>' + t("foot.tag") + '</p></div>' +
      '<div><h4>' + t("foot.links") + '</h4><ul><li><a href="index.html#ofertas">' + t("foot.dest") + '</a></li><li><a href="confirmacion.html?demo=1">' + t("foot.manage") + '</a></li><li><a href="#">' + t("foot.checkin") + '</a></li><li><a href="#">' + t("foot.bags") + '</a></li><li><a href="#">' + t("foot.status") + '</a></li></ul></div>' +
      '<div><h4>' + t("foot.about") + '</h4><ul><li><a href="#">' + t("foot.who") + '</a></li><li><a href="index.html#lifexperience">lifexperience</a></li><li><a href="#">' + t("foot.access") + '</a></li><li><a href="creditos.html">' + t("foot.credits") + '</a></li></ul></div>' +
      '<div><h4>' + t("foot.legal") + '</h4><ul><li><a href="#">' + t("foot.privacy") + '</a></li><li><a href="#">' + t("foot.contract") + '</a></li><li><a href="#">' + t("foot.cookies") + '</a></li><li><a href="#">' + t("foot.contact") + '</a></li></ul></div>' +
      '</div><div class="foot-note"><span>' + t("foot.copy") + '</span><span>' + t("sample") + '</span></div></div></footer>';
  }
  function summaryBar(o) {
    var T = totals(), canGo = o.ready ? o.ready() : true;
    var back = o.back ? '<a class="btn btn-ghost" href="' + o.back + '">' + t("back") + "</a>" : "";
    return '<div class="summary-bar" id="summary"><div class="wrap">' +
      '<div class="sb-route"><b>' + S.from + ico("arrow") + S.to + '</b><small>' + fmtDate(S.dep, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) + '</small></div>' +
      '<div class="sb-pax"><b>' + S.pax + " " + t(S.pax > 1 ? "adults" : "adult") + '</b><small>' + (S.fare ? fareLabel(S.fare) : "") + '</small></div>' +
      '<div class="sb-total"><b class="price">' + money(T.total) + '</b><small>' + t("total.res") + '</small></div>' +
      '<div class="sb-actions">' + back + '<button class="btn btn-dark" id="sb-next" type="button"' + (canGo ? "" : ' aria-disabled="true"') + ">" + t(o.label || "continue") + "</button></div></div></div>";
  }

  function bindShell() {
    var lg = document.getElementById("lang");
    document.querySelectorAll("#lang, .lang").forEach(function (box) {
      var btn = box.querySelector(".lang-btn");
      btn.addEventListener("click", function (e) { e.stopPropagation(); var o = box.classList.toggle("open"); btn.setAttribute("aria-expanded", o); });
      box.querySelectorAll("[data-lang]").forEach(function (b) { b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); }); });
    });
    document.addEventListener("click", function () { document.querySelectorAll(".lang.open").forEach(function (b) { b.classList.remove("open"); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") document.querySelectorAll(".lang.open").forEach(function (b) { b.classList.remove("open"); }); });
  }

  /* ---------- Apply language ---------- */
  function apply(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    root.querySelectorAll("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    root.querySelectorAll("[data-i18n-ph]").forEach(function (el) { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
    root.querySelectorAll("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))); });
    root.querySelectorAll("[data-i18n-title]").forEach(function (el) { el.setAttribute("title", t(el.getAttribute("data-i18n-title"))); });
    root.querySelectorAll("[data-cop]").forEach(function (el) { el.textContent = money(+el.getAttribute("data-cop")); });
    root.querySelectorAll("[data-date]").forEach(function (el) {
      var o = el.getAttribute("data-fmt") === "long" ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { weekday: "short", day: "numeric", month: "short" };
      el.textContent = fmtDate(el.getAttribute("data-date"), o);
    });
    root.querySelectorAll("[data-city]").forEach(function (el) { el.textContent = city(el.getAttribute("data-city")); });
    document.documentElement.lang = lang;
  }
  function setLang(l) {
    lang = l === "en" ? "en" : "es";
    try { localStorage.setItem("lx-lang", lang); } catch (e) {}
    mountShell(); apply(); hooks.forEach(function (f) { f(lang); });
  }

  var shellCfg = null;
  function mountShell() {
    if (!shellCfg) return;
    var c = shellCfg, h = document.getElementById("shell-header"), f = document.getElementById("shell-footer");
    if (h) h.outerHTML = (c.kind === "co" ? coHeader(c.step) : siteHeader(c.page)).replace("<header", '<header id="shell-header"');
    if (f) f.outerHTML = siteFooter(c.kind === "co").replace("<footer", '<footer id="shell-footer"');
    var sb = document.getElementById("summary");
    if (c.summary) { var html = summaryBar(c.summary); if (sb) sb.outerHTML = html; else document.body.insertAdjacentHTML("beforeend", html); wireSummary(); }
    bindShell();
  }
  function wireSummary() {
    var b = document.getElementById("sb-next"); if (!b || !shellCfg.summary) return;
    b.addEventListener("click", function () {
      var s = shellCfg.summary; if (s.ready && !s.ready()) { if (s.onBlocked) s.onBlocked(); return; }
      if (s.onNext) s.onNext(); if (s.next) location.href = s.next;
    });
  }
  function refreshSummary() { if (shellCfg && shellCfg.summary) { var sb = document.getElementById("summary"); if (sb) { sb.outerHTML = summaryBar(shellCfg.summary); wireSummary(); } } }

  function init(cfg) {
    shellCfg = cfg;
    var sprite = document.createElement("a"); sprite.className = "sr-only"; sprite.href = "#main"; sprite.textContent = t("skip"); document.body.prepend(sprite);
    mountShell(); apply();
  }

  window.LX = {
    add: add, t: t, init: init, apply: apply, onLang: function (f) { hooks.push(f); f(lang); },
    lang: function () { return lang; }, money: money, fmtDate: fmtDate, city: city, dur: dur, ico: ico, flag: flag,
    state: function () { return S; }, save: save, reset: reset, totals: totals, extras: extras,
    fareLabel: fareLabel, fareItems: fareItems, farePrice: farePrice, flightTimes: flightTimes, seatPrice: seatPrice, routeInfo: routeInfo, CITIES: CITIES, DEST: DEST, FARES: FARES, RATE: RATE,
    ensureFare: function () { if (!S.fare) save({ fare: S.cabin === 'business' ? 'elite' : 'classic', cabin: S.cabin === 'business' ? 'business' : 'economy' }); return S; }, refresh: function () { mountShell(); apply(); }, refreshSummary: refreshSummary, setLang: setLang
  };
})();
