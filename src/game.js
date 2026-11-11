(() => {
'use strict';
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = n => Math.round(n).toLocaleString('en-US');

const BANK = buildBank(BANK_RAW);
const PACKS = [...new Set(BANK.map(c => c.pack))];

// ---------- storage (optional) ----------
const store = {
  get() { try { return JSON.parse(localStorage.getItem('rr.v1') || '{}'); } catch { return {}; } },
  set(v) { try { localStorage.setItem('rr.v1', JSON.stringify(v)); } catch {} },
  patch(fn) { const v = this.get(); fn(v); this.set(v); },
};

// ---------- sound ----------
const Sound = {
  ctx: null, muted: !!store.get().muted,
  init() { if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} },
  tone(freq, dur = 0.12, type = 'sine', vol = 0.12, slide = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur = 0.4, vol = 0.35) {
    if (this.muted || !this.ctx) return;
    const n = this.ctx.sampleRate * dur, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900; s.buffer = b; g.gain.value = vol; s.connect(f).connect(g).connect(this.ctx.destination); s.start();
  },
  good(tier) { const base = { 0: 520, D: 560, 1: 620, 2: 700, 3: 800, 4: 900 }[tier] || 600; this.tone(base, .12, 'triangle', .14); setTimeout(() => this.tone(base * 1.5, .18, 'triangle', .12), 90); if (tier === 4 || tier === 3) setTimeout(() => this.tone(base * 2, .25, 'sine', .1), 190); },
  bad() { this.tone(180, .22, 'square', .07, .7); },
  tick(hi) { this.tone(hi ? 1250 : 900, .04, 'square', .035); },
  pop() { this.noise(.5, .5); this.tone(120, .35, 'sine', .3, .4); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, .22, 'triangle', .13), i * 120)); },
  bubble() { this.tone(rand(500, 900), .08, 'sine', .05, 1.8); },
};
document.addEventListener('pointerdown', () => Sound.init(), { once: false });
document.addEventListener('keydown', () => Sound.init(), { once: true });

// ---------- ocean background ----------
const Sea = (() => {
  const cv = $('#sea'), cx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, depth = 0, target = 0, t = 0;
  const bubbles = [], snow = [], parts = [];
  const STOPS = [[0, [52, 170, 222], [13, 95, 145]], [600, [16, 84, 132], [6, 46, 82]], [2000, [8, 40, 78], [4, 18, 40]], [4500, [6, 18, 42], [3, 7, 20]], [7000, [5, 7, 20], [1, 2, 6]]];
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  function colors(d) {
    for (let i = 0; i < STOPS.length - 1; i++) {
      const [d0, t0, b0] = STOPS[i], [d1, t1, b1] = STOPS[i + 1];
      if (d <= d1) { const k = Math.max(0, (d - d0) / (d1 - d0)); return [mix(t0, t1, k), mix(b0, b1, k)]; }
    }
    return [STOPS[STOPS.length - 1][1], STOPS[STOPS.length - 1][2]];
  }
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  addEventListener('resize', resize); resize();
  for (let i = 0; i < 38; i++) bubbles.push({ x: Math.random(), y: Math.random(), r: rand(1.5, 6), s: rand(14, 46), w: rand(0, 6) });
  for (let i = 0; i < 90; i++) snow.push({ x: Math.random(), y: Math.random(), r: rand(.6, 1.8), s: rand(4, 12) });
  function burst(x, y, color, n = 26, power = 1) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = rand(120, 420) * power; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, r: rand(3, 8), c: color }); }
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    depth += (target - depth) * Math.min(1, dt * 1.6);
    const [top, bot] = colors(depth);
    const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgb(${top})`); g.addColorStop(1, `rgb(${bot})`);
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    const light = Math.max(0, 1 - depth / 900);
    if (light > 0) { // sun rays near the surface
      cx.save(); cx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const x = (i / 6 + Math.sin(t * .15 + i) * .04) * W, w = W * .07;
        const rg = cx.createLinearGradient(0, 0, 0, H * .9); rg.addColorStop(0, `rgba(190,240,255,${.10 * light})`); rg.addColorStop(1, 'rgba(190,240,255,0)');
        cx.fillStyle = rg; cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x + w, 0); cx.lineTo(x + w * 2.4 - W * .1, H * .9); cx.lineTo(x - W * .1, H * .9); cx.fill();
      }
      cx.restore();
    }
    const deep = Math.min(1, depth / 2500);
    cx.fillStyle = `rgba(220,240,255,${.25 + .35 * deep})`;
    for (const p of snow) { p.y += p.s * dt / H * (0.6 + deep); if (p.y > 1) { p.y = 0; p.x = Math.random(); } cx.beginPath(); cx.arc(p.x * W + Math.sin(t + p.y * 9) * 6, p.y * H, p.r, 0, 7); cx.fill(); }
    for (const b of bubbles) {
      b.y -= b.s * dt / H; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); }
      const x = b.x * W + Math.sin(t * 1.3 + b.w) * 8, y = b.y * H;
      cx.strokeStyle = `rgba(255,255,255,${.25 + .1 * light})`; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(x, y, b.r, 0, 7); cx.stroke();
      cx.fillStyle = 'rgba(255,255,255,.35)'; cx.beginPath(); cx.arc(x - b.r * .35, y - b.r * .35, b.r * .28, 0, 7); cx.fill();
    }
    if (depth > 3500) { // bioluminescent specks in the abyss
      const k = Math.min(1, (depth - 3500) / 2500);
      for (let i = 0; i < 14; i++) { const x = (Math.sin(i * 91.7 + t * .07) * .5 + .5) * W, y = (Math.cos(i * 37.3 + t * .05) * .5 + .5) * H, a = (Math.sin(t * 2 + i) * .5 + .5) * k;
        cx.fillStyle = `rgba(110,255,230,${a * .7})`; cx.beginPath(); cx.arc(x, y, 2.2, 0, 7); cx.fill(); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt * 1.4; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vx *= .96; p.vy = p.vy * .96 + 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      cx.globalAlpha = Math.max(0, p.life); cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r * p.life + 1, 0, 7); cx.fill(); cx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { set(d, instant) { target = d; if (instant) depth = d; }, burst };
})();

// ---------- screens ----------
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function flash(kind = 'red') { const f = $('#flash'); f.className = kind === 'white' ? 'on white' : 'on'; setTimeout(() => f.className = '', kind === 'white' ? 120 : 260); }
function modal(html, onMount) { const m = $('#modal'), c = $('#modalCard'); c.innerHTML = html; m.hidden = false; onMount && onMount(c); }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
const tierChip = (tier, txt) => { const T = TIERS[tier]; return `<span class="tchip" style="background:${T.color}">${T.emoji} ${esc(txt ?? T.name)}</span>`; };

// ---------- home ----------
let packSel = new Set(store.get().packs || []);
function renderHome() {
  Sea.set(80);
  const packs = $('#packs'); packs.innerHTML = '';
  const all = el('button', 'pack' + (packSel.size === 0 ? ' on' : ''), 'All packs'); all.onclick = () => { packSel.clear(); savePacks(); };
  packs.append(all);
  for (const p of PACKS) { const b = el('button', 'pack' + (packSel.has(p) ? ' on' : ''), esc(p)); b.onclick = () => { packSel.has(p) ? packSel.delete(p) : packSel.add(p); if (packSel.size === PACKS.length) packSel.clear(); savePacks(); }; packs.append(b); }
  const s = store.get();
  $('#stats').innerHTML = `<div class="stat"><b>${fmt(s.bestDepth || 0)} m</b><span>Deepest dive</span></div><div class="stat"><b>${s.bestEndless || 0}</b><span>Endless best</span></div><div class="stat"><b>${s.dives || 0}</b><span>Dives</span></div><div class="stat"><b>${s.partyWins || 0}</b><span>Puffer wins</span></div>`;
  $('#legend').innerHTML = [0, 'D', 1, 2, 3, 4].map(k => tierChip(k, `${TIERS[k].name} ${TIERS[k].pts}`)).join('');
  show('home');
}
function savePacks() { store.patch(v => v.packs = [...packSel]); renderHome(); }
const catPool = () => BANK.filter(c => packSel.size === 0 || packSel.has(c.pack));
$('#howBtn').onclick = () => modal(`<h3>How scoring works</h3><p>Every prompt has hundreds of correct answers. Obvious ones barely count; rare ones send you deep. Every point is 10 m of depth.</p>
  ${[0, 'D', 1, 2, 3, 4].map(k => `<div class="trow">${tierChip(k)}<div><b>${TIERS[k].pts} pts</b> · ${TIERS[k].pts * 10} m<br><small>${TIER_BLURB[k]}</small></div></div>`).join('')}
  <p><b>Typos are fine</b>: small spelling slips and plurals still count. A wrong answer doesn't cost anything while the clock runs, so try again.</p>
  <button class="cta blue" onclick="document.getElementById('modal').hidden=true">Got it</button>`);
$('#goDive').onclick = () => startDive('dive');
$('#goEndless').onclick = () => startDive('endless');
$('#goParty').onclick = () => openSetup();

// ---------- DIVE ----------
const ZONES = [[0, 'Sunlight Zone'], [200, 'Twilight Zone'], [1000, 'Midnight Zone'], [4000, 'Abyssal Zone'], [6000, 'Hadal Trench']];
const zoneOf = m => ZONES.filter(z => m >= z[0]).pop()[1];
const ROUND_TIME = 25;
let D = null;
function startDive(mode) {
  const pool = catPool();
  D = { mode, rounds: [], points: 0, depth: 0, lives: 3, bag: new PromptBag(pool), total: mode === 'dive' ? 7 : Infinity, timer: 0, live: false };
  Sea.set(0, true);
  buildGauge();
  show('dive');
  nextRound();
}
function buildGauge() {
  const tr = $('#gaugeTrack'); tr.innerHTML = '';
  const max = gaugeMax();
  for (const [m, name] of ZONES) { const i = el('i', null, name.replace(' Zone', '')); i.style.top = (m / max * 100) + '%'; tr.append(i); }
  const i = el('i', null, fmt(max) + ' m'); i.style.top = '100%'; tr.append(i);
}
const gaugeMax = () => Math.max(7000, Math.ceil((D ? D.depth + 1500 : 0) / 1000) * 1000);
function updateDepth() {
  $('#depthLbl').textContent = fmt(D.depth) + ' m';
  const max = gaugeMax(); if (max !== D._gmax) { D._gmax = max; buildGauge(); }
  $('#gaugeSub').style.top = Math.min(100, D.depth / max * 100) + '%';
  Sea.set(D.depth);
}
function nextRound() {
  const cat = BANK[D.bag.next()];
  D.cat = cat; D.timeLeft = ROUND_TIME; D.live = true; D.tries = 0;
  const n = D.rounds.length + 1;
  $('#roundLbl').textContent = D.mode === 'dive' ? `${n} / ${D.total}` : `Prompt ${n}`;
  $('#lives').innerHTML = D.mode === 'endless' ? [0, 1, 2].map(i => `<span class="${i < D.lives ? '' : 'gone'}">🫧</span>`).join('') : '';
  $('#packChip').textContent = cat.pack;
  $('#promptTxt').textContent = cat.prompt;
  $('#msg').textContent = ''; $('#msg').className = 'msg';
  $('#reveal').innerHTML = '';
  $('#promptCard').style.display = '';
  const inp = $('#answer'); inp.value = ''; inp.disabled = false; inp.focus();
  updateDepth();
  const card = $('#promptCard'); card.classList.remove('shake'); card.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' });
  cancelAnimationFrame(D.timer); let last = performance.now();
  const tick = now => {
    if (!D || !D.live) return;
    D.timeLeft -= (now - last) / 1000; last = now;
    const f = Math.max(0, D.timeLeft / ROUND_TIME);
    $('#timerFill').style.transform = `scaleX(${f})`;
    $('#timerTxt').textContent = Math.ceil(Math.max(0, D.timeLeft));
    $('.timer').classList.toggle('low', D.timeLeft < 6);
    if (D.timeLeft <= 0) return finishRound(null, 'time');
    D.timer = requestAnimationFrame(tick);
  };
  D.timer = requestAnimationFrame(tick);
}
$('#answerForm').addEventListener('submit', e => {
  e.preventDefault(); if (!D || !D.live) return;
  const txt = $('#answer').value.trim(); if (!txt) return;
  const r = matchAnswer(D.cat, txt);
  const msg = $('#msg');
  if (!r) { D.tries++; msg.textContent = D.tries > 1 ? 'Still not on our list. Try something else!' : 'Not on our list. Check the spelling or try another.'; msg.className = 'msg'; bump('#promptCard'); Sound.bad(); $('#answer').select(); return; }
  if (r.item.trap) { msg.textContent = `Nice try, but ${r.item.name} doesn't count here!`; msg.className = 'msg'; bump('#promptCard'); Sound.bad(); $('#answer').select(); return; }
  finishRound(r.item, 'answer', txt);
});
$('#passBtn').onclick = () => D && D.live && finishRound(null, 'pass');
function bump(sel) { const n = $(sel); n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake'); }
function finishRound(item, why, typed) {
  D.live = false; cancelAnimationFrame(D.timer);
  $('#answer').disabled = true;
  const pts = item ? pointsOf(item) : 0;
  D.points += pts; D.depth += pts * 10;
  D.rounds.push({ prompt: D.cat.prompt, item, typed, pts });
  if (!item && D.mode === 'endless') D.lives--;
  const over = D.mode === 'dive' ? D.rounds.length >= D.total : D.lives <= 0;
  const T = item && tierOf(item);
  const rare = [...sampleTier(D.cat, 4, 2, item), ...sampleTier(D.cat, 3, 2, item)].slice(0, 4);
  const common = sampleTier(D.cat, 0, 3, item);
  const pill = i => `<span class="ans" style="background:${TIERS[i.tier].color}">${esc(i.name)}</span>`;
  $('#promptCard').style.display = 'none';
  $('#reveal').innerHTML = (item
    ? `<div class="tier-card" style="background:linear-gradient(160deg, ${T.color}, ${shade(T.color)})"><div class="t-emoji">${T.emoji}</div><div class="t-name">${T.name}</div><div class="t-ans">“${esc(item.name)}” · ${esc(D.cat.prompt)}</div><div class="t-pts">+${pts} pts · +${fmt(pts * 10)} m</div><div class="t-blurb">${TIER_BLURB[item.tier]}</div></div>`
    : `<div class="tier-card miss"><div class="t-emoji">${why === 'time' ? '⏱️' : '🪨'}</div><div class="t-name">${why === 'time' ? 'Out of time' : 'Passed'}</div><div class="t-ans">${esc(D.cat.prompt)}</div><div class="t-pts">+0 m${D.mode === 'endless' ? ` · ${D.lives} air left` : ''}</div></div>`)
    + `<div class="alts">${rare.length ? `<div class="alt"><b>Rarer catches you could have said</b>${rare.map(pill).join('')}</div>` : ''}<div class="alt"><b>What most people say</b>${common.map(pill).join('')}</div></div>`
    + `<button class="cta blue next" id="nextBtn">${over ? 'See my dive ↓' : 'Next prompt ↓'}</button>`;
  if (item) { Sound.good(item.tier); if (item.tier === 4 || item.tier === 3) { const r = $('.tier-card').getBoundingClientRect(); Sea.burst(r.left + r.width / 2, r.top + 40, T.color, 30); } }
  else Sound.bad();
  updateDepth();
  const nb = $('#nextBtn'); nb.onclick = () => (over ? showResults() : nextRound()); setTimeout(() => nb.focus(), 50);
}
function shade(hex) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.round(v * .78)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
$('#diveBack').onclick = () => { if (D) { D.live = false; cancelAnimationFrame(D.timer); } renderHome(); };

function showResults() {
  const s = store.get();
  const newBest = D.mode === 'dive' ? D.depth > (s.bestDepth || 0) : D.rounds.length > (s.bestEndless || 0);
  store.patch(v => { v.dives = (v.dives || 0) + 1; if (D.mode === 'dive') v.bestDepth = Math.max(v.bestDepth || 0, D.depth); else v.bestEndless = Math.max(v.bestEndless || 0, D.rounds.filter(r => r.item).length); });
  const emo = D.rounds.map(r => (r.item ? TIERS[r.item.tier].emoji : '⬛')).join('');
  const share = `🌊 Rare Reef ${D.mode === 'dive' ? 'Dive' : 'Endless'}\n${fmt(D.depth)} m · ${zoneOf(D.depth)}${D.mode === 'endless' ? ` · ${D.rounds.length} prompts` : ''}\n${emo}`;
  const wrap = $('#resWrap');
  wrap.innerHTML = `<div class="topbar"><button class="icon-btn" id="resBack">←</button><div class="round">${D.mode === 'dive' ? 'Dive complete' : 'Out of air'}</div><div></div></div>
    <div class="res-hero"><div class="zone">${zoneOf(D.depth)}${newBest ? ' · new best!' : ''}</div><div class="big-num">${fmt(D.depth)} m</div><div class="sub">${fmt(D.points)} points${D.mode === 'endless' ? ` · ${D.rounds.length} prompts` : ''}</div><div class="emoji-row">${emo}</div></div>
    <div class="res-btns"><button class="cta blue" id="again">Dive again</button><button class="cta ghost" id="copyBtn">Copy result</button></div>
    <div class="res-list">${D.rounds.map(r => `<div class="res-row"><div class="q">${esc(r.prompt)}</div><div class="a">${r.item ? esc(r.item.name) : '—'}</div><div class="p">${r.item ? tierChip(r.item.tier, '+' + r.pts) : '<span class="tchip" style="background:#5b6b78;color:#fff">+0</span>'}</div></div>`).join('')}</div>
    <button class="cta ghost" id="toParty">🐡 Try Puffer Panic</button>`;
  Sea.set(D.depth);
  show('results');
  if (newBest) Sound.win();
  $('#again').onclick = () => startDive(D.mode);
  $('#resBack').onclick = renderHome;
  $('#toParty').onclick = openSetup;
  $('#copyBtn').onclick = async () => {
    try { await navigator.clipboard.writeText(share); $('#copyBtn').textContent = 'Copied ✓'; }
    catch { modal(`<h3>Your result</h3><p>Copy this:</p><textarea style="width:100%;height:120px;border-radius:14px;padding:12px;font:600 15px Inter;background:#06202f;color:#fff;border:1px solid #2a4a5e">${esc(share)}</textarea><button class="cta blue" onclick="document.getElementById('modal').hidden=true">Done</button>`, c => c.querySelector('textarea').select()); }
  };
}

// ---------- PUFFER PANIC ----------
const COLORS = ['#ff6b5a', '#36a8ff', '#4fd1a5', '#ffb020', '#a46bff', '#ff5fa2', '#22c3d6', '#8bc34a'];
const BOT_NAMES = ['Bubbles', 'Coral', 'Finn', 'Pearl', 'Kelp', 'Shelly', 'Inky', 'Ripple', 'Gill', 'Misty', 'Squirt', 'Wade'];
const SPEEDS = { chill: { start: 15, step: .5, min: 7 }, normal: { start: 12, step: .6, min: 5 }, frantic: { start: 9, step: .6, min: 3 } };
const cfg = Object.assign({ pmode: 'bots', bots: 3, level: 'normal', lives: 2, speed: 'normal', names: ['', ''], you: '' }, store.get().party || {});
function segBind(id, key, conv = v => v) {
  const s = $(id);
  [...s.children].forEach(b => { b.classList.toggle('on', String(cfg[key]) === b.dataset.v); b.onclick = () => { cfg[key] = conv(b.dataset.v); [...s.children].forEach(x => x.classList.toggle('on', x === b)); saveCfg(); if (key === 'pmode') syncMode(); }; });
}
function saveCfg() { store.patch(v => v.party = cfg); }
function syncMode() { $('#botsCfg').hidden = cfg.pmode !== 'bots'; $('#localCfg').hidden = cfg.pmode !== 'local'; renderPlist(); }
function renderPlist() {
  const l = $('#plist'); l.innerHTML = '';
  cfg.names.forEach((n, i) => {
    const r = el('div', 'pr'); const dot = el('div', 'dot'); dot.style.background = COLORS[i % COLORS.length];
    const inp = el('input'); inp.maxLength = 14; inp.placeholder = 'Player ' + (i + 1); inp.value = n; inp.oninput = () => { cfg.names[i] = inp.value; saveCfg(); };
    r.append(dot, inp);
    if (cfg.names.length > 2) { const x = el('button', 'icon-btn', '✕'); x.onclick = () => { cfg.names.splice(i, 1); saveCfg(); renderPlist(); }; r.append(x); }
    l.append(r);
  });
  $('#addP').style.display = cfg.names.length >= 8 ? 'none' : '';
}
$('#addP').onclick = () => { if (cfg.names.length < 8) { cfg.names.push(''); saveCfg(); renderPlist(); } };
function openSetup() {
  Sea.set(260);
  segBind('#pmode', 'pmode'); segBind('#botCount', 'bots', Number); segBind('#botLevel', 'level'); segBind('#lifeSeg', 'lives', Number); segBind('#speedSeg', 'speed');
  $('#youName').value = cfg.you || ''; $('#youName').oninput = e => { cfg.you = e.target.value; saveCfg(); };
  syncMode(); show('setup');
}
$('#setupBack').onclick = renderHome;
$('#wake').onclick = () => startParty();

let P = null;
function startParty() {
  const players = [];
  if (cfg.pmode === 'bots') {
    players.push({ name: (cfg.you || '').trim() || 'You', human: true });
    const names = shuffle(BOT_NAMES.slice());
    for (let i = 0; i < cfg.bots; i++) players.push({ name: names[i], bot: cfg.level });
  } else cfg.names.forEach((n, i) => players.push({ name: n.trim() || 'Player ' + (i + 1), human: true }));
  players.forEach((p, i) => Object.assign(p, { id: i, color: COLORS[i % COLORS.length], hearts: cfg.lives, meter: 0, out: false, answers: 0, best: null, pops: 0 }));
  const sp = SPEEDS[cfg.speed];
  P = { players, sp, cap: Math.min(6, cfg.lives + 2), bag: new PromptBag(catPool().length >= 3 ? catPool() : BANK, 30), used: new Set(), passes: 0, phase: 'freeze', cur: Math.floor(Math.random() * players.length), raf: 0, tickAcc: 0, local: cfg.pmode === 'local' };
  Sea.set(260);
  show('party');
  buildSeats();
  newCategory();
  $('#usedList').innerHTML = '';
  setTimeout(() => beginTurn(), 700);
  let last = performance.now();
  const loop = now => { if (!P) return; const dt = Math.min(.1, (now - last) / 1000); last = now; partyTick(dt); P.raf = requestAnimationFrame(loop); };
  P.raf = requestAnimationFrame(loop);
}
function newCategory() {
  P.cat = BANK[P.bag.next()]; P.used = new Set(); P.passes = 0;
  const b = $('.cat-banner'); b.classList.remove('new'); void b.offsetWidth; b.classList.add('new');
  $('#pPack').textContent = P.cat.pack; $('#pPrompt').textContent = P.cat.prompt; $('#pUsed').textContent = `${P.cat.valid.length} answers · 0 said`;
  $('#usedList').innerHTML = '';
}
function buildSeats() {
  const ring = $('#ring'); ring.innerHTML = '';
  for (const p of P.players) {
    const s = el('div', 'seat');
    s.innerHTML = `<div class="bubble"></div><div class="av" style="background:${p.color}">${esc(p.name[0].toUpperCase())}</div><div class="nm">${esc(p.name)}${p.bot ? ' 🤖' : ''}</div><div class="hearts"></div><div class="meter"><i></i></div>`;
    p.el = s; ring.append(s);
  }
  layoutSeats(); renderSeats();
}
function layoutSeats() {
  if (!P) return;
  const a = $('#arena').getBoundingClientRect(), n = P.players.length;
  const cxp = a.width / 2, cyp = a.height / 2 - 8, compact = innerHeight <= 500, rx = Math.max(90, Math.min(a.width / 2 - 64, compact ? 300 : 360)), ry = Math.max(compact ? 44 : 80, Math.min(a.height / 2 - (compact ? 34 : 72), 240));
  P.players.forEach((p, i) => {
    const ang = Math.PI / 2 + (i / n) * Math.PI * 2; p.ang = ang;
    p.el.style.left = (cxp + Math.cos(ang) * rx) + 'px'; p.el.style.top = (cyp + Math.sin(ang) * ry) + 'px';
    p.sx = cxp + Math.cos(ang) * rx; p.sy = cyp + Math.sin(ang) * ry;
  });
  pointAt(P.cur);
}
addEventListener('resize', layoutSeats);
function renderSeats() {
  for (const p of P.players) {
    p.el.classList.toggle('out', p.out); p.el.classList.toggle('turn', !p.out && p.id === P.cur && P.phase !== 'over');
    p.el.querySelector('.hearts').textContent = p.out ? '☠️' : '❤️'.repeat(p.hearts);
    p.el.querySelector('.meter i').style.width = Math.min(100, p.meter) + '%';
  }
}
function pointAt(id) {
  const p = P.players[id]; if (!p || p.sx == null) return;
  const a = $('#arena').getBoundingClientRect();
  const deg = Math.atan2(p.sy - (a.height / 2 - 8), p.sx - a.width / 2) * 180 / Math.PI;
  $('#pointer').style.transform = `rotate(${deg}deg)`;
  const pf = $('#puffer'); pf.style.transform = `scaleX(${Math.cos(deg * Math.PI / 180) < 0 ? -1 : 1})`;
}
const alive = () => P.players.filter(p => !p.out);
function nextAlive(from) { const n = P.players.length; for (let k = 1; k <= n; k++) { const p = P.players[(from + k) % n]; if (!p.out) return p.id; } return from; }
function bubble(p, txt, kind = '') { const b = p.el.querySelector('.bubble'); b.textContent = txt; b.className = 'bubble' + (txt ? ' on' : '') + (kind ? ' ' + kind : ''); }

function beginTurn() {
  if (!P) return;
  if (P.cat.valid.length - P.used.size < 3) newCategory(); // category nearly exhausted
  const p = P.players[P.cur];
  P.phase = 'turn';
  P.turnTime = Math.max(P.sp.min, P.sp.start - P.sp.step * P.passes);
  P.timeLeft = P.turnTime; P.tickAcc = 0;
  pointAt(P.cur); renderSeats();
  P.players.forEach(q => q !== p && bubble(q, ''));
  const inp = $('#pInput'), lbl = $('#turnLbl'), msg = $('#pMsg');
  msg.textContent = ''; msg.className = 'pmsg';
  if (p.human) {
    lbl.textContent = P.local ? `${p.name}, your turn!` : 'Your turn: name one!'; lbl.className = 'turn-lbl mine';
    inp.disabled = false; inp.value = ''; inp.placeholder = P.cat.prompt + '…'; inp.focus();
    $('#pForm .go').disabled = false;
  } else {
    lbl.textContent = `${p.name} is thinking…`; lbl.className = 'turn-lbl';
    inp.disabled = true; inp.value = ''; inp.placeholder = `${p.name} is thinking…`; $('#pForm .go').disabled = true;
    const L = BOT_LEVELS[p.bot];
    const usedFrac = P.used.size / P.cat.valid.length;
    const failP = L.fail + usedFrac * .55 + (P.turnTime <= 4 ? .06 : 0);
    const think = rand(L.think[0], L.think[1]) * (1 + usedFrac * .8) * (P.turnTime < 6 ? .8 : 1);
    P.plan = { t: 0, think, fail: Math.random() < failP, item: botPick(P.cat, P.used, p.bot), tries: 0 };
    bubble(p, '…');
  }
}
function partyTick(dt) {
  if (P.phase !== 'turn') return;
  P.timeLeft -= dt;
  const f = Math.max(0, P.timeLeft / P.turnTime);
  $('#clockFg').style.strokeDashoffset = 628.3 * (1 - f);
  $('#clockFg').style.stroke = f > .4 ? '#4fe3c1' : f > .15 ? '#ffb020' : '#ff5a5a';
  const stage = f > .7 ? 0 : f > .4 ? 1 : f > .15 ? 2 : 3;
  const pf = $('#puffer');
  pf.className = 'puffer s' + stage;
  pf.querySelector('svg').style.transform = `scale(${0.82 + (1 - f) * .62})`;
  P.tickAcc += dt;
  const iv = [.6, .42, .26, .13][stage];
  if (P.tickAcc >= iv) { P.tickAcc = 0; Sound.tick(stage >= 2); }
  const p = P.players[P.cur];
  if (!p.human && P.plan) botStep(p, dt);
  if (P.timeLeft <= 0) pop();
}
function botStep(p, dt) {
  const pl = P.plan; pl.t += dt;
  const typeStart = pl.think * .55;
  if (pl.t > typeStart && pl.t < pl.think) {
    const word = pl.fail ? (pl.flub || (pl.flub = BOT_FLUBS[Math.floor(Math.random() * BOT_FLUBS.length)])) : (pl.item ? pl.item.name : '');
    const k = Math.ceil(word.length * Math.min(1, (pl.t - typeStart) / (pl.think - typeStart)));
    bubble(p, word.slice(0, k) || '…');
  }
  if (pl.t >= pl.think) {
    if (!pl.fail && pl.item && !P.used.has(pl.item.idx)) { accept(p, pl.item); return; }
    // stuck: show the flub, then maybe find something later
    pl.tries++; bubble(p, pl.flub || '???', 'bad'); if (pl.tries === 1) Sound.bad();
    pl.flub = null; pl.think = pl.t + rand(1.4, 3.2);
    if (Math.random() < .35 / pl.tries) { pl.fail = false; pl.item = botPick(P.cat, P.used, p.bot); }
  }
}
$('#pForm').addEventListener('submit', e => {
  e.preventDefault(); if (!P || P.phase !== 'turn') return;
  const p = P.players[P.cur]; if (!p.human) return;
  const txt = $('#pInput').value.trim(); if (!txt) return;
  const r = matchAnswer(P.cat, txt), msg = $('#pMsg');
  const fail = t => { msg.textContent = t; msg.className = 'pmsg'; bump('#pForm'); Sound.bad(); bubble(p, txt, 'bad'); $('#pInput').select(); };
  if (!r) return fail(`“${txt}” isn't on the list. Quick, try another!`);
  if (r.item.trap) return fail(`Nice try, ${r.item.name} doesn't count!`);
  if (P.used.has(r.item.idx)) return fail(`${r.item.name} was already said!`);
  accept(p, r.item);
});
$('#pInput').addEventListener('input', () => { const p = P && P.players[P.cur]; if (p && p.human && P.phase === 'turn') bubble(p, $('#pInput').value); });
function accept(p, item) {
  P.used.add(item.idx); P.passes++; p.answers++;
  const T = TIERS[item.tier];
  if (!p.best || T.pts > TIERS[p.best.tier].pts) p.best = item;
  p.meter += T.meter;
  let bonus = false;
  if (p.meter >= 100) { if (p.hearts < P.cap) { p.hearts++; bonus = true; p.meter -= 100; } else p.meter = 100; }
  bubble(p, item.name, 'good');
  Sound.good(item.tier);
  const chip = el('span', null, esc(item.name)); chip.style.background = T.color; chip.title = T.name; $('#usedList').prepend(chip);
  $('#pUsed').textContent = `${P.cat.valid.length} answers · ${P.used.size} said`;
  const msg = $('#pMsg');
  msg.className = 'pmsg ok';
  msg.textContent = `${p.name}: ${item.name} · ${T.emoji} ${T.name}${bonus ? ' · ❤️ bonus heart!' : T.meter ? ` · meter +${T.meter}` : ''}`;
  if (bonus || item.tier === 4) { const r = p.el.getBoundingClientRect(); Sea.burst(r.left + r.width / 2, r.top + 30, T.color, 24, .7); }
  P.phase = 'pass'; P.plan = null;
  $('#pInput').disabled = true;
  P.cur = nextAlive(P.cur);
  renderSeats(); pointAt(P.cur);
  setTimeout(() => P && P.phase === 'pass' && beginTurn(), 380);
}
function pop() {
  P.phase = 'freeze';
  const p = P.players[P.cur];
  p.hearts--; p.pops++;
  if (p.hearts <= 0) { p.hearts = 0; p.out = true; }
  const pf = $('#puffer'); pf.className = 'puffer popped';
  const pt = $('#popTxt'); pt.textContent = 'POP!'; pt.classList.remove('on'); void pt.offsetWidth; pt.classList.add('on');
  const r = $('#pufferWrap').getBoundingClientRect();
  Sea.burst(r.left + r.width / 2, r.top + r.height / 2, '#ffb020', 40, 1.2); Sea.burst(r.left + r.width / 2, r.top + r.height / 2, '#ff5a3a', 20, .8);
  Sound.pop(); flash();
  p.el.classList.remove('hit'); void p.el.offsetWidth; p.el.classList.add('hit');
  bubble(p, p.out ? 'I’m out! 💀' : 'ouch!', 'bad');
  $('#pInput').disabled = true; $('#pForm .go').disabled = true;
  const lbl = $('#turnLbl'); lbl.className = 'turn-lbl'; lbl.textContent = p.out ? `${p.name} is out!` : `${p.name} loses a heart!`;
  $('#pMsg').textContent = ''; renderSeats();
  setTimeout(() => {
    if (!P) return;
    pf.className = 'puffer sleep'; pf.querySelector('svg').style.transform = 'scale(.82)';
    $('#clockFg').style.strokeDashoffset = 0;
    if (alive().length <= 1) return partyOver();
    if (p.out) P.cur = nextAlive(P.cur);
    newCategory();
    renderSeats(); pointAt(P.cur);
    setTimeout(() => P && beginTurn(), 900);
  }, 1700);
}
function partyOver() {
  P.phase = 'over'; renderSeats();
  const w = alive()[0] || P.players[0];
  const youWon = w.human && !P.local;
  if (youWon) store.patch(v => v.partyWins = (v.partyWins || 0) + 1);
  Sound.win();
  const rows = P.players.slice().sort((a, b) => b.hearts - a.hearts || b.answers - a.answers).map(p => `<div class="trow"><span class="tchip" style="background:${p.color};color:#fff">${esc(p.name)}${p === w ? ' 👑' : ''}</span><div><b>${p.answers} answer${p.answers === 1 ? '' : 's'}</b>${p.best ? ` · best: ${esc(p.best.name)} (${TIERS[p.best.tier].name})` : ''}<br><small>${p.out ? 'Popped out' : 'Still floating with ' + '❤️'.repeat(p.hearts)}</small></div></div>`).join('');
  modal(`<div style="text-align:center"><div class="winner-av" style="background:${w.color}">${esc(w.name[0].toUpperCase())}</div><h3>${esc(w.name)} ${w.human && !P.local ? '(you!) ' : ''}is the last one floating!</h3></div>${rows}
    <div class="res-btns"><button class="cta" id="pAgain">Play again</button><button class="cta ghost" id="pSetup">Change setup</button></div><button class="link" id="pHome">Back to home</button>`, c => {
    c.querySelector('#pAgain').onclick = () => { closeModal(); endParty(); startParty(); };
    c.querySelector('#pSetup').onclick = () => { closeModal(); endParty(); openSetup(); };
    c.querySelector('#pHome').onclick = () => { closeModal(); endParty(); renderHome(); };
  });
}
function endParty() { if (P) cancelAnimationFrame(P.raf); P = null; }
$('#partyBack').onclick = () => {
  if (!P || P.phase === 'over') { endParty(); return renderHome(); }
  const was = P.phase; P.phase = 'paused';
  modal(`<h3>Leave the party?</h3><p>The puffer will keep everyone's hearts where they are… just kidding, the game ends.</p><div class="res-btns"><button class="cta ghost" id="stay">Keep playing</button><button class="cta" id="leave">Leave</button></div>`, c => {
    c.querySelector('#stay').onclick = () => { closeModal(); if (P) P.phase = was; };
    c.querySelector('#leave').onclick = () => { closeModal(); endParty(); renderHome(); };
  });
};
const syncMute = () => { $('#muteBtn').textContent = Sound.muted ? '🔇' : '🔊'; };
$('#muteBtn').onclick = () => { Sound.muted = !Sound.muted; store.patch(v => v.muted = Sound.muted); syncMute(); };
syncMute();

// test hook
window.__rr = { BANK, get D() { return D; }, get P() { return P; }, matchAnswer, startDive, startParty, cfg };
renderHome();
})();
