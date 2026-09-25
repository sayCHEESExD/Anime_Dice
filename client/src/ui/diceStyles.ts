/**
 * THE ANIME DICE HUD, one stylesheet injected once.
 *
 * The look is the reference's: heavy rounded Fredoka in white with a thick dark
 * rim, chunky 3D buttons with a drop, dark charcoal windows with a checkered
 * coloured header and a red checkered close square, and rounded unit cards on a
 * dotted backdrop.
 *
 * ONE SIZE UNIT: `--u` is one design pixel of a 1600x900 screen, bounded both
 * ways, and every length below is a multiple of it - so the HUD scales as one
 * from a phone held sideways to a large monitor, never per device.
 *
 * NO BACKTICKS IN THIS FILE: the stylesheet is a template literal.
 */
let injected = false;

export const injectDiceStyles = (): void => {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
:root {
  --u: clamp(0.5px, min(100vw / 1600, 100vh / 860), 1.3px);
  --ink: #16181f;
  --font: "Fredoka", "Baloo 2", "Nunito", "Segoe UI", system-ui, sans-serif;
  --win: #26282e;
  --win2: #1c1d22;
  --green: #5ff25a;
  --green-d: #26b43a;
  --blue: #46c0ff;
  --blue-d: #1f86e0;
  --red: #ff4b4b;
  --red-d: #c81e2a;
  --gold: #ffd23a;
  --gold-d: #e0a010;
  --purple: #8f7bff;
  --purple-d: #5a45e0;
  --safe-l: env(safe-area-inset-left, 0px);
  --safe-r: env(safe-area-inset-right, 0px);
  --safe-t: env(safe-area-inset-top, 0px);
  --safe-b: env(safe-area-inset-bottom, 0px);
}
body.dice-dragging { cursor: grabbing; }
body.dice-cursor-hidden, body.dice-cursor-hidden * { cursor: none !important; }

.dice, .dice * { box-sizing: border-box; font-family: var(--font); font-weight: 700; }
.dice-out {
  color: #fff;
  text-shadow:
    calc(2.4 * var(--u)) 0 0 var(--ink), calc(-2.4 * var(--u)) 0 0 var(--ink), 0 calc(2.4 * var(--u)) 0 var(--ink), 0 calc(-2.4 * var(--u)) 0 var(--ink),
    calc(1.7 * var(--u)) calc(1.7 * var(--u)) 0 var(--ink), calc(-1.7 * var(--u)) calc(1.7 * var(--u)) 0 var(--ink),
    calc(1.7 * var(--u)) calc(-1.7 * var(--u)) 0 var(--ink), calc(-1.7 * var(--u)) calc(-1.7 * var(--u)) 0 var(--ink),
    0 calc(4 * var(--u)) calc(4 * var(--u)) rgba(0, 0, 0, 0.35);
}
.dice-icon { width: 100%; height: 100%; object-fit: contain; pointer-events: none; filter: drop-shadow(0 calc(3 * var(--u)) calc(2 * var(--u)) rgba(0,0,0,0.35)); }

/* ------------------------------------------------------------ buttons */
.dice-btn {
  --a: var(--green); --b: var(--green-d);
  position: relative;
  display: inline-flex; align-items: center; justify-content: center; gap: calc(8 * var(--u));
  min-height: calc(52 * var(--u));
  padding: calc(6 * var(--u)) calc(22 * var(--u));
  border: calc(4 * var(--u)) solid var(--ink);
  border-radius: calc(16 * var(--u));
  background: linear-gradient(180deg, var(--a), var(--b));
  box-shadow: 0 calc(6 * var(--u)) 0 rgba(0,0,0,0.35), inset 0 calc(4 * var(--u)) 0 rgba(255,255,255,0.35);
  color: #fff; font-size: calc(24 * var(--u));
  cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
  transition: transform 90ms ease, filter 120ms ease;
}
.dice-btn[hidden] { display: none; }
.dice-btn:hover { filter: brightness(1.07); transform: translateY(calc(-1 * var(--u))); }
.dice-btn:active { transform: translateY(calc(4 * var(--u))); box-shadow: 0 calc(2 * var(--u)) 0 rgba(0,0,0,0.35), inset 0 calc(4 * var(--u)) 0 rgba(255,255,255,0.3); }
.dice-btn[disabled], .dice-btn.is-off { filter: grayscale(0.7) brightness(0.8); cursor: default; }
.dice-btn--blue { --a: var(--blue); --b: var(--blue-d); }
.dice-btn--red { --a: #ff6a6a; --b: var(--red-d); }
.dice-btn--gold { --a: #ffe066; --b: var(--gold-d); }
.dice-btn--purple { --a: var(--purple); --b: var(--purple-d); }
.dice-btn--grey { --a: #b8bfd0; --b: #7c8498; }
.dice-btn--small { min-height: calc(40 * var(--u)); font-size: calc(18 * var(--u)); padding: calc(4 * var(--u)) calc(14 * var(--u)); border-radius: calc(12 * var(--u)); }

/* ---------------------------------------------------------------- HUD */
.dice-hud { position: fixed; inset: 0; pointer-events: none; z-index: 20; }
.dice-hud > * { pointer-events: auto; }

/* The left column: Cash, the chips and the rail, centred on the left edge. */
.dice-hud > .dice-left {
  position: fixed;
  left: calc(max(12px, 18 * var(--u)) + var(--safe-l));
  top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; align-items: flex-start;
  gap: calc(12 * var(--u));
  pointer-events: none;
}
.dice-cash {
  display: grid; grid-template-columns: auto auto; column-gap: calc(10 * var(--u)); align-items: center;
  pointer-events: none;
}
.dice-cash__icon { grid-row: span 2; width: calc(68 * var(--u)); height: calc(52 * var(--u)); }
.dice-cash__value { font-size: calc(46 * var(--u)); line-height: 1; color: #6dff5a; }
.dice-cash__rate { font-size: calc(22 * var(--u)); line-height: 1.1; color: #d6ffcf; }
.dice-chips { display: flex; gap: calc(8 * var(--u)); pointer-events: none; margin-bottom: calc(10 * var(--u)); }
.dice-chip {
  display: inline-flex; align-items: center; gap: calc(6 * var(--u));
  padding: calc(3 * var(--u)) calc(12 * var(--u));
  border: calc(3 * var(--u)) solid var(--ink); border-radius: calc(999 * var(--u));
  background: rgba(24, 30, 60, 0.72);
  font-size: calc(18 * var(--u));
}
.dice-chip b { color: #9dff7a; }
.dice-chip--rebirth b { color: #ff9ad0; }

/* The left rail. */
.dice-rail {
  pointer-events: auto;
  display: flex; flex-direction: column; gap: calc(16 * var(--u));
}
.dice-tile {
  --a: #8f7bff; --b: #5a45e0;
  position: relative;
  width: calc(84 * var(--u)); height: calc(84 * var(--u));
  padding: calc(8 * var(--u));
  border: calc(4 * var(--u)) solid var(--ink); border-radius: calc(18 * var(--u));
  background: linear-gradient(180deg, var(--a), var(--b));
  box-shadow: 0 calc(6 * var(--u)) 0 rgba(0,0,0,0.3), inset 0 calc(3 * var(--u)) 0 rgba(255,255,255,0.35);
  cursor: pointer; display: grid; place-items: center;
  transition: transform 100ms ease;
}
.dice-tile:hover { transform: scale(1.06); }
.dice-tile:active { transform: translateY(calc(3 * var(--u))); }
.dice-tile__label {
  position: absolute; left: 50%; bottom: calc(-12 * var(--u)); transform: translateX(-50%);
  font-size: calc(16 * var(--u)); white-space: nowrap; pointer-events: none;
}
.dice-tile__key { position: absolute; top: calc(-8 * var(--u)); left: calc(-8 * var(--u)); font-size: calc(13 * var(--u)); background: var(--ink); color: #fff; border-radius: calc(6 * var(--u)); padding: 0 calc(5 * var(--u)); }
body.dice-touch .dice-tile__key { display: none; }
.dice-badge {
  position: absolute; top: calc(-10 * var(--u)); right: calc(-10 * var(--u));
  min-width: calc(30 * var(--u)); height: calc(30 * var(--u)); padding: 0 calc(6 * var(--u));
  border: calc(3 * var(--u)) solid var(--ink); border-radius: calc(999 * var(--u));
  background: var(--red); color: #fff; font-size: calc(16 * var(--u)); line-height: calc(24 * var(--u)); text-align: center;
  box-shadow: 0 calc(3 * var(--u)) 0 rgba(0,0,0,0.3);
  animation: dice-bob 1.2s ease-in-out infinite;
}
.dice-badge[hidden] { display: none; }
@keyframes dice-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(calc(-4 * var(--u))); } }

/* The bottom bar: BACKPACK, ROLL (+ AUTO), UPGRADES. */
.dice-bar {
  position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(max(6px, 10 * var(--u)) + var(--safe-b));
  display: flex; align-items: flex-end; gap: calc(26 * var(--u));
}
.dice-big {
  position: relative; display: flex; flex-direction: column; align-items: center;
  background: none; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: transform 100ms ease;
}
.dice-big:hover { transform: scale(1.05); }
.dice-big:active { transform: scale(0.95); }
.dice-big__art { width: calc(112 * var(--u)); height: calc(112 * var(--u)); }
.dice-big__label { margin-top: calc(-18 * var(--u)); font-size: calc(30 * var(--u)); letter-spacing: 0.02em; pointer-events: none; }
.dice-big--roll .dice-big__art { width: calc(150 * var(--u)); height: calc(150 * var(--u)); }
.dice-big--roll .dice-big__label { font-size: calc(38 * var(--u)); }
.dice-big.is-busy .dice-big__art { animation: dice-shake 0.35s linear infinite; }
@keyframes dice-shake { 0% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } 100% { transform: rotate(-6deg); } }
.dice-rollcost { position: absolute; top: calc(-6 * var(--u)); left: 50%; transform: translateX(-50%); font-size: calc(18 * var(--u)); color: #9dff7a; white-space: nowrap; }
.dice-auto {
  position: absolute; top: calc(-44 * var(--u)); left: 50%; transform: translateX(-50%);
  min-height: calc(38 * var(--u)); font-size: calc(18 * var(--u)); padding: 0 calc(14 * var(--u)); white-space: nowrap;
}
.dice-auto.is-on { --a: #ffe066; --b: #f08a10; animation: dice-glow 1s ease-in-out infinite; }
@keyframes dice-glow { 0%, 100% { box-shadow: 0 calc(6 * var(--u)) 0 rgba(0,0,0,0.35), 0 0 calc(4 * var(--u)) #ffd23a; } 50% { box-shadow: 0 calc(6 * var(--u)) 0 rgba(0,0,0,0.35), 0 0 calc(22 * var(--u)) #ffd23a; } }
.dice-autosell-btn { position: absolute; top: calc(-44 * var(--u)); left: calc(100% + 4 * var(--u)); min-height: calc(38 * var(--u)); font-size: calc(15 * var(--u)); padding: 0 calc(10 * var(--u)); white-space: nowrap; }

/* Popover listing rarities to auto-sell. */
.dice-popover {
  position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(250 * var(--u) + var(--safe-b));
  padding: calc(14 * var(--u));
  border: calc(4 * var(--u)) solid var(--ink); border-radius: calc(18 * var(--u));
  background: linear-gradient(180deg, var(--win), var(--win2));
  box-shadow: 0 calc(8 * var(--u)) 0 rgba(0,0,0,0.4);
  z-index: 40; display: grid; gap: calc(8 * var(--u)); min-width: calc(320 * var(--u));
}
.dice-popover[hidden] { display: none; }
.dice-popover h3 { margin: 0 0 calc(4 * var(--u)); font-size: calc(22 * var(--u)); text-align: center; }
.dice-popover label { display: flex; align-items: center; justify-content: space-between; gap: calc(10 * var(--u)); font-size: calc(19 * var(--u)); cursor: pointer; padding: calc(4 * var(--u)) calc(8 * var(--u)); border-radius: calc(10 * var(--u)); background: rgba(255,255,255,0.05); }
.dice-popover input { width: calc(22 * var(--u)); height: calc(22 * var(--u)); accent-color: #ff4b4b; }
.dice-popover small { font-size: calc(14 * var(--u)); color: #b8c0d8; text-align: center; }

/* Corner: music, hint, toasts. */
.dice-corner { position: fixed; right: calc(max(12px, 18 * var(--u)) + var(--safe-r)); bottom: calc(max(12px, 18 * var(--u)) + var(--safe-b)); display: flex; gap: calc(12 * var(--u)); }
body.dice-touch .dice-corner { bottom: auto; top: calc(max(70px, 120 * var(--u)) + var(--safe-t)); }
.dice-corner .dice-tile { width: calc(64 * var(--u)); height: calc(64 * var(--u)); }
.dice-corner .dice-tile.is-off { filter: grayscale(1) brightness(0.7); }
.dice-hint {
  position: fixed; left: 50%; transform: translateX(-50%);
  top: calc(max(10px, 16 * var(--u)) + var(--safe-t));
  max-width: 70vw; text-align: center; font-size: calc(22 * var(--u));
  padding: calc(6 * var(--u)) calc(18 * var(--u)); border-radius: calc(999 * var(--u));
  background: rgba(20, 26, 56, 0.6); pointer-events: none;
}
.dice-hint:empty { display: none; }
.dice-toasts { position: fixed; left: 50%; top: calc(80 * var(--u) + var(--safe-t)); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: calc(8 * var(--u)); pointer-events: none; z-index: 60; }
.dice-toast {
  font-size: calc(24 * var(--u)); padding: calc(6 * var(--u)) calc(20 * var(--u));
  border: calc(3 * var(--u)) solid var(--ink); border-radius: calc(999 * var(--u));
  background: linear-gradient(180deg, #3b4d9a, #26336e);
  box-shadow: 0 calc(5 * var(--u)) 0 rgba(0,0,0,0.3);
  animation: dice-toast 3.2s ease forwards; white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis;
}
.dice-toast--good { background: linear-gradient(180deg, #4fd35a, #23953a); }
.dice-toast--bad { background: linear-gradient(180deg, #ff6a6a, #c81e2a); }
.dice-toast--gold { background: linear-gradient(180deg, #ffd23a, #e08a10); }
.dice-toast--rebirth { background: linear-gradient(180deg, #ff7ad0, #b0308a); }
.dice-toast--levelup { background: linear-gradient(180deg, #46c0ff, #1f6fd6); }
@keyframes dice-toast { 0% { opacity: 0; transform: translateY(calc(-12 * var(--u))) scale(0.9); } 8% { opacity: 1; transform: none; } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(calc(-10 * var(--u))); } }
.dice-float { position: fixed; pointer-events: none; font-size: calc(26 * var(--u)); color: #6dff5a; animation: dice-float 1.2s ease-out forwards; z-index: 25; }
@keyframes dice-float { 0% { opacity: 0; transform: translateY(0) scale(0.8); } 15% { opacity: 1; transform: translateY(calc(-10 * var(--u))) scale(1.1); } 100% { opacity: 0; transform: translateY(calc(-60 * var(--u))) scale(1); } }

/* --------------------------------------------------------------- windows */
.dice-shade { position: fixed; inset: 0; background: rgba(8, 10, 26, 0.35); z-index: 30; }
.dice-shade[hidden] { display: none; }
.dice-window {
  --head-a: #6b73ff; --head-b: #4b53e0;
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: min(calc(1000 * var(--u)), calc(100vw - 24px - var(--safe-l) - var(--safe-r)));
  max-height: calc(100vh - 20px - var(--safe-t) - var(--safe-b));
  display: flex; flex-direction: column;
  border: calc(5 * var(--u)) solid var(--ink); border-radius: calc(22 * var(--u));
  background: linear-gradient(180deg, var(--win), var(--win2));
  box-shadow: 0 calc(10 * var(--u)) 0 rgba(0,0,0,0.45), 0 0 calc(40 * var(--u)) rgba(0,0,0,0.4);
  z-index: 31; overflow: hidden;
  animation: dice-open 180ms ease-out;
}
.dice-window[hidden] { display: none; }
@keyframes dice-open { from { transform: translate(-50%, -46%) scale(0.94); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
.dice-window__head {
  position: relative; flex: none;
  display: flex; align-items: center; gap: calc(14 * var(--u));
  height: calc(86 * var(--u)); padding: 0 calc(110 * var(--u)) 0 calc(20 * var(--u));
  background:
    repeating-conic-gradient(rgba(255,255,255,0.09) 0 25%, transparent 0 50%) 0 0 / calc(28 * var(--u)) calc(28 * var(--u)),
    linear-gradient(180deg, var(--head-a), var(--head-b));
  border-bottom: calc(5 * var(--u)) solid var(--ink);
}
.dice-window__icon { width: calc(64 * var(--u)); height: calc(64 * var(--u)); flex: none; }
.dice-window__title { font-size: calc(44 * var(--u)); line-height: 1; white-space: nowrap; }
.dice-window__close {
  position: absolute; right: 0; top: 0; bottom: 0; width: calc(96 * var(--u));
  border: 0; border-left: calc(5 * var(--u)) solid var(--ink);
  background:
    repeating-conic-gradient(rgba(255,255,255,0.12) 0 25%, transparent 0 50%) 0 0 / calc(24 * var(--u)) calc(24 * var(--u)),
    linear-gradient(180deg, #ff5555, #d91f2a);
  color: #fff; font-size: calc(54 * var(--u)); cursor: pointer;
}
.dice-window__close:hover { filter: brightness(1.1); }
.dice-window__body { position: relative; flex: 1; min-height: 0; display: flex; gap: calc(14 * var(--u)); padding: calc(16 * var(--u)); overflow: hidden; }
.dice-window__foot { flex: none; display: flex; align-items: center; justify-content: flex-end; gap: calc(14 * var(--u)); padding: calc(10 * var(--u)) calc(16 * var(--u)) calc(16 * var(--u)); flex-wrap: wrap; }
.dice-scroll { overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #5a6080 transparent; }

/* Side tabs, outside the window on the left like the reference. */
.dice-tabs { position: absolute; left: calc(-120 * var(--u)); top: calc(110 * var(--u)); display: flex; flex-direction: column; gap: calc(12 * var(--u)); }
.dice-tabs--inside { position: static; flex: none; }
.dice-tabs--inside .dice-tab { width: calc(96 * var(--u)); height: calc(92 * var(--u)); font-size: calc(17 * var(--u)); }
.dice-tab {
  width: calc(110 * var(--u)); height: calc(106 * var(--u));
  border: calc(4 * var(--u)) solid var(--ink); border-radius: calc(16 * var(--u));
  background: linear-gradient(180deg, #2c3a4a, #1a2230); color: #fff;
  font-size: calc(19 * var(--u)); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: calc(8 * var(--u));
  box-shadow: 0 calc(5 * var(--u)) 0 rgba(0,0,0,0.35);
}
.dice-tab.is-on { border-color: #dfe8ff; box-shadow: 0 0 0 calc(3 * var(--u)) #2b3244, 0 calc(5 * var(--u)) 0 rgba(0,0,0,0.35); }
.dice-tab__glyph { font-size: calc(40 * var(--u)); line-height: 1; margin-bottom: calc(4 * var(--u)); opacity: 0.8; }

/* ----------------------------------------------------------------- cards */
.dice-grid { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(128 * var(--u)), 1fr)); gap: calc(12 * var(--u)); align-content: start; padding: calc(4 * var(--u)); }
.dice-card {
  --r: #d6dde8;
  position: relative; aspect-ratio: 1 / 1;
  border: calc(4 * var(--u)) solid #3a3d47; border-radius: calc(16 * var(--u));
  background:
    radial-gradient(circle, rgba(255,255,255,0.07) calc(1.6 * var(--u)), transparent calc(2 * var(--u))) 0 0 / calc(14 * var(--u)) calc(14 * var(--u)),
    radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--r) 30%, #2a2c34), #20222a 75%);
  box-shadow: inset 0 0 0 calc(3 * var(--u)) color-mix(in srgb, var(--r) 70%, transparent), 0 calc(4 * var(--u)) 0 rgba(0,0,0,0.35);
  cursor: pointer; overflow: hidden; padding: 0;
  transition: transform 90ms ease;
}
.dice-card:hover { transform: translateY(calc(-3 * var(--u))); }
.dice-card.is-selected { border-color: #ffffff; box-shadow: inset 0 0 0 calc(3 * var(--u)) var(--r), 0 0 0 calc(3 * var(--u)) #ffffff; }
.dice-card img { position: absolute; inset: 4% 4% 0; width: 92%; height: 96%; object-fit: cover; object-position: 50% 20%; pointer-events: none; }
.dice-card__stat { position: absolute; left: calc(8 * var(--u)); bottom: calc(4 * var(--u)); font-size: calc(21 * var(--u)); pointer-events: none; }
.dice-card__lvl { position: absolute; right: calc(6 * var(--u)); top: calc(4 * var(--u)); font-size: calc(15 * var(--u)); pointer-events: none; }
.dice-card__tags { position: absolute; left: calc(6 * var(--u)); top: calc(5 * var(--u)); display: flex; gap: calc(4 * var(--u)); pointer-events: none; }
.dice-tag { font-size: calc(12 * var(--u)); padding: 0 calc(5 * var(--u)); border-radius: calc(6 * var(--u)); border: calc(2 * var(--u)) solid var(--ink); color: #fff; line-height: 1.3; }
.dice-tag--d { background: #2fbf5a; }
.dice-tag--t { background: #2f8fe0; }
.dice-tag--k { background: #e0a010; }
.dice-tag--new { background: #ff3d6e; }
.dice-card--locked-slot { cursor: default; background: #15171d; display: grid; place-items: center; color: #8a90a8; font-size: calc(16 * var(--u)); text-align: center; }
.dice-card--empty { background: repeating-linear-gradient(45deg, #23252c 0 calc(8 * var(--u)), #1e2026 calc(8 * var(--u)) calc(16 * var(--u))); display: grid; place-items: center; color: #7a8098; font-size: calc(30 * var(--u)); }
.dice-card--sell.is-selected { border-color: #ff4b4b; box-shadow: inset 0 0 0 calc(3 * var(--u)) #ff4b4b, 0 0 0 calc(3 * var(--u)) #ff4b4b; }
.dice-card--undiscovered img { filter: brightness(0) opacity(0.55); }

/* Detail pane. */
.dice-detail { flex: none; width: calc(300 * var(--u)); display: flex; flex-direction: column; gap: calc(8 * var(--u)); padding: calc(12 * var(--u)); border: calc(4 * var(--u)) solid #3a3d47; border-radius: calc(16 * var(--u)); background: rgba(0,0,0,0.2); }
.dice-detail[hidden] { display: none; }
.dice-detail__art { position: relative; aspect-ratio: 1; border-radius: calc(14 * var(--u)); overflow: hidden; background: radial-gradient(circle at 50% 35%, var(--r, #d6dde8), #1a1c22 72%); border: calc(3 * var(--u)) solid var(--ink); }
.dice-detail__art img { width: 100%; height: 100%; object-fit: cover; }
.dice-detail__name { font-size: calc(30 * var(--u)); line-height: 1; }
.dice-detail__sub { font-size: calc(17 * var(--u)); color: #aeb6d0; }
.dice-stats { display: grid; grid-template-columns: 1fr 1fr; gap: calc(6 * var(--u)); font-size: calc(18 * var(--u)); }
.dice-stat { padding: calc(4 * var(--u)) calc(8 * var(--u)); border-radius: calc(10 * var(--u)); background: rgba(255,255,255,0.06); }
.dice-stat span { display: block; font-size: calc(13 * var(--u)); color: #aeb6d0; }
.dice-detail__ability { font-size: calc(15 * var(--u)); color: #ffe08a; padding: calc(6 * var(--u)) calc(8 * var(--u)); border-radius: calc(10 * var(--u)); background: rgba(255, 210, 58, 0.08); }
.dice-detail__actions { display: grid; grid-template-columns: 1fr 1fr; gap: calc(8 * var(--u)); margin-top: auto; }
.dice-detail__actions .dice-btn { font-size: calc(16 * var(--u)); min-height: calc(44 * var(--u)); padding: 0 calc(8 * var(--u)); }
.dice-empty-note { grid-column: 1 / -1; text-align: center; color: #9aa2c0; font-size: calc(20 * var(--u)); padding: calc(40 * var(--u)) 0; }

.dice-counter {
  display: inline-flex; align-items: center; gap: calc(8 * var(--u));
  min-height: calc(52 * var(--u)); padding: 0 calc(18 * var(--u));
  border: calc(4 * var(--u)) solid var(--ink); border-radius: calc(16 * var(--u));
  background: linear-gradient(180deg, #46c0ff, #1f86e0); font-size: calc(24 * var(--u));
  box-shadow: 0 calc(6 * var(--u)) 0 rgba(0,0,0,0.35);
}
.dice-counter img { width: calc(34 * var(--u)); height: calc(34 * var(--u)); }
.dice-counter.is-full { background: linear-gradient(180deg, #ff6a6a, #c81e2a); }

/* Potion list. */
.dice-potions { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(128 * var(--u)), 1fr)); gap: calc(12 * var(--u)); align-content: start; }
.dice-potion { position: relative; aspect-ratio: 1; border: calc(4 * var(--u)) solid #3a3d47; border-radius: calc(16 * var(--u)); background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--p) 40%, #2a2c34), #1d1f25 75%); cursor: pointer; display: grid; place-items: center; padding: 0; }
.dice-potion.is-selected { border-color: #fff; }
.dice-potion__count { position: absolute; right: calc(8 * var(--u)); bottom: calc(4 * var(--u)); font-size: calc(22 * var(--u)); }
.dice-potion__name { position: absolute; left: 0; right: 0; top: calc(4 * var(--u)); text-align: center; font-size: calc(13 * var(--u)); }
.dice-flask { width: 58%; height: 58%; }

/* ---------------------------------------------------------- upgrades hex */
.dice-hexes { position: relative; width: 100%; height: calc(560 * var(--u)); }
.dice-hex {
  position: absolute; width: calc(200 * var(--u)); height: calc(174 * var(--u)); transform: translate(-50%, -50%);
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
  background: #16181f; padding: calc(6 * var(--u)); border: 0; cursor: pointer;
  transition: transform 100ms ease, filter 120ms ease;
}
.dice-hex:hover { transform: translate(-50%, -50%) scale(1.05); }
.dice-hex__inner {
  width: 100%; height: 100%;
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
  background:
    radial-gradient(circle, rgba(255,255,255,0.08) calc(1.5 * var(--u)), transparent calc(2 * var(--u))) 0 0 / calc(12 * var(--u)) calc(12 * var(--u)),
    linear-gradient(180deg, #3b3e48, #262830);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(2 * var(--u));
}
.dice-hex--start .dice-hex__inner { background: radial-gradient(circle, rgba(255,255,255,0.18) calc(1.5 * var(--u)), transparent calc(2 * var(--u))) 0 0 / calc(12 * var(--u)) calc(12 * var(--u)), linear-gradient(180deg, #34c0ff, #1488e0); }
.dice-hex--ready .dice-hex__inner { background: radial-gradient(circle, rgba(255,255,255,0.1) calc(1.5 * var(--u)), transparent calc(2 * var(--u))) 0 0 / calc(12 * var(--u)) calc(12 * var(--u)), linear-gradient(180deg, #3f7a3f, #265226); }
.dice-hex--locked { cursor: default; }
.dice-hex--locked .dice-hex__inner { background: linear-gradient(180deg, #2b2d33, #1c1d22); }
.dice-hex__glyph { width: calc(64 * var(--u)); height: calc(56 * var(--u)); display: grid; place-items: center; font-size: calc(48 * var(--u)); }
.dice-hex__name { font-size: calc(21 * var(--u)); line-height: 1; text-align: center; }
.dice-hex__cost { display: flex; align-items: center; gap: calc(4 * var(--u)); font-size: calc(19 * var(--u)); color: #7dff6a; }
.dice-hex__cost img { width: calc(24 * var(--u)); height: calc(20 * var(--u)); }
.dice-hex__effect { font-size: calc(13 * var(--u)); color: #cfd6ee; }

/* --------------------------------------------------------------- rebirth */
.dice-rebirth { display: grid; gap: calc(16 * var(--u)); width: 100%; }
.dice-rebirth__row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: calc(16 * var(--u)); }
.dice-rebirth__box { display: flex; align-items: center; gap: calc(12 * var(--u)); padding: calc(10 * var(--u)) calc(18 * var(--u)); border: calc(4 * var(--u)) solid var(--ink); border-radius: calc(12 * var(--u)); background: #1b1c21; font-size: calc(34 * var(--u)); }
.dice-rebirth__box img, .dice-rebirth__box .glyph { width: calc(46 * var(--u)); height: calc(46 * var(--u)); font-size: calc(40 * var(--u)); line-height: 1; }
.dice-rebirth__arrow { font-size: calc(60 * var(--u)); color: #fff; }
.dice-progress { position: relative; height: calc(50 * var(--u)); border: calc(4 * var(--u)) solid var(--ink); border-radius: calc(10 * var(--u)); background: #16171b; overflow: hidden; }
.dice-progress__fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(180deg, #37e04a, #15a22c); border-right: calc(4 * var(--u)) solid #6dff7a; }
.dice-progress__text { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(24 * var(--u)); }
.dice-rebirth__warn { text-align: center; font-size: calc(24 * var(--u)); }
.dice-rebirth__unlock { text-align: center; font-size: calc(18 * var(--u)); color: #ffd6f0; }

/* ----------------------------------------------------------------- tower */
.dice-team { display: grid; grid-template-columns: repeat(4, 1fr); gap: calc(12 * var(--u)); }
.dice-fighter {
  --r: #d6dde8;
  position: relative; aspect-ratio: 3 / 4;
  border: calc(4 * var(--u)) solid var(--ink); border-radius: calc(14 * var(--u));
  background: repeating-conic-gradient(from 0deg at 50% 45%, rgba(255,255,255,0.06) 0 8deg, transparent 8deg 16deg), radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--r) 45%, #2a2c34), #15161b 80%);
  box-shadow: inset 0 0 0 calc(3 * var(--u)) color-mix(in srgb, var(--r) 70%, transparent);
  overflow: hidden; cursor: pointer; padding: 0;
}
.dice-fighter img { position: absolute; inset: 10% 0 10%; width: 100%; height: 80%; object-fit: contain; pointer-events: none; }
.dice-fighter__hp, .dice-fighter__atk { position: absolute; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: calc(6 * var(--u)); font-size: calc(24 * var(--u)); pointer-events: none; }
.dice-fighter__hp { top: calc(6 * var(--u)); }
.dice-fighter__atk { bottom: calc(6 * var(--u)); }
.dice-fighter--empty { display: grid; place-items: center; color: #7a8098; font-size: calc(46 * var(--u)); }
.dice-fighter__name { position: absolute; left: 0; right: 0; bottom: calc(38 * var(--u)); text-align: center; font-size: calc(15 * var(--u)); pointer-events: none; }
.dice-floors { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(92 * var(--u)), 1fr)); gap: calc(8 * var(--u)); }
.dice-floor { min-height: calc(62 * var(--u)); border: calc(3 * var(--u)) solid var(--ink); border-radius: calc(12 * var(--u)); background: linear-gradient(180deg, var(--t, #5fe37a), color-mix(in srgb, var(--t, #5fe37a) 60%, #000)); color: #fff; font-size: calc(18 * var(--u)); cursor: pointer; line-height: 1.05; }
.dice-floor small { display: block; font-size: calc(12 * var(--u)); opacity: 0.9; }
.dice-floor.is-selected { box-shadow: 0 0 0 calc(4 * var(--u)) #fff; }
.dice-floor.is-cleared::after { content: "\\2713"; position: absolute; }
.dice-floor[disabled] { filter: grayscale(1) brightness(0.45); cursor: default; }
.dice-drops { flex: none; width: calc(210 * var(--u)); border: calc(4 * var(--u)) solid var(--ink); border-radius: calc(16 * var(--u)); background: linear-gradient(180deg, #2a2c33, #1d1e23); overflow: hidden; display: flex; flex-direction: column; }
.dice-drops__head { padding: calc(10 * var(--u)); font-size: calc(26 * var(--u)); background: repeating-conic-gradient(rgba(255,255,255,0.09) 0 25%, transparent 0 50%) 0 0 / calc(24 * var(--u)) calc(24 * var(--u)), linear-gradient(180deg, #4fd35a, #25a33a); border-bottom: calc(4 * var(--u)) solid var(--ink); }
.dice-drops__list { padding: calc(10 * var(--u)); display: grid; grid-template-columns: 1fr 1fr; gap: calc(8 * var(--u)); align-content: start; }
.dice-drops__title { grid-column: 1 / -1; text-align: center; font-size: calc(19 * var(--u)); margin-top: calc(6 * var(--u)); }
.dice-drop { position: relative; aspect-ratio: 1; border: calc(3 * var(--u)) solid var(--ink); border-radius: calc(10 * var(--u)); background: linear-gradient(180deg, #2f5fb0, #1a3470); display: grid; place-items: center; }
.dice-drop--mega { background: linear-gradient(180deg, #6a3ab0, #3a1a70); }
.dice-drop span { position: absolute; left: calc(4 * var(--u)); bottom: calc(2 * var(--u)); font-size: calc(13 * var(--u)); }
.dice-section-title { font-size: calc(26 * var(--u)); text-align: center; margin: calc(2 * var(--u)) 0 calc(6 * var(--u)); }
.dice-tower-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: calc(12 * var(--u)); }
.dice-floorinfo { display: flex; align-items: center; justify-content: space-between; gap: calc(10 * var(--u)); padding: calc(8 * var(--u)) calc(12 * var(--u)); border-radius: calc(12 * var(--u)); background: rgba(255,255,255,0.05); font-size: calc(18 * var(--u)); }
.dice-enemies { display: flex; gap: calc(6 * var(--u)); }
.dice-enemies img { width: calc(52 * var(--u)); height: calc(52 * var(--u)); border-radius: calc(10 * var(--u)); border: calc(3 * var(--u)) solid var(--ink); background: #3a1a2a; object-fit: cover; }

/* ------------------------------------------------------------ roll strip */
.dice-roll { position: fixed; inset: 0; z-index: 50; pointer-events: none; display: grid; place-items: center; }
.dice-roll[hidden] { display: none; }
.dice-roll__dim { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(10,14,40,0.25), rgba(4,6,20,0.72)); opacity: 0; transition: opacity 200ms ease; }
.dice-roll.is-open .dice-roll__dim { opacity: 1; }
.dice-roll__window { position: relative; width: min(calc(1100 * var(--u)), 96vw); height: calc(250 * var(--u)); overflow: hidden; border-top: calc(5 * var(--u)) solid var(--ink); border-bottom: calc(5 * var(--u)) solid var(--ink); background: linear-gradient(180deg, rgba(34, 38, 62, 0.95), rgba(20, 22, 36, 0.95)); -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.dice-roll__strip { position: absolute; left: 0; top: calc(20 * var(--u)); display: flex; gap: calc(16 * var(--u)); will-change: transform; }
.dice-roll__marker { position: absolute; left: 50%; top: 0; bottom: 0; width: calc(6 * var(--u)); transform: translateX(-50%); background: #ffd23a; box-shadow: 0 0 calc(16 * var(--u)) #ffd23a; z-index: 2; }
.dice-roll__marker::before, .dice-roll__marker::after { content: ""; position: absolute; left: 50%; transform: translateX(-50%); border: calc(14 * var(--u)) solid transparent; }
.dice-roll__marker::before { top: 0; border-top-color: #ffd23a; }
.dice-roll__marker::after { bottom: 0; border-bottom-color: #ffd23a; }
.dice-rollcard { --r: #d6dde8; position: relative; flex: none; width: calc(170 * var(--u)); height: calc(210 * var(--u)); border: calc(4 * var(--u)) solid var(--ink); border-radius: calc(16 * var(--u)); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--r) 55%, #2a2c34), #17181e 80%); box-shadow: inset 0 0 0 calc(4 * var(--u)) var(--r); overflow: hidden; }
.dice-rollcard img { position: absolute; inset: 4% 0 22%; width: 100%; height: 74%; object-fit: contain; }
.dice-rollcard__name { position: absolute; left: 0; right: 0; bottom: calc(26 * var(--u)); text-align: center; font-size: calc(19 * var(--u)); }
.dice-rollcard__odds { position: absolute; left: 0; right: 0; bottom: calc(6 * var(--u)); text-align: center; font-size: calc(14 * var(--u)); color: var(--r); }

/* The obtain reveal. */
.dice-reveal { position: absolute; display: grid; place-items: center; pointer-events: none; }
.dice-reveal[hidden] { display: none; }
.dice-reveal__rays { position: absolute; width: calc(900 * var(--u)); height: calc(900 * var(--u)); border-radius: 50%; background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--r) 55%, transparent) 0 10deg, transparent 10deg 20deg); -webkit-mask-image: radial-gradient(circle, #000 20%, transparent 68%); mask-image: radial-gradient(circle, #000 20%, transparent 68%); animation: dice-spin 6s linear infinite; opacity: 0.9; }
.dice-reveal__burst { position: absolute; width: calc(520 * var(--u)); height: calc(520 * var(--u)); border-radius: 50%; background: radial-gradient(circle, #fff 0, var(--r) 30%, transparent 68%); animation: dice-burst 700ms ease-out forwards; }
@keyframes dice-spin { to { transform: rotate(360deg); } }
@keyframes dice-burst { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
.dice-reveal__card { pointer-events: auto; cursor: pointer; position: relative; width: calc(290 * var(--u)); height: calc(360 * var(--u)); border: calc(6 * var(--u)) solid var(--ink); border-radius: calc(24 * var(--u)); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--r) 70%, #2a2c34), #121318 80%); box-shadow: inset 0 0 0 calc(6 * var(--u)) var(--r), 0 0 calc(50 * var(--u)) var(--r); overflow: hidden; animation: dice-pop-in 520ms cubic-bezier(.2,1.6,.4,1) both; }
.dice-reveal__card img { position: absolute; inset: 3% 0 20%; width: 100%; height: 77%; object-fit: contain; }
.dice-reveal__card--rainbow { animation: dice-pop-in 520ms cubic-bezier(.2,1.6,.4,1) both, dice-hue 2.4s linear infinite; }
@keyframes dice-hue { to { filter: hue-rotate(360deg); } }
@keyframes dice-pop-in { 0% { transform: scale(0.1) rotate(-25deg); opacity: 0; } 60% { transform: scale(1.12) rotate(4deg); opacity: 1; } 100% { transform: scale(1) rotate(0); } }
.dice-reveal__name { position: absolute; left: 0; right: 0; bottom: calc(40 * var(--u)); text-align: center; font-size: calc(36 * var(--u)); }
.dice-reveal__rarity { position: absolute; left: 0; right: 0; bottom: calc(10 * var(--u)); text-align: center; font-size: calc(22 * var(--u)); color: var(--r); }
.dice-reveal__stack { position: relative; display: flex; flex-direction: column; align-items: center; gap: calc(14 * var(--u)); }
.dice-reveal__top { white-space: nowrap; font-size: calc(42 * var(--u)); color: var(--r); animation: dice-rise 500ms 200ms ease-out both; }
.dice-reveal__foot { white-space: nowrap; font-size: calc(26 * var(--u)); animation: dice-rise 400ms 300ms ease-out both; }
@keyframes dice-rise { from { opacity: 0; transform: translateY(calc(-16 * var(--u))); } to { opacity: 1; transform: none; } }
.dice-reveal__foot b { color: #6dff5a; }
@keyframes dice-drop-in { from { opacity: 0; transform: translate(-50%, calc(-20 * var(--u))); } to { opacity: 1; transform: translate(-50%, 0); } }
.dice-reveal__badge { position: absolute; top: calc(10 * var(--u)); right: calc(10 * var(--u)); font-size: calc(18 * var(--u)); padding: 0 calc(8 * var(--u)); border-radius: calc(8 * var(--u)); border: calc(3 * var(--u)) solid var(--ink); background: #ff3d6e; animation: dice-bob 1s ease-in-out infinite; }
.dice-confetti { position: absolute; width: calc(12 * var(--u)); height: calc(18 * var(--u)); border-radius: calc(3 * var(--u)); animation: dice-confetti 1.8s ease-out forwards; }
@keyframes dice-confetti { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
.dice-mini-result { position: absolute; bottom: calc(18% + var(--safe-b)); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: calc(10 * var(--u)); padding: calc(6 * var(--u)) calc(18 * var(--u)); border: calc(4 * var(--u)) solid var(--ink); border-radius: calc(999 * var(--u)); background: linear-gradient(180deg, #333749, #20232f); font-size: calc(24 * var(--u)); animation: dice-drop-in 300ms ease-out both; }
.dice-mini-result img { width: calc(46 * var(--u)); height: calc(46 * var(--u)); border-radius: 50%; background: radial-gradient(circle, var(--r), #1a1c22 75%); object-fit: cover; }

/* ---------------------------------------------------------------- battle */
.dice-battle { position: fixed; inset: 0; z-index: 55; display: grid; place-items: center; background: radial-gradient(ellipse at center, #3a1f4a, #120a1c 75%); }
.dice-battle[hidden] { display: none; }
.dice-battle__stage { position: relative; width: min(calc(1300 * var(--u)), 98vw); height: min(calc(680 * var(--u)), 94vh); }
.dice-battle__title { position: absolute; top: calc(8 * var(--u)); left: 50%; transform: translateX(-50%); font-size: calc(40 * var(--u)); white-space: nowrap; }
.dice-battle__vs { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%); font-size: calc(80 * var(--u)); color: #ffd23a; opacity: 0.9; }
.dice-battle__queue { position: absolute; bottom: calc(10 * var(--u)); display: flex; gap: calc(8 * var(--u)); }
.dice-battle__queue--p { left: calc(20 * var(--u)); }
.dice-battle__queue--e { right: calc(20 * var(--u)); flex-direction: row-reverse; }
.dice-mini { --r: #d6dde8; width: calc(74 * var(--u)); height: calc(92 * var(--u)); border: calc(3 * var(--u)) solid var(--ink); border-radius: calc(10 * var(--u)); background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--r) 45%, #2a2c34), #15161b 80%); position: relative; overflow: hidden; transition: opacity 300ms ease, transform 300ms ease; }
.dice-mini img { width: 100%; height: 100%; object-fit: contain; }
.dice-mini.is-out { opacity: 0.25; filter: grayscale(1); transform: scale(0.85); }
.dice-mini.is-active { box-shadow: 0 0 0 calc(3 * var(--u)) #fff; }
.dice-bcard { --r: #d6dde8; position: absolute; top: 44%; width: calc(290 * var(--u)); height: calc(380 * var(--u)); transform: translate(-50%, -50%); transition: transform 180ms ease, opacity 300ms ease; }
.dice-bcard--p { left: 27%; }
.dice-bcard--e { left: 73%; }
.dice-bcard__face { position: absolute; inset: 0; border: calc(6 * var(--u)) solid var(--ink); border-radius: calc(20 * var(--u)); background: repeating-conic-gradient(from 0deg at 50% 45%, rgba(255,255,255,0.06) 0 8deg, transparent 8deg 16deg), radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--r) 55%, #2a2c34), #121318 80%); box-shadow: inset 0 0 0 calc(5 * var(--u)) var(--r), 0 calc(10 * var(--u)) 0 rgba(0,0,0,0.4); overflow: hidden; }
.dice-bcard__face img { position: absolute; inset: 12% 0 16%; width: 100%; height: 72%; object-fit: contain; }
.dice-bcard--e .dice-bcard__face img { transform: scaleX(-1); }
.dice-bcard__name { position: absolute; left: 0; right: 0; bottom: calc(46 * var(--u)); text-align: center; font-size: calc(26 * var(--u)); }
.dice-bcard__boss { position: absolute; top: calc(10 * var(--u)); left: 50%; transform: translateX(-50%); font-size: calc(18 * var(--u)); color: #ff4b6a; }
.dice-hpbar { position: absolute; left: calc(14 * var(--u)); right: calc(14 * var(--u)); bottom: calc(12 * var(--u)); height: calc(26 * var(--u)); border: calc(3 * var(--u)) solid var(--ink); border-radius: calc(8 * var(--u)); background: #2a0a10; overflow: hidden; }
.dice-hpbar__fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(180deg, #6dff5a, #1f9e3a); transition: width 260ms ease; }
.dice-hpbar__lag { position: absolute; inset: 0 auto 0 0; background: #ffd23a; transition: width 700ms ease 150ms; }
.dice-hpbar__text { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(16 * var(--u)); }
.dice-bcard__stats { position: absolute; top: calc(-44 * var(--u)); left: 0; right: 0; display: flex; justify-content: center; gap: calc(18 * var(--u)); font-size: calc(24 * var(--u)); }
.dice-bcard.is-lunge-p { transform: translate(-10%, -50%) rotate(6deg); }
.dice-bcard.is-lunge-e { transform: translate(-90%, -50%) rotate(-6deg); }
.dice-bcard.is-hit { animation: dice-hit 280ms ease; }
@keyframes dice-hit { 0% { filter: brightness(3); } 30% { transform: translate(-50%, -50%) translateX(calc(10 * var(--u))) rotate(-3deg); } 60% { transform: translate(-50%, -50%) translateX(calc(-8 * var(--u))) rotate(2deg); } 100% { filter: none; } }
.dice-bcard.is-dead { animation: dice-dead 650ms ease forwards; }
@keyframes dice-dead { 0% { transform: translate(-50%, -50%); opacity: 1; } 30% { transform: translate(-50%, -50%) rotate(-8deg) scale(1.05); filter: brightness(2) saturate(0); } 100% { transform: translate(-50%, 20%) rotate(25deg) scale(0.6); opacity: 0; filter: grayscale(1); } }
.dice-bcard.is-enter { animation: dice-enter 450ms cubic-bezier(.2,1.4,.4,1) both; }
@keyframes dice-enter { 0% { transform: translate(-50%, -140%) rotate(-12deg) scale(0.7); opacity: 0; } 100% { transform: translate(-50%, -50%); opacity: 1; } }
.dice-dmg { position: absolute; font-size: calc(46 * var(--u)); color: #ffffff; animation: dice-dmg 900ms ease-out forwards; pointer-events: none; z-index: 5; white-space: nowrap; }
.dice-dmg--crit { color: #ffd23a; font-size: calc(62 * var(--u)); }
.dice-dmg--heal { color: #6dff5a; }
.dice-dmg--ability { color: #ff7ad0; }
@keyframes dice-dmg { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.6); } 15% { opacity: 1; transform: translate(-50%, calc(-20 * var(--u))) scale(1.2); } 100% { opacity: 0; transform: translate(-50%, calc(-110 * var(--u))) scale(1); } }
.dice-callout { position: absolute; top: 18%; left: 50%; transform: translateX(-50%); font-size: calc(44 * var(--u)); white-space: nowrap; animation: dice-callout 900ms ease-out forwards; z-index: 6; }
@keyframes dice-callout { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.4); } 20% { opacity: 1; transform: translate(-50%, 0) scale(1.15); } 80% { opacity: 1; transform: translate(-50%, 0) scale(1); } 100% { opacity: 0; transform: translate(-50%, calc(-20 * var(--u))) scale(1); } }
.dice-fx { position: absolute; pointer-events: none; z-index: 4; }
.dice-fx--beam { height: calc(60 * var(--u)); border-radius: calc(30 * var(--u)); background: linear-gradient(90deg, transparent, var(--c), #fff, var(--c), transparent); box-shadow: 0 0 calc(40 * var(--u)) var(--c); animation: dice-beam 450ms ease-out forwards; }
@keyframes dice-beam { 0% { transform: scaleX(0); opacity: 1; } 50% { transform: scaleX(1); opacity: 1; } 100% { transform: scaleX(1) scaleY(0.2); opacity: 0; } }
.dice-fx--slash { width: calc(360 * var(--u)); height: calc(26 * var(--u)); border-radius: 50%; background: linear-gradient(90deg, transparent, #fff, var(--c), transparent); box-shadow: 0 0 calc(30 * var(--u)) var(--c); animation: dice-slash 380ms ease-out forwards; }
@keyframes dice-slash { 0% { transform: translate(-50%, -50%) rotate(-35deg) scaleX(0.2); opacity: 1; } 100% { transform: translate(-50%, -50%) rotate(-35deg) scaleX(1.2); opacity: 0; } }
.dice-fx--burst { width: calc(320 * var(--u)); height: calc(320 * var(--u)); border-radius: 50%; background: radial-gradient(circle, #fff 0, var(--c) 30%, transparent 70%); animation: dice-burst 500ms ease-out forwards; transform: translate(-50%, -50%); }
.dice-fx--ring { width: calc(280 * var(--u)); height: calc(280 * var(--u)); border-radius: 50%; border: calc(10 * var(--u)) solid var(--c); box-shadow: 0 0 calc(30 * var(--u)) var(--c); animation: dice-ring 600ms ease-out forwards; transform: translate(-50%, -50%); }
@keyframes dice-ring { 0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; } }
.dice-shake { animation: dice-screenshake 300ms linear; }
@keyframes dice-screenshake { 0%, 100% { transform: none; } 25% { transform: translate(calc(6 * var(--u)), calc(-4 * var(--u))); } 50% { transform: translate(calc(-6 * var(--u)), calc(4 * var(--u))); } 75% { transform: translate(calc(4 * var(--u)), calc(2 * var(--u))); } }
.dice-result { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,0.45); z-index: 8; animation: dice-open 260ms ease-out; }
.dice-result[hidden] { display: none; }
.dice-result__panel { display: flex; flex-direction: column; align-items: center; gap: calc(14 * var(--u)); padding: calc(24 * var(--u)) calc(40 * var(--u)); border: calc(5 * var(--u)) solid var(--ink); border-radius: calc(22 * var(--u)); background: linear-gradient(180deg, var(--win), var(--win2)); min-width: calc(420 * var(--u)); }
.dice-result__title { font-size: calc(64 * var(--u)); line-height: 1; animation: dice-pop-in 600ms cubic-bezier(.2,1.6,.4,1) both; }
.dice-result__title--win { color: #ffd23a; }
.dice-result__title--lose { color: #ff5a5a; }
.dice-result__loot { display: flex; flex-wrap: wrap; gap: calc(10 * var(--u)); justify-content: center; font-size: calc(22 * var(--u)); }
.dice-loot { display: flex; align-items: center; gap: calc(6 * var(--u)); padding: calc(4 * var(--u)) calc(12 * var(--u)); border-radius: calc(12 * var(--u)); background: rgba(255,255,255,0.08); }
.dice-loot svg { width: calc(34 * var(--u)); height: calc(34 * var(--u)); }
.dice-battle__skip { position: absolute; top: calc(10 * var(--u)); right: calc(10 * var(--u)); z-index: 9; }

/* ---------------------------------------------------------- touch layout */
body.dice-touch .dice-bar { left: auto; right: calc(max(100px, 150 * var(--u)) + var(--safe-r)); transform: none; gap: calc(14 * var(--u)); }
body.dice-touch .dice-auto, body.dice-touch .dice-autosell-btn { min-height: calc(56 * var(--u)); font-size: calc(22 * var(--u)); top: calc(-62 * var(--u)); }
body.dice-touch .dice-rollcost { display: none; }
body.dice-touch .dice-big__art { width: calc(96 * var(--u)); height: calc(96 * var(--u)); }
body.dice-touch .dice-big--roll .dice-big__art { width: calc(124 * var(--u)); height: calc(124 * var(--u)); }
@media (max-height: 520px) {
  :root { --u: clamp(0.5px, min(100vw / 1500, 100vh / 700), 1.3px); }
  .dice-window { width: min(calc(1180 * var(--u)), calc(100vw - 16px - var(--safe-l) - var(--safe-r))); }
  .dice-tabs { position: static; flex-direction: column; }
  .dice-detail { width: calc(270 * var(--u)); }
}
`;
  document.head.append(style);
};
