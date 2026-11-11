// ---------- Rare Reef engine: answer matching, scoring, bots (no DOM) ----------
const TIERS = {
  0: { key: 'seafoam',   name: 'Seafoam',   pts: 10,  meter: 0,   color: '#9fd8e8', emoji: '🫧' },
  D: { key: 'copycat',   name: 'Copycat',   pts: 15,  meter: 0,   color: '#c3b4ff', emoji: '🦜' },
  1: { key: 'reef',      name: 'Reef',      pts: 30,  meter: 20,  color: '#4fd1a5', emoji: '🐠' },
  2: { key: 'rare',      name: 'Rare',      pts: 60,  meter: 35,  color: '#36a8ff', emoji: '🐙' },
  3: { key: 'abyssal',   name: 'Abyssal',   pts: 85,  meter: 65,  color: '#a46bff', emoji: '🦑' },
  4: { key: 'leviathan', name: 'Leviathan', pts: 100, meter: 100, color: '#ffcc33', emoji: '🐋' },
};
const TIER_BLURB = {
  0: 'The answer everyone gives.',
  D: 'Felt clever — but loads of people pick it.',
  1: 'Solid, a little off the beaten path.',
  2: 'Most people won’t think of that.',
  3: 'Deep knowledge. Very few say this.',
  4: 'One in a million. Legendary pull.',
};

function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/&/g, ' and ')
    .replace(/['’`.]/g, '').replace(/[^a-z0-9+#]+/g, ' ').trim()
    .replace(/^(the|a|an) /, '');
}
const keyOf = s => norm(s).replace(/ /g, '');

// edit distance that counts a swapped pair of letters as one typo ("germnay" -> "germany")
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length, m = b.length, d = [];
  for (let i = 0; i <= n; i++) { d[i] = new Array(m + 1).fill(0); d[i][0] = i; }
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    let rowBest = Infinity;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v; if (v < rowBest) rowBest = v;
    }
    if (rowBest > max) return max + 1;
  }
  return d[n][m];
}

// Build one category from its raw row
function buildCategory(raw, id) {
  const [pack, prompt, t0, t1, t2, t3, t4, decoy] = raw;
  const items = [], map = new Map();
  const addKeys = (item, k) => { if (k && !map.has(k)) map.set(k, item); };
  const add = (str, tier) => {
    let s = str.trim(); if (!s) return;
    let trap = false;
    if (s[0] === '!') { trap = true; s = s.slice(1).trim(); }
    const names = s.split('/').map(x => x.trim()).filter(Boolean);
    const keys = names.map(keyOf).filter(Boolean);
    if (keys.some(k => map.has(k) && !map.get(k).trap)) return; // first/decoy occurrence wins
    const item = { name: names[0], keys, tier: trap ? 'X' : tier, trap, idx: items.length };
    items.push(item);
    for (const k of keys) {
      addKeys(item, k);
      if (k.length > 3 && k.endsWith('s')) addKeys(item, k.slice(0, -1)); // "peas" also accepts "pea"
    }
  };
  (decoy || '').split(',').forEach(x => add(x, 'D'));
  [t0, t1, t2, t3, t4].forEach((list, tier) => (list || '').split(',').forEach(x => add(x, tier)));
  const valid = items.filter(i => !i.trap);
  return { id, pack, prompt, items, valid, map };
}

function buildBank(rows) { return rows.map((r, i) => buildCategory(r, i)).filter(c => c.valid.length >= 6); }

// Resolve typed text to an item in the category.
// returns { item, exact } or null. Trap items come back with item.trap === true.
function matchAnswer(cat, text) {
  const k = keyOf(text);
  if (!k) return null;
  const cands = [k];
  if (k.length > 3 && k.endsWith('es')) cands.push(k.slice(0, -2));
  if (k.length > 3 && k.endsWith('s')) cands.push(k.slice(0, -1));
  if (k.length > 3 && k.endsWith('ies')) cands.push(k.slice(0, -3) + 'y');
  for (const c of cands) if (cat.map.has(c)) return { item: cat.map.get(c), exact: true };
  if (k.length < 5) return null;
  const max = k.length >= 9 ? 2 : 1;
  let best = max + 1, bestItem = null, tie = false;
  for (const [key, item] of cat.map) {
    if (key.length < 4) continue;
    const d = lev(k, key, max);
    if (d < best) { best = d; bestItem = item; tie = false; }
    else if (d === best && item !== bestItem) tie = true;
  }
  if (bestItem && best <= max && !tie) return { item: bestItem, exact: false };
  return null;
}

const tierOf = item => TIERS[item.tier];
const pointsOf = item => (item.trap ? 0 : TIERS[item.tier].pts);

function sampleTier(cat, tier, n, exclude) {
  const pool = cat.valid.filter(i => i.tier === tier && i !== exclude);
  const out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// A never-ending shuffled supply of category indexes ("no limit")
class PromptBag {
  constructor(bank, minItems = 0) { this.ids = bank.filter(c => c.valid.length >= minItems).map(c => c.id); this.bag = []; this.last = -1; }
  next() {
    if (!this.bag.length) { this.bag = shuffle(this.ids.slice()); if (this.bag[this.bag.length - 1] === this.last) this.bag.reverse(); }
    this.last = this.bag.pop(); return this.last;
  }
}

// ---------- bots ----------
const BOT_LEVELS = {
  easy:   { label: 'Easy',   weights: [6, 1, 3, 1, 0.2, 0.05], think: [2.4, 5.6], fail: 0.16 },
  normal: { label: 'Normal', weights: [4, 1.2, 4, 2, 0.7, 0.2], think: [1.6, 4.2], fail: 0.09 },
  hard:   { label: 'Hard',   weights: [2, 0.6, 3, 3, 2, 1],     think: [1.0, 3.0], fail: 0.04 },
};
const TIER_ORDER = [0, 'D', 1, 2, 3, 4];
// pick an unused valid item the way a bot of this level would
function botPick(cat, used, level, rnd = Math.random) {
  const L = BOT_LEVELS[level] || BOT_LEVELS.normal;
  const free = cat.valid.filter(i => !used.has(i.idx));
  if (!free.length) return null;
  const byTier = TIER_ORDER.map(t => free.filter(i => i.tier === t));
  const w = byTier.map((list, k) => (list.length ? L.weights[k] : 0));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < w.length; k++) { if ((r -= w[k]) <= 0 && byTier[k].length) return byTier[k][Math.floor(rnd() * byTier[k].length)]; }
  return free[Math.floor(rnd() * free.length)];
}
// plausible wrong guesses bots sometimes type
const BOT_FLUBS = ['umm', 'wait', 'uhh', 'hmm', 'idk', 'no', 'eh'];

if (typeof module !== 'undefined') module.exports = { TIERS, TIER_BLURB, norm, keyOf, lev, buildCategory, buildBank, matchAnswer, tierOf, pointsOf, sampleTier, shuffle, PromptBag, BOT_LEVELS, botPick, BOT_FLUBS };
