# Rare Reef 🐠

**Name the answer nobody else thinks of. The rarer it is, the deeper you dive.**

A free, unlimited rare-answer trivia game in one HTML file, with a hot-potato party mode.

## Modes
- **Dive**: 7 category prompts, 25 seconds each. Common answers barely count; rare ones send you deep (every point = 10 m).
- **Endless Dive**: no limit, keep going until you miss 3 prompts.
- **Puffer Panic**: pass the puffer before it pops. Name a valid answer (no repeats) to pass it on; if it pops on you, you lose a heart. Rare answers fill your meter for a bonus heart. Last one floating wins. Play against 1–7 bots (Easy / Normal / Hard), pass-and-play on one device, or **online on different devices**: create a room, friends join with the 4-letter code or the invite link (up to 8 players). Online rooms run on Supabase Realtime; the room creator's device runs the game.

## Scoring
| Tier | Points | Depth |
|---|---|---|
| 🫧 Seafoam | 10 | 100 m |
| 🦜 Copycat (the "clever" answer everyone picks) | 15 | 150 m |
| 🐠 Reef | 30 | 300 m |
| 🐙 Rare | 60 | 600 m |
| 🦑 Abyssal | 85 | 850 m |
| 🐋 Leviathan | 100 | 1,000 m |

58 categories and 5,300+ answers. Typos, plurals and alternative spellings are accepted.

## Files
- `index.html`: the whole game (built, ready to host anywhere)
- `src/`: source (`bank.js` answers, `engine.js` matching/scoring/bots, `game.js` UI, `style.css`, `index.src.html`)
- `build.py`: rebuilds `index.html` from `src/`
- `tests/engine.test.js`: `node tests/engine.test.js`
