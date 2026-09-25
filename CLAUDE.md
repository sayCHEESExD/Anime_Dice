# Anime Dice

A browser multiplayer anime character collection and idle-income game. Players roll a dice ($1) for characters and display them on a 20-stand plot that earns Cash/s. They field a 4-card team in the central Tower's card battles for potions, and buy upgrades and rebirths. Three.js client, Colyseus server, npm workspaces (`shared` / `server` / `client`). Infrastructure (Bloxity auth, persistence, Bux grants, deploy, verify scripts) follows `D:\+1 Superhero Evoluion`. Gameplay, world and UI are this game's own.

## Commands

```bash
npm run dev                 # builds shared, then server (tsx watch, :2620) + Vite client (:5220)
npm run build               # shared + server + client (client/dist)
npm run typecheck           # all workspaces
npm run verify              # verify:data + verify:layout + verify:progression + verify:assets (no server needed)
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
- **Asset filenames are URL-safe** (letters, digits, `.`, `-`, `_`). The Bloxity static host stores a name with a space under its %-encoded form and answers 400 to every real request for it. That is how the music went silent in production. `verify:assets` fails on any such name.
- **The tower is a goal.** `TOWER_CURVE` (base 90, growth 1.215) puts floor 1 at about 20x a new player's best four. `verify:progression` pins that at most 3 of 60 simulated new players can clear floor 1 after 30 rolls, at most 9 after 100 rolls, and at least 20 after 300 rolls.
- **Selling**: only the LOCK protects a unit. A unit on a stand or in the team can be sold; the server takes it off (`removeUnit`) and re-derives Cash/s. Tapping a locked unit in sell mode says so. The bulk "Pick Commons/Uncommons" buttons still skip stand and team units.
- **Mouse look** (`input/MouseLook.ts`, ported from the reference project) locks the pointer to the camera. The first keypress or click arms it. A window frees the cursor, and closing it relocks. Escape frees the cursor until the player clicks the world. Where the lock is refused (a sandboxed frame, or the in-app preview pane), dragging steers instead.
- **Client budget 12 MB.** Only `assets/` ships as files (`base_rig.fbx` and `shop.png` are pruned by `client/vite.config.ts`). Everything else is code: canvas textures (`world/WorldTextures.ts`), primitives (`render/PartBuilder.ts`), synthesized UI sounds (`audio/AudioManager.ts`). The battle music element is created only on the first battle.

## Layout facts (`shared/src/config/map.ts`)

- The island is ±225 (`WORLD_HALF`) of grass inside a sand beach, in open sea. The central tower (r 16, 150 tall) stands on a terrace [-40,40]² with its top at y 5. Escalators (ramp plus conveyor in `PlayerSim`) climb it from the north (z 56→40) and south; stairs climb it from the east and west. Tower doors at z ±20 open the Tower window. A fight is allowed anywhere on the terrace (`onTowerTerrace`).
- **Four avenues** (`AVENUE`, `AVENUE_DIRS`) are pale tiled walking paths from the terrace out between the plot rows.
- **The loop track** (`LOOP`, `LOOP_WAYPOINTS`, `LOOP_SEGMENTS`) is ONE closed square, a one-way flat conveyor running clockwise round the island in front of every plot. It is 10 wide, centre line 128 (its outer edge is 17 from the plot fronts at 150), deck at y 0.3, speed 15. It has no side walls, so players walk on or off anywhere, and the avenues cross it on foot. It is built from the same ramp and conveyor as the escalators. Each side is a STRAIGHT plus a CORNER PIECE: the straight runs to the middle of the next corner square, and the piece turns riders onto the next straight's centre line. The pieces tile without overlapping. The visuals are in `DiceWorld.buildLoop`: the deck, the scrolling treads, and butt-jointed curbs along both edges. `npm run verify:layout` checks:
  - nothing solid is on the track, and its pieces join into one ring;
  - a rider standing still goes all the way round and back to the start;
  - you can step on and off every straight from the side;
  - every plot reaches the terrace with the real sim;
  - riding beats walking.
- 16 plots, 4 per side, 64 apart, front edge 150 from the centre, local +Z into the plot (`plotToWorld`). Each is 40×46: a floor slab (top y 1), a red carpet, 10 ground stands (x ±13, z 8..40) and 10 on the upper galleries (deck top y 10). Slot order: ground +x column (free), ground −x (rebirths 1-5), upper +x, upper −x. The plot's own escalator runs up the carpet to the back bridge. Level pads sit on the carpet side of each stand (`padAt`).
- Plaza points of interest, each beside an avenue and never on one: UPGRADES and SELL UNITS stalls at (±40, −96); the Rarest, Rolls, Money and Top Tower boards at x −74/−42/42/74 (z 100-104) facing the tower; the dice monument at (94, 44); the fountain at (−94, −44). Palms and lamps only line the avenues, inside the loop, and mark the terrace and island corners.
- **Plot shell** (`client/src/world/PlotShell.ts`): no two parts may share a face. Coplanar overlapping faces z-fight at the corners. Parts that meet either butt end to end (the rails trim their bars and leave the corner post to the rail they meet) or are inset by a few centimetres. There is no entrance arch. The owner banner hangs free over the front, with no panel or border. It shows a profile picture (the Bloxity portrait, else a coloured badge with the owner's initial) beside the outlined name and rebirth line.
- **Horizon fog**: scene `Fog` 170→470 by camera distance (`WORLD_FOG` in `client/src/config/worldVisuals.ts`). The ocean shader also fogs by distance from the island (`WORLD_HALF`+32 → +190), so the sea dissolves past the beach from anywhere. The sky dome fades to the fog colour at the horizon, and clouds fog too. There are no mountains. Camera far is 1100.
- `client/src/world/PlotView.ts` builds characters, labels and VFX only for plots near the camera (at most 3 builds per frame); only near stands animate. The camera ray-tests the collision boxes (`WorldCollision.raycast`) and never goes below the floor.
- The Bloxity SDK is injected asynchronously by `main.ts` with a 5-second cap. A blocking `<script>` tag on a stalled CDN once froze the page in "loading".

## Look

The HUD is one unit, `--u` (`client/src/ui/diceStyles.ts`), and every length is a multiple of it. Windows use a checkered header with the red checkered X, as in the reference screenshots. The HUD layout: ONE column at the left middle (`.dice-left`): Cash and Cash/s, then the Luck and Rebirth chips, then the rail (Rebirth, Team, Index); the BACKPACK / ROLL / UPGRADES bar at the bottom centre with AUTO and auto-SELL above the die; music in the corner. In touch mode the bar moves right, between the stick and JUMP.
