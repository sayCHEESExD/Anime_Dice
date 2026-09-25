# Anime Dice

A browser multiplayer anime character collection and idle-income game. Players roll a dice ($1) for characters and display them on a 20-stand plot that earns Cash/s. They field a 4-card team in the central Tower's card battles for potions, and buy upgrades and rebirths. Three.js client, Colyseus server, npm workspaces (`shared` / `server` / `client`). Infrastructure (Bloxity auth, persistence, Bux grants, deploy, verify scripts) follows `D:\+1 Superhero Evoluion`. Gameplay, world and UI are this game's own.

## Commands

```bash
npm run dev                 # builds shared, then server (tsx watch, :2620) + Vite client (:5220)
npm run build               # shared + server + client (client/dist)
npm run typecheck           # all workspaces
npm run verify              # verify:data + verify:progression + verify:assets (no server needed)
node scripts/verify-multiplayer.mjs   # needs `npm run build:server`; spawns its own server on :2699
npm run verify:persistence  # identity/storage/migration/grants, JSON and Mongo (if mongod is found)
npm run verify:capacity     # needs a running server on :2620
npm run size:client         # client/dist against the 12 MB budget (~7.4 MB; the two music tracks are ~6 MB)
```

Do NOT use python from the Bash tool on this machine; use node/sed/perl. Write multi-line edit scripts with node (heredocs with backticks break). Rebuilding `shared` while the dev server runs sets off a Vite HMR storm. Restart the preview afterwards. The in-app browser pane does not run requestAnimationFrame while it is hidden, so drive `window.__dice.game.update(1/60)` by hand in checks.

## Non-negotiable rules

- Ports: server **2620**, Vite **5220**, preview 4220. Room `animedice`, Bloxity slug `anime-dice` (`shared/src/config/accounts.ts`; the client's `Bloxity.ts` reads it). 15 players per room, 16 plots per room.
- **Data is separate from systems.** Characters: `shared/src/data/characters.ts` (rows) plus `characterTypes.ts` (schema) plus `rarities.ts`. Nothing branches on a character id. Stats come from `odds` and `role` (`systems/stats.ts`). The 3D model comes from `look` (`client/src/characters/LookPainter.ts` paints the supplied rig's atlas, and `Accessories.ts` builds hair and gear from primitives). Card art is rendered from the model (`ui/CharacterPortraits.ts`). Stand VFX come from `vfx` (`world/StandVfx.ts`, shader-only). Abilities come from `ability`, and the battle system knows the 7 KINDS, never a character. Add a character = add a row, then run `npm run verify:data`.
- **Every tunable in one place per system**: `config/progression.ts` (stat curve, roles, unit levels, sell, the rebirth ladder, the upgrade tree, combat constants), `config/dice.ts`, `config/display.ts` (20 slots; slot N>5 needs N-5 rebirths; team of 4), `config/potions.ts`, `config/tower.ts` (40 floors as lineups of character ids, tiers, curve, rewards), `config/map.ts` (the whole layout plus the collision boxes, ramps and trigger zones).
- **Server-authoritative.** Clients send requests (`MessageType`); services validate against server state: `server/src/progression/` holds `DiceService` (cooldown, storage cap, cost, free roll, luck, auto-sell), `InventoryService` (display, team, level, sell, lock, potions), `EconomyService` (the ONLY writer of Cash/s, Luck and the public stands; income is credited once a second), `UpgradeService`, `RebirthService` (resets CASH ONLY), and `TowerService` (floor gating, must be on the terrace, resolves the whole battle with a seed, then pays). Cash moves only through `Wallet`.
- **Public vs private state.** `PlayerState` (replicated to everyone) holds transform, identity, plot, the 20 `DisplaySlotState`s, cash, Cash/s, luck, rebirths and board figures. The inventory, potions, upgrades, team and tower progress are PRIVATE: `Inventory` (full) and then `UnitDelta` messages, and `Private` (small block, sent whole on change). Do not add a StateView.
- **Display and team are separate lists** of unit uids. A unit may be in both. Units are instances: duplicates are separate, and each has its own level, potions and lock. Mythic and rarer pulls are auto-locked. New units auto-fill empty open stands.
- **Battles** (`shared/src/systems/battle.ts`) are deterministic from a seed. The server sends the event log, and `client/src/ui/BattleView.ts` plays it back as card animations. Never simulate combat on the client.
- **Persistence**: per-key storage (`server/src/persistence/`), Mongo via `MONGODB_URI` else JSON (`DICE_DATA_DIR`, default `server/data`). The profile is read at join, the Bloxity token is verified server-side, guests migrate to accounts, and Bux webhook grants add Cash. The leaderboard cache loads a projection (`BOARD_FIELDS`), never inventories. The profile schema and its coercion live in `persistence/StoredProfile.ts`.
- **Client budget 12 MB.** Only `assets/` ships as files (`base_rig.fbx` and `shop.png` are pruned by `client/vite.config.ts`). Everything else is code: canvas textures (`world/WorldTextures.ts`), primitives (`render/PartBuilder.ts`), synthesized UI sounds (`audio/AudioManager.ts`). The battle music element is created only on the first battle.

## Layout facts (`shared/src/config/map.ts`)

- The central tower (r 13, 118 tall) stands on a terrace [-30,30]² with its top at y 5. Escalators (RAMP plus conveyor in `PlayerSim`) climb it from the north (z 43→30) and south, and stairs from the east and west. The tower doors at z ±16 open the Tower window. A fight is allowed anywhere on the terrace (`onTowerTerrace`).
- There are 16 plots, 4 per side, with the front edge 90 from the centre and local +Z into the plot (`plotToWorld`). Each is 40×46: a floor slab (top y 1), a red carpet, 10 ground stands (x ±13, z 8..40) and 10 on the upper galleries (deck top y 10). Slot order: ground +x column (free), ground −x (rebirths 1-5), upper +x, upper −x. The plot's own escalator runs up the carpet (z 21→40) to the back bridge. Level pads sit on the carpet side of each stand (`padAt`). The owner's banner hangs under the entrance arch.
- Plaza: UPGRADES and SELL UNITS stalls at z −62 (front zones open their windows), the Rarest, Rolls and Money boards at z 66-70 facing the tower, the dice monument east, and the fountain west.
- `client/src/world/PlotView.ts` builds characters, labels and VFX only for plots near the camera (at most 3 character builds per frame). Only near stands animate.

## Look

The HUD is one unit, `--u` (`client/src/ui/diceStyles.ts`), and every length is a multiple of it. Windows use a checkered header with the red checkered X, as in the reference screenshots. The HUD layout: Cash and Cash/s top-left with the Luck and Rebirth chips; the rail on the left (Rebirth, Team, Index); the BACKPACK / ROLL / UPGRADES bar at the bottom centre with AUTO and auto-SELL above the die; music in the corner. In touch mode the bar moves right, between the stick and JUMP.
