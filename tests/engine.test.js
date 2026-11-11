const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/bank.js', 'utf8') + '\nmodule.exports={BANK_RAW};';
const m = { exports: {} }; new Function('module', src)(m);
const E = require(__dirname + '/../src/engine.js');
const bank = E.buildBank(m.exports.BANK_RAW);
let fails = 0; const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };
console.log('categories', bank.length, 'answers', bank.reduce((a, c) => a + c.valid.length, 0));
const byP = p => bank.find(c => c.prompt === p);
const t = (p, input, expect, tier) => { const r = E.matchAnswer(byP(p), input); const got = r ? r.item.name : null; ok(got === expect && (tier === undefined || (r && r.item.tier === tier)), `${p} | "${input}" -> ${got} (${r && r.item.tier}) expected ${expect} ${tier ?? ''}`); };
t('Name a country', 'USA', 'United States', 0);
t('Name a country', 'the netherlands', 'Netherlands', 1);
t('Name a country', 'Germnay', 'Germany', 0);
t('Name a country', 'iran', 'Iran'); t('Name a country', 'iraq', 'Iraq');
t('Name a country', 'Tuvalu', 'Tuvalu', 'D');
t('Name a country', 'cote d\'ivoire', 'Ivory Coast');
t('Name a country', 'atlantis', null);
t('Name a fruit', 'apples', 'Apple', 0);
t('Name a fruit', 'cherries', 'Cherry');
t('Name a fruit', 'Dragonfruit', 'Dragon fruit', 'D');
t('Name a programming language', 'c++', 'C++'); t('Name a programming language', 'C#', 'C#');
t('Name a programming language', 'c', 'C');
t('Name a dinosaur', 'T-Rex', 'Tyrannosaurus');
t('Name a dinosaur', 'dimetrodon', 'Dimetrodon', 'X');
t('Name a vegetable', 'pea', 'Peas');
t('Name a piece of clothing', 'tshirt', 'T-shirt');
t('Name a mammal', 'platypus', 'Platypus', 'D');
t('Name a chemical element', 'aluminum', 'Aluminium');
t('Name a chemical element', 'oganesson', 'Oganesson', 4);
t('Name a sea creature', 'blowfish', 'Pufferfish');
t('Name a US city', 'Springfield', 'Springfield', 'D');
t('Name a US city', 'gotham', 'Gotham', 'X');
t('Name a classical composer', 'mozart', 'Mozart', 0);
t('Name a famous painter', 'van gogh', 'Vincent van Gogh');
// every key resolves to its own item (no shadowing within a category)
for (const c of bank) for (const it of c.items) for (const k of it.keys) { const r = c.map.get(k); ok(r, `${c.prompt}: key ${k} missing`); }
// bots
const used = new Set(); const cat = byP('Name a fruit'); let picks = 0;
for (let i = 0; i < cat.valid.length; i++) { const p = E.botPick(cat, used, 'hard'); if (!p) break; ok(!used.has(p.idx), 'bot repeated'); used.add(p.idx); picks++; }
ok(picks === cat.valid.length && E.botPick(cat, used, 'hard') === null, 'bots use every answer then stop');
const bag = new E.PromptBag(bank); const seen = new Set(); for (let i = 0; i < bank.length; i++) seen.add(bag.next());
ok(seen.size === bank.length, 'prompt bag covers all categories before repeating');
// tier spread sanity
for (const c of bank) { const n = [0, 1, 2, 3, 4].map(tt => c.valid.filter(i => i.tier === tt).length); if (n[0] === 0) ok(false, c.prompt + ' has no tier0'); }
console.log(fails ? fails + ' failures' : 'all engine checks passed');
