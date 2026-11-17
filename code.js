// Lösungswörter: verschlüsseln Tag, Punkte und Tipps in ein Wort wie "BINOM-K7QXA".
// Ein Prüfwert sorgt dafür, dass ausgedachte Wörter fast immer als ungültig erkannt werden.

const LC_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 Zeichen, ohne 0/O/1/I
const LC_MOD = 1n << 25n;
const LC_MUL = 1103515n; // ungerade → umkehrbar
const LC_ADD = 777777n;
const LC_INV = (() => {
  let inv = LC_MUL;
  for (let k = 0; k < 5; k++) inv = (inv * (2n - LC_MUL * inv)) % LC_MOD;
  return ((inv % LC_MOD) + LC_MOD) % LC_MOD;
})();

function lcPruef(v) { return (v * 373 + 91) % 1024; }

function lcEncode(tag, punkte, tipps) {
  const v = (punkte * 16 + tipps) * 8 + (tag - 1);
  const roh = BigInt(v * 1024 + lcPruef(v));
  let y = (roh * LC_MUL + LC_ADD) % LC_MOD;
  let s = "";
  for (let k = 0; k < 5; k++) { s = LC_ALPHA[Number(y % 32n)] + s; y /= 32n; }
  return TAGE[tag - 1].wort + "-" + s;
}

// Gibt {tag, punkte, tipps} zurück oder null, wenn das Wort ungültig ist.
function lcDecode(text) {
  const t = String(text).toUpperCase().replace(/\s+/g, "");
  const teile = t.split("-");
  const kern = teile[teile.length - 1];
  const wort = teile.length > 1 ? teile.slice(0, -1).join("-") : null;
  if (kern.length !== 5) return null;
  let y = 0n;
  for (const c of kern) {
    const n = LC_ALPHA.indexOf(c);
    if (n < 0) return null;
    y = y * 32n + BigInt(n);
  }
  const roh = Number((((y - LC_ADD) % LC_MOD + LC_MOD) * LC_INV) % LC_MOD);
  const v = Math.floor(roh / 1024);
  if (roh % 1024 !== lcPruef(v)) return null;
  const tag = (v % 8) + 1;
  const tipps = Math.floor(v / 8) % 16;
  const punkte = Math.floor(v / 128);
  const max = TAGE[tag - 1].aufgaben.length;
  if (punkte > max * 10 || tipps > max * 2) return null;
  if (wort && wort !== TAGE[tag - 1].wort) return null;
  return { tag, punkte, tipps };
}
