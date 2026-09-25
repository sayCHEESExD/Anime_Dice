# Anime Dice

Roll the dice to collect anime characters, show them off in a two-storey display hall that earns you Cash every second, and field your best four in card battles up the central Tower for potions. Rebirth for bigger multipliers and more stands. Fifteen players a room, and the server decides everything.

Three.js client, authoritative Colyseus server, npm workspaces (`shared` / `server` / `client`). Hosted on Bloxity.

## Run it

```bash
npm install
npm run dev
```

The client runs at <http://localhost:5220> and the Colyseus server on port 2620. Without `MONGODB_URI`, the server keeps profiles in `server/data/profiles.json`.

## Controls

| | Desktop | Touch |
| --- | --- | --- |
| Move / jump | WASD / Space | stick / JUMP |
| Camera | drag with either mouse button, wheel to zoom | drag the right side of the screen |
| Roll / Auto Spin | ROLL button or E / AUTO or Q | ROLL / AUTO |
| Backpack, Upgrades, Rebirth, Team, Index | B, U, R, T, I | the buttons |

Walk onto a green pad in front of one of your stands to level that unit up. Walk into a Tower door to fight. The shop stalls south of the Tower open Upgrades and Sell Units.

## Verify it

```bash
npm run verify               # data rows, pinned progression figures, supplied asset digests
npm run build && npm run size:client
node scripts/verify-multiplayer.mjs   # spawns a server: every system end to end with real clients
npm run verify:persistence   # guests, accounts, cross-device, restarts, Bux grants; JSON + Mongo when a mongod is found
npm run verify:capacity      # against a running server: 15 per room, overflow routed, empty rooms close
```

## Deploy

Deploys go to Bloxity Hosting through `.github/workflows/deploy.yml`, under the game id `anime-dice`:

| branch | channel | backend | frontend |
| --- | --- | --- | --- |
| `dev` | dev | `wss://anime-dice.dev.host.bloxity.io` | `https://anime-dice.dev.play.bloxity.io` |
| `main` | prod | `wss://anime-dice.host.bloxity.io` | `https://anime-dice.play.bloxity.io` |

The workflow builds the server image from the repository root (`Dockerfile`) and rolls it through Legion. It then builds the client with that channel's backend URL and uploads it as a zip. It needs one repository secret: `LEGION_DEPLOY_TOKEN`. Legion injects `PORT`, `MONGODB_URI`, `BLOXITY_GAME_ID` and `POD_NAME`. The Bux SKUs `cash_small` ($25,000) and `cash_large` ($250,000) have to exist in the game's Bloxity catalogue.

See `CLAUDE.md` for the layout, the rules that must not drift, and where everything lives.
