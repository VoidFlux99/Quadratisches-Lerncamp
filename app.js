"use strict";

const PUNKTE_PRO_AUFGABE = 10;
const ABZUG_TIPP = 3;
const ABZUG_FALSCH_WAHL = 5;
const SPEICHER_KEY = "lerncamp-v1";

const app = document.getElementById("app");
let stand = laden();
let ansicht = { art: "start" };
let startMeldung = "";

// ---------- Speichern ----------
function laden() {
  try {
    const s = JSON.parse(localStorage.getItem(SPEICHER_KEY));
    if (s && s.tage && s.aufgaben) return s;
  } catch (e) {}
  return { tage: {}, aufgaben: {} };
}
function speichern() {
  try { localStorage.setItem(SPEICHER_KEY, JSON.stringify(stand)); } catch (e) {}
}
function aState(t, i) {
  const k = t + "-" + i;
  if (!stand.aufgaben[k]) stand.aufgaben[k] = { geloest: false, tipps: 0, abzug: 0, punkte: 0, gezeigt: false, falsch: [] };
  return stand.aufgaben[k];
}
function aStateLesen(t, i) { return stand.aufgaben[t + "-" + i]; }

// ---------- Mathe: Terme lesen ----------
function norm(s) {
  return String(s).toLowerCase()
    .replace(/\s+/g, "")
    .replace(/²/g, "^2").replace(/\*\*/g, "^")
    .replace(/[−–—]/g, "-").replace(/[·⋅×]/g, "*")
    .replace(/^[fghy](\(x\))?=/, "");
}

// Wandelt einen Term in eine Funktion x → Wert um. Wirft einen Fehler bei unlesbarer Eingabe.
function termFunktion(src) {
  const s = src; let i = 0;
  const istStart = (c) => c === "x" || c === "(" || /[0-9]/.test(c || "");
  function expr() {
    let v = term();
    while (s[i] === "+" || s[i] === "-") {
      const op = s[i++]; const r = term(); const l = v;
      v = op === "+" ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
    }
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      const c = s[i];
      if (c === "*" || c === "/") {
        i++; const r = unary(); const l = v;
        v = c === "*" ? (x) => l(x) * r(x) : (x) => l(x) / r(x);
      } else if (istStart(c)) {
        const r = power(); const l = v; v = (x) => l(x) * r(x);
      } else break;
    }
    return v;
  }
  function unary() {
    if (s[i] === "-") { i++; const r = unary(); return (x) => -r(x); }
    if (s[i] === "+") { i++; return unary(); }
    return power();
  }
  function power() {
    const b = atom();
    if (s[i] === "^") { i++; const e = unary(); return (x) => Math.pow(b(x), e(x)); }
    return b;
  }
  function atom() {
    const c = s[i];
    if (c === "(") { i++; const v = expr(); if (s[i] !== ")") throw new Error("Klammer"); i++; return v; }
    if (c === "x") { i++; return (x) => x; }
    const m = /^\d+(?:[.,]\d+)?/.exec(s.slice(i));
    if (m) { i += m[0].length; const n = parseFloat(m[0].replace(",", ".")); return () => n; }
    throw new Error("Zeichen");
  }
  const f = expr();
  if (i !== s.length || s.length === 0) throw new Error("Rest");
  return f;
}

function gleichwertig(a, b) {
  const fa = termFunktion(norm(a)), fb = termFunktion(norm(b));
  for (const x of [-3.7, -2.2, -0.9, 0.4, 1.3, 2.6, 4.1]) {
    const u = fa(x), w = fb(x);
    if (!isFinite(u) || Math.abs(u - w) > 1e-6 * Math.max(1, Math.abs(w))) return false;
  }
  return true;
}

function zahl(s) {
  const n = norm(s);
  if (!n || n.includes("x")) return NaN;
  try { return termFunktion(n)(0); } catch (e) { return NaN; }
}

const NUM = "\\d+(?:[.,]\\d+)?(?:\\/\\d+(?:[.,]\\d+)?)?";
const FORMEN = {
  binom: /^[+-]?\(.*x.*\)\^2$/,
  spf: new RegExp("^[+-]?(?:" + NUM + "\\*?)?(?:\\(x[+-]" + NUM + "\\)|x)\\^2(?:[+-]" + NUM + ")?$"),
};
const FORM_TEXT = {
  binom: "Der Term stimmt, aber schreibe ihn bitte als Quadrat einer Klammer, z. B. (x+3)^2.",
  spf: "Der Term stimmt, aber schreibe ihn bitte in Scheitelpunktform a(x−d)² + e, z. B. (x−2)^2+3.",
};

// ---------- Antwort prüfen ----------
// Rückgabe: {ok: true} oder {ok: false, text: "..."}
function pruefe(a, eingabe) {
  if (a.typ === "term") {
    const n = norm(eingabe.wert);
    if (!n) return { ok: false, text: "Gib zuerst eine Antwort ein." };
    try { termFunktion(n); } catch (e) {
      return { ok: false, text: "Das kann ich nicht lesen. Schreibe z. B. (x+3)^2 oder 2(x-1)^2+4." };
    }
    if (!gleichwertig(n, a.ziel)) return { ok: false, text: "Leider noch nicht richtig. Versuch es nochmal oder hol dir einen Tipp." };
    if (a.form && !FORMEN[a.form].test(n)) return { ok: false, text: FORM_TEXT[a.form], fast: true };
    return { ok: true };
  }
  if (a.typ === "punkt") {
    const x = zahl(eingabe.x), y = zahl(eingabe.y);
    if (isNaN(x) || isNaN(y)) return { ok: false, text: "Trage beide Koordinaten als Zahl ein, z. B. −2 und 3." };
    const xOk = Math.abs(x - a.ziel[0]) < 1e-6, yOk = Math.abs(y - a.ziel[1]) < 1e-6;
    if (xOk && yOk) return { ok: true };
    if (xOk) return { ok: false, text: "Der x-Wert stimmt schon, der y-Wert noch nicht." };
    if (yOk) return { ok: false, text: "Der y-Wert stimmt schon, der x-Wert noch nicht. Denk ans Vorzeichen!" };
    return { ok: false, text: "Leider noch nicht richtig. Versuch es nochmal oder hol dir einen Tipp." };
  }
  if (a.typ === "menge") {
    const roh = String(eingabe.wert).trim().toLowerCase();
    if (!roh) return { ok: false, text: "Gib zuerst eine Antwort ein." };
    let werte = [];
    if (!/keine|leer|∅|\{\s*\}/.test(roh)) {
      const teile = roh.replace(/,\s+/g, ";").split(/;|\bund\b|\boder\b|\|/).map((t) => t.trim()).filter(Boolean);
      for (const t of teile) {
        const n = zahl(t.replace(/^x\s*_?\d*\s*=/, ""));
        if (isNaN(n)) return { ok: false, text: "Das kann ich nicht lesen. Beispiel: -2; 3  (oder: keine)" };
        if (!werte.some((w) => Math.abs(w - n) < 1e-6)) werte.push(n);
      }
    }
    const ziel = a.ziel;
    const treffer = werte.filter((w) => ziel.some((z) => Math.abs(z - w) < 1e-6)).length;
    if (treffer === werte.length && werte.length === ziel.length) return { ok: true };
    if (ziel.length === 0) return { ok: false, text: "Leider nicht richtig. Prüfe, ob es überhaupt eine Lösung gibt." };
    if (werte.length === 0) return { ok: false, text: "Es gibt doch eine Lösung. Rechne nochmal nach." };
    if (treffer === werte.length && werte.length < ziel.length) return { ok: false, text: "Richtig, aber es fehlt noch eine Lösung!" };
    if (treffer > 0) return { ok: false, text: "Eine Lösung stimmt, eine andere nicht." };
    return { ok: false, text: "Leider noch nicht richtig. Versuch es nochmal oder hol dir einen Tipp." };
  }
  return { ok: false, text: "" };
}

function punkteFuer(st) {
  if (st.gezeigt) return 0;
  return Math.max(0, PUNKTE_PRO_AUFGABE - ABZUG_TIPP * st.tipps - st.abzug);
}

// ---------- Übersicht ----------
function maxFertig() {
  let m = 0;
  for (const k of Object.keys(stand.tage)) m = Math.max(m, Number(k));
  return m;
}
function freigeschaltet(t) { return t <= maxFertig() + 1 || !!stand.tage[t]; }

function summen() {
  let punkte = 0, tipps = 0, fertig = 0;
  for (const tag of TAGE) {
    const r = stand.tage[tag.nr];
    if (r) { punkte += r.punkte; tipps += r.tipps; fertig++; continue; }
    tag.aufgaben.forEach((_, i) => {
      const st = aStateLesen(tag.nr, i);
      if (!st) return;
      if (st.geloest) punkte += st.punkte;
      tipps += st.tipps;
    });
  }
  return { punkte, tipps, fertig };
}

function geloestAnzahl(t) {
  return TAGE[t - 1].aufgaben.filter((_, i) => (aStateLesen(t, i) || {}).geloest).length;
}

function renderStart() {
  const s = summen();
  const karten = TAGE.map((tag) => {
    const r = stand.tage[tag.nr];
    const frei = freigeschaltet(tag.nr);
    const n = geloestAnzahl(tag.nr);
    let status, klasse = "";
    if (r) { status = `✓ geschafft · ${r.punkte} Punkte`; klasse = "fertig"; }
    else if (!frei) { status = `🔒 erst Tag ${tag.nr - 1} schaffen`; klasse = "zu"; }
    else if (n > 0) { status = `angefangen · ${n} von ${tag.aufgaben.length}`; klasse = "offen"; }
    else { status = "los geht's →"; klasse = "offen"; }
    return `<button class="karte ${klasse}" ${frei ? `data-act="tag" data-tag="${tag.nr}"` : "disabled"}>
      <span class="karte-kopf"><span class="tagnr">Tag ${tag.nr}</span><span class="datum">${tag.datum}</span></span>
      <span class="karte-titel">${tag.titel}</span>
      <span class="karte-status">${status}</span>
    </button>`;
  }).join("");

  app.innerHTML = `
    <header class="kopf">
      <h1>Quadratisches Lerncamp</h1>
      <p class="sub">Jeden Tag 10–20 Minuten bis zur Klausur am <b>Do 26.11.</b></p>
    </header>
    <section class="stats">
      <div class="stat"><span class="zahl">${s.punkte}</span><span>Punkte</span></div>
      <div class="stat"><span class="zahl">${s.tipps}</span><span>Tipps gebraucht</span></div>
      <div class="stat"><span class="zahl">${s.fertig}/${TAGE.length}</span><span>Tage geschafft</span></div>
    </section>
    <section class="regeln">
      Jede Aufgabe bringt <b>${PUNKTE_PRO_AUFGABE} Punkte</b>. Ein Tipp kostet ${ABZUG_TIPP} Punkte,
      ein falscher Klick bei Auswahlaufgaben ${ABZUG_FALSCH_WAHL}. Falsche Eingaben sonst kosten nichts, probier ruhig!
      Am Ende jedes Tages bekommst du ein <b>Lösungswort</b>.
    </section>
    <section class="tage">${karten}</section>
    <section class="box">
      <h2>Lösungswort einlösen</h2>
      <p>Dein Fortschritt ist weg (anderes Gerät, Browser gelöscht)? Gib deine Lösungswörter hier ein.</p>
      <div class="reihe">
        <input id="codeIn" placeholder="z. B. BINOM-K7QXA" autocomplete="off" autocapitalize="characters">
        <button class="knopf" data-act="code">Einlösen</button>
      </div>
      <p class="meldung">${startMeldung}</p>
    </section>
    <footer><button class="link" data-act="reset">Fortschritt zurücksetzen</button></footer>`;
  startMeldung = "";
  const inp = document.getElementById("codeIn");
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") codeEinloesen(); });
}

function codeEinloesen() {
  const wert = document.getElementById("codeIn").value;
  const d = lcDecode(wert);
  if (!d) startMeldung = `<span class="falsch">Dieses Lösungswort kenne ich nicht. Tippfehler?</span>`;
  else if (stand.tage[d.tag]) startMeldung = `Tag ${d.tag} ist schon eingetragen.`;
  else {
    stand.tage[d.tag] = { punkte: d.punkte, tipps: d.tipps, code: lcEncode(d.tag, d.punkte, d.tipps) };
    speichern();
    startMeldung = `<span class="richtig">Tag ${d.tag} eingetragen: ${d.punkte} Punkte, ${d.tipps} Tipps.</span>`;
  }
  renderStart();
}

// ---------- Aufgabe ----------
function ersteOffene(t) {
  const idx = TAGE[t - 1].aufgaben.findIndex((_, i) => !(aStateLesen(t, i) || {}).geloest);
  return idx;
}

function tagOeffnen(t) {
  if (stand.tage[t]) { ansicht = { art: "fertig", tag: t }; return render(); }
  const i = ersteOffene(t);
  ansicht = i < 0 ? { art: "fertig", tag: t } : { art: "aufgabe", tag: t, i };
  if (i < 0) abschliessen(t);
  render();
}

function eingabeHtml(a, st, i) {
  if (a.typ === "wahl") {
    return `<div class="optionen">${a.optionen.map((o, k) => {
      const falsch = st && st.falsch.includes(k);
      return `<button class="option ${falsch ? "falsch-opt" : ""}" data-act="wahl" data-o="${k}" ${falsch ? "disabled" : ""}>${o}</button>`;
    }).join("")}</div>`;
  }
  if (a.typ === "punkt") {
    return `<div class="punkt-eingabe">S( <input id="px" class="klein" inputmode="text" aria-label="x-Wert" placeholder="x">
      | <input id="py" class="klein" inputmode="text" aria-label="y-Wert" placeholder="y"> )</div>`;
  }
  const ph = a.typ === "menge" ? "z. B. -2; 3   oder   keine" : (a.form === "binom" ? "z. B. (x+3)^2" : "z. B. 2(x-1)^2+4");
  const tasten = a.typ === "term"
    ? `<div class="tasten">${["x", "²", "(", ")", "+", "−"].map((t) => `<button class="taste" data-act="taste" data-t="${t}">${t}</button>`).join("")}</div>`
    : `<div class="tasten">${["−", ";", "keine"].map((t) => `<button class="taste" data-act="taste" data-t="${t}">${t}</button>`).join("")}</div>`;
  return `<input id="antwort" class="gross" placeholder="${ph}" autocomplete="off" autocapitalize="off" spellcheck="false">${tasten}`;
}

function renderAufgabe() {
  const { tag: t, i } = ansicht;
  const tag = TAGE[t - 1];
  const a = tag.aufgaben[i];
  const st = aStateLesen(t, i);
  const tagFertig = !!stand.tage[t];
  const geloest = st && st.geloest;

  const punkte = tag.aufgaben.map((_, j) => {
    const sj = aStateLesen(t, j) || {};
    const kl = (j === i ? "aktiv " : "") + (sj.geloest ? "ok" : "");
    const darf = tagFertig || sj.geloest || j === ersteOffene(t);
    return `<button class="dot ${kl}" ${darf ? `data-act="springe" data-i="${j}"` : "disabled"} aria-label="Aufgabe ${j + 1}">${j + 1}</button>`;
  }).join("");

  let unten;
  if (geloest || tagFertig) {
    const info = !st || !st.geloest ? "" : st.gezeigt
      ? `<div class="erfolg neutral">Lösung angezeigt · 0 Punkte</div>`
      : `<div class="erfolg">Richtig! +${st.punkte} Punkte</div>`;
    const letzte = ersteOffene(t) < 0;
    const weiter = tagFertig
      ? (i < tag.aufgaben.length - 1 ? `<button class="knopf" data-act="springe" data-i="${i + 1}">Nächste Aufgabe</button>` : `<button class="knopf" data-act="fertig">Zum Lösungswort</button>`)
      : `<button class="knopf" data-act="weiter">${letzte ? "Tag abschließen 🎉" : "Weiter →"}</button>`;
    unten = `${info}<div class="loesung"><b>Lösung:</b> ${a.loesung}</div><div class="reihe">${weiter}</div>`;
  } else {
    const s = st || { tipps: 0 };
    const tippsGezeigt = a.tipps.slice(0, s.tipps).map((tp, k) => `<div class="tipp"><b>Tipp ${k + 1}:</b> ${tp}</div>`).join("");
    const rest = a.tipps.length - s.tipps;
    const knoepfe = [
      a.typ !== "wahl" ? `<button class="knopf" data-act="pruefen">Prüfen</button>` : "",
      rest > 0 ? `<button class="knopf zweit" data-act="tipp">💡 Tipp holen (−${ABZUG_TIPP})</button>`
               : `<button class="knopf zweit" data-act="zeigen">Lösung zeigen (0 Punkte)</button>`,
    ].join("");
    unten = `${eingabeHtml(a, st, i)}<div class="reihe">${knoepfe}</div><div id="fb" class="meldung"></div>${tippsGezeigt}`;
  }

  app.innerHTML = `
    <nav class="leiste">
      <button class="link" data-act="start">← Übersicht</button>
      <span>Tag ${t} · ${tag.titel}</span>
    </nav>
    <div class="dots">${punkte}</div>
    <details class="intro" ${i === 0 && !geloest ? "open" : ""}><summary>Worum geht's heute?</summary><p>${tag.intro}</p></details>
    <article class="aufgabe">
      <div class="nr">Aufgabe ${i + 1} von ${tag.aufgaben.length}</div>
      <p class="frage">${a.frage}</p>
      ${unten}
    </article>`;

  const feld = document.getElementById("antwort") || document.getElementById("px");
  if (feld) {
    feld.focus();
    app.querySelectorAll("input").forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter") antwortPruefen(); }));
  }
}

function meldung(text, klasse) {
  const fb = document.getElementById("fb");
  if (fb) fb.innerHTML = `<span class="${klasse}">${text}</span>`;
}

function antwortPruefen(wahlIndex) {
  const { tag: t, i } = ansicht;
  const a = TAGE[t - 1].aufgaben[i];
  const st = aState(t, i);
  if (a.typ === "wahl") {
    if (wahlIndex === a.richtig) return geloest(st);
    if (!st.falsch.includes(wahlIndex)) { st.falsch.push(wahlIndex); st.abzug += ABZUG_FALSCH_WAHL; }
    speichern(); render();
    return meldung(`Leider falsch (−${ABZUG_FALSCH_WAHL} Punkte). Versuch es nochmal!`, "falsch");
  }
  const eingabe = a.typ === "punkt"
    ? { x: document.getElementById("px").value, y: document.getElementById("py").value }
    : { wert: document.getElementById("antwort").value };
  const r = pruefe(a, eingabe);
  if (r.ok) return geloest(st);
  speichern();
  meldung(r.text, r.fast ? "fast" : "falsch");
  const fb = document.getElementById("fb");
  if (fb) { fb.classList.remove("wackel"); void fb.offsetWidth; fb.classList.add("wackel"); }
}

function geloest(st) {
  st.geloest = true;
  st.punkte = punkteFuer(st);
  speichern();
  render();
}

function abschliessen(t) {
  if (stand.tage[t]) return;
  let punkte = 0, tipps = 0;
  TAGE[t - 1].aufgaben.forEach((_, i) => {
    const st = aStateLesen(t, i) || {};
    punkte += st.punkte || 0;
    tipps += st.tipps || 0;
  });
  stand.tage[t] = { punkte, tipps, code: lcEncode(t, punkte, tipps) };
  speichern();
}

// ---------- Tag geschafft ----------
function renderFertig() {
  const t = ansicht.tag;
  const tag = TAGE[t - 1];
  const r = stand.tage[t];
  const max = tag.aufgaben.length * PUNKTE_PRO_AUFGABE;
  const naechster = TAGE[t];
  app.innerHTML = `
    <nav class="leiste"><button class="link" data-act="start">← Übersicht</button><span>Tag ${t} · ${tag.titel}</span></nav>
    <article class="aufgabe fertig-box">
      <div class="gross-emoji">🎉</div>
      <h2>Tag ${t} geschafft!</h2>
      <p><b>${r.punkte}</b> von ${max} Punkten · <b>${r.tipps}</b> ${r.tipps === 1 ? "Tipp" : "Tipps"} gebraucht</p>
      <p>Dein Lösungswort:</p>
      <div class="code" id="code">${r.code}</div>
      <div class="reihe mitte">
        <button class="knopf" data-act="kopieren">Kopieren</button>
        <button class="knopf zweit" data-act="springe" data-i="0">Aufgaben ansehen</button>
      </div>
      <p class="klein-text">Schick das Lösungswort an deinen Nachhilfelehrer.</p>
      ${naechster ? `<p class="naechster">Als Nächstes: <b>Tag ${naechster.nr} – ${naechster.titel}</b> (am ${naechster.datum})</p>`
                  : `<p class="naechster"><b>Du hast alle Tage geschafft. Viel Erfolg in der Klausur! 🍀</b></p>`}
      <p id="fb" class="meldung"></p>
    </article>`;
}

// ---------- Steuerung ----------
function render() {
  if (ansicht.art === "start") renderStart();
  else if (ansicht.art === "aufgabe") renderAufgabe();
  else renderFertig();
  window.scrollTo(0, 0);
}

function tasteEinfuegen(text) {
  const el = document.getElementById("antwort");
  if (!el) return;
  if (text === "keine") { el.value = "keine"; el.focus(); return; }
  const ins = text === "−" ? "-" : text === ";" ? "; " : text;
  const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, a) + ins + el.value.slice(b);
  el.focus();
  el.setSelectionRange(a + ins.length, a + ins.length);
}

app.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  if (act === "tag") tagOeffnen(Number(b.dataset.tag));
  else if (act === "start") { ansicht = { art: "start" }; render(); }
  else if (act === "springe") { ansicht = { art: "aufgabe", tag: ansicht.tag, i: Number(b.dataset.i) }; render(); }
  else if (act === "pruefen") antwortPruefen();
  else if (act === "wahl") antwortPruefen(Number(b.dataset.o));
  else if (act === "tipp") {
    const st = aState(ansicht.tag, ansicht.i);
    st.tipps++; speichern(); render();
  } else if (act === "zeigen") {
    const st = aState(ansicht.tag, ansicht.i);
    st.gezeigt = true; geloest(st);
  } else if (act === "weiter") {
    const n = ersteOffene(ansicht.tag);
    if (n < 0) { abschliessen(ansicht.tag); ansicht = { art: "fertig", tag: ansicht.tag }; }
    else ansicht = { art: "aufgabe", tag: ansicht.tag, i: n };
    render();
  } else if (act === "fertig") { ansicht = { art: "fertig", tag: ansicht.tag }; render(); }
  else if (act === "kopieren") {
    const code = stand.tage[ansicht.tag].code;
    const ok = () => meldung("Kopiert ✓", "richtig");
    try { navigator.clipboard.writeText(code).then(ok, () => meldung("Bitte das Wort abschreiben.", "fast")); }
    catch (err) { meldung("Bitte das Wort abschreiben.", "fast"); }
  } else if (act === "taste") tasteEinfuegen(b.dataset.t);
  else if (act === "code") codeEinloesen();
  else if (act === "reset") {
    if (confirm("Wirklich alles zurücksetzen? Punkte und Fortschritt gehen verloren (Lösungswörter kannst du wieder einlösen).")) {
      stand = { tage: {}, aufgaben: {} }; speichern(); ansicht = { art: "start" }; render();
    }
  }
});

render();
