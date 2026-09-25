/**
 * END-TO-END CHECK of every server system, against a REAL server with REAL
 * clients. Seeds a few profiles into a fresh JSON store, spawns the built
 * server, and plays the game through colyseus.js:
 *
 *   rolls (cost, inventory, auto-display, income), the free roll, auto-sell,
 *   the storage cap, display slot rules, level-up (by uid and by pad slot),
 *   sell / lock, potions, every upgrade's effect, rebirth (cash reset,
 *   multipliers, slots, nothing else lost), walking up the escalator to the
 *   tower and fighting floors with a 4-unit team (rewards, progress, gating),
 *   persistence across a reconnect, and a second player seeing the first's
 *   plot and stands.
 *
 *   npm run build && node scripts/verify-multiplayer.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'colyseus.js';
import * as S from '../shared/dist/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 2699;
const dataDir = mkdtempSync(join(tmpdir(), 'dice-verify-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, label, detail = '') => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label} ${detail}`);
  }
};

// ---------------------------------------------------------------- seeds
const unit = (u, c, l = 1, p = {}, k = false) => ({ u, c, l, p, k });
const seeds = {
  p_rich: {
    cash: 1_000_000, lifetimeCash: 1_000_000, rebirths: 0, totalRolls: 5, bestOdds: 9500,
    units: [unit(1, 'supergokku'), unit(2, 'vegita'), unit(3, 'friza'), unit(4, 'tien'), unit(5, 'naruta'), unit(6, 'naruta'), unit(7, 'saibaman')],
    nextUid: 8, display: [1, 0, 0, 0, 0], team: [], potions: { atk_s: 2, hp_s: 1, level_gem: 1 }, upgrades: {},
    discovered: S.CHARACTERS.map((c) => c.id), updatedAt: 1,
  },
  p_broke: { cash: 0, units: [], nextUid: 1, discovered: [], updatedAt: 1 },
  p_full: {
    cash: 100, units: Array.from({ length: 50 }, (_, i) => unit(i + 1, 'naruta')), nextUid: 51,
    discovered: ['naruta'], updatedAt: 1,
  },
};
writeFileSync(join(dataDir, 'profiles.json'), JSON.stringify(seeds));

const server = spawn(process.execPath, [join(root, 'server/dist/index.js'), '--port', String(PORT)], {
  env: { ...process.env, DICE_DATA_DIR: dataDir, MONGODB_URI: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));
await wait(2500);

/** A test client with its private view and a helper to await messages. */
const join_ = async (playerId) => {
  const client = new Client(`ws://127.0.0.1:${PORT}`);
  const room = await client.joinOrCreate('animedice', { playerId });
  const me = { room, units: new Map(), priv: null, notices: [], rolled: [], battles: [] };
  room.onMessage('inventory', (m) => {
    me.units.clear();
    for (const u of m.units) me.units.set(u.u, u);
  });
  room.onMessage('unitDelta', (m) => {
    for (const u of m.add ?? []) me.units.set(u.u, u);
    for (const u of m.update ?? []) me.units.set(u.u, u);
    for (const id of m.remove ?? []) me.units.delete(id);
  });
  room.onMessage('private', (m) => (me.priv = m));
  room.onMessage('notice', (m) => me.notices.push(m.text));
  room.onMessage('rolled', (m) => me.rolled.push(m));
  room.onMessage('battle', (m) => me.battles.push(m));
  room.onMessage('respawn', () => {});
  room.onMessage('authState', () => {});
  me.state = () => room.state.players.get(room.sessionId);
  await wait(600);
  return me;
};

/** Walk to a point by sending inputs like a client (the server simulates). */
const walkTo = async (me, x, z, seconds = 12) => {
  let seq = me.seq ?? 0;
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) {
    const p = me.state();
    const dx = x - p.x;
    const dz = z - p.z;
    if (Math.hypot(dx, dz) < 1.2) break;
    const yaw = Math.atan2(dx, dz);
    for (let k = 0; k < 3; k += 1) {
      seq += 1;
      me.room.send('move', { seq, dt: 1 / 60, moveX: 0, moveZ: 1, jump: false, cameraYaw: yaw });
    }
    await wait(50);
  }
  me.seq = seq;
  await wait(300);
};

try {
  // ------------------------------------------------------------ fresh player
  console.log('\nFresh player: rolls, auto-display, income');
  const a = await join_('p_fresh1');
  check(a.state().cash === S.ECONOMY.startingCash, 'starts with the starting cash', a.state().cash);
  check(a.units.size === 0, 'starts with no units');
  for (let i = 0; i < 6; i += 1) {
    a.room.send('roll', {});
    await wait(1150);
  }
  check(a.rolled.length === 6, 'six rolls accepted', a.rolled.length);
  check(a.units.size === 6, 'six units in the inventory', a.units.size);
  check(a.priv.display.filter(Boolean).length === 5, 'first five auto-placed on the free stands');
  check(a.priv.display[5] === 0, 'stand 6 (rebirth 1) left empty');
  check(a.state().cashPerSec > 0, 'displayed units earn Cash/s', a.state().cashPerSec);
  const cash0 = a.state().cash;
  await wait(2200);
  check(a.state().cash >= cash0 + a.state().cashPerSec * 1.5, 'income is credited over time', `${cash0} -> ${a.state().cash}`);
  a.room.send('roll', {});
  a.room.send('roll', {});
  await wait(400);
  check(a.rolled.length === 7, 'a roll inside the cooldown is refused', a.rolled.length);

  // ------------------------------------------------------------ free roll & storage cap
  console.log('\nFree roll and storage cap');
  const broke = await join_('p_broke');
  broke.room.send('roll', {});
  await wait(500);
  check(broke.rolled.length === 1 && broke.rolled[0].free, 'a broke player with no income gets a free roll');
  const full = await join_('p_full');
  full.room.send('roll', {});
  await wait(500);
  check(full.rolled.length === 0 && full.notices.some((n) => n.includes('Backpack full')), 'a full backpack refuses the roll');
  await full.room.leave();
  await broke.room.leave();

  // ------------------------------------------------------------ rich player
  console.log('\nInventory: display, team, level, sell, lock, potions');
  const r = await join_('p_rich');
  check(r.units.size === 7 && r.state().cash === 1_000_000, 'seeded profile restored');
  r.room.send('display', { action: 'place', uid: 2, slot: 5 });
  await wait(300);
  check(r.notices.some((n) => n.includes('Rebirth 1')), 'stand 6 refuses before rebirth 1');
  r.room.send('display', { action: 'best' });
  await wait(300);
  check(r.priv.display.slice(0, 5).every(Boolean) && r.priv.display[0] === 1, 'equip best puts the top earner first');
  const cps0 = r.state().cashPerSec;
  const cost = S.levelUpCost(r.units.get(1));
  r.room.send('levelUp', { slot: 0 });
  await wait(300);
  check(r.units.get(1).l === 2, 'level up by pad slot');
  check(Math.abs(r.state().cash - (1_000_000 - cost)) < 5000, 'level up cost paid', cost);
  check(r.state().cashPerSec > cps0, 'leveling raises Cash/s', `${cps0} -> ${r.state().cashPerSec}`);
  r.room.send('lock', { uid: 6, locked: true });
  await wait(200);
  r.room.send('sell', { uids: [6] });
  await wait(300);
  check(r.units.has(6), 'a locked unit is not sold');
  r.room.send('lock', { uid: 6, locked: false });
  await wait(200);
  const before = r.state().cash;
  r.room.send('sell', { uids: [6] });
  await wait(300);
  check(!r.units.has(6) && r.state().cash > before, 'an unlocked, undisplayed unit sells for Cash');
  const atk0 = S.unitAttack(r.units.get(1));
  r.room.send('usePotion', { uid: 1, potion: 'atk_s' });
  r.room.send('usePotion', { uid: 1, potion: 'level_gem' });
  await wait(300);
  check(r.units.get(1).p.atk_s === 1, 'attack potion stored on the unit');
  check(r.units.get(1).l === 3, 'level crystal adds a level');
  check(S.unitAttack(r.units.get(1)) > atk0, 'potions raise attack');
  check(r.priv.potions.atk_s === 1 && !r.priv.potions.level_gem, 'potions consumed from the stash');

  console.log('\nUpgrades');
  for (const id of ['money', 'luck', 'storage', 'damage']) r.room.send('upgrade', { id });
  await wait(400);
  check(r.priv.upgrades.money === 1 && r.priv.upgrades.luck === 1 && r.priv.upgrades.storage === 1 && r.priv.upgrades.damage === 1, 'all four base upgrades bought');
  check(r.priv.storage === S.BASE_UNIT_STORAGE + 10, 'unit storage raises capacity', r.priv.storage);
  check(Math.abs(r.state().luck - 1.1) < 1e-6, 'luck upgrade raises luck', r.state().luck);
  r.room.send('upgrade', { id: 'health' });
  await wait(300);
  check(!r.priv.upgrades.health, 'rebirth-locked upgrade refused at rebirth 0');

  console.log('\nRebirth');
  const units = r.units.size;
  r.room.send('rebirth', {});
  await wait(400);
  check(r.state().rebirths === 1, 'rebirth 1 reached');
  check(r.state().cash < 5, 'rebirth resets cash', r.state().cash);
  check(r.units.size === units && r.priv.upgrades.money === 1 && r.priv.potions.hp_s === 1, 'units, upgrades and potions kept');
  check(Math.abs(r.state().luck - 1.5 * 1.1) < 1e-6, 'luck multiplier x1.5', r.state().luck);
  r.room.send('display', { action: 'place', uid: 2, slot: 5 });
  await wait(300);
  check(r.priv.display[5] === 2, 'stand 6 opens at rebirth 1');
  r.room.send('display', { action: 'place', uid: 3, slot: 6 });
  await wait(300);
  check(r.priv.display[6] === 0, 'stand 7 still needs rebirth 2');

  console.log('\nTower');
  r.room.send('team', { action: 'best' });
  await wait(300);
  check(r.priv.team.filter(Boolean).length === 4, 'equip best fills 4 team slots');
  r.room.send('towerFight', { floor: 1 });
  await wait(400);
  check(r.battles.length === 0 && r.notices.some((n) => n.includes('Walk into the Tower')), 'fighting away from the tower is refused');
  const plot = r.state().plot;
  const spawn = S.plotSpawn(plot);
  // Out of the plot, across the plaza to the foot of the nearest terrace escalator, and up.
  const esc = spawn.z > 0 ? { x: 0, z: 61, top: 28 } : { x: 0, z: -61, top: -28 };
  await walkTo(r, spawn.x * 0.5, esc.z, 10);
  await walkTo(r, esc.x, esc.z, 10);
  await walkTo(r, 0, esc.top, 8);
  check(r.state().y >= S.TERRACE.top - 0.1, 'the escalator carries the player onto the terrace', `y=${r.state().y.toFixed(2)}`);
  r.room.send('towerFight', { floor: 2 });
  await wait(300);
  check(r.battles.length === 0 && r.notices.some((n) => n.includes('Clear Floor 1')), 'floor 2 is locked until floor 1 is cleared');
  r.room.send('towerFight', { floor: 1 });
  await wait(600);
  const battle = r.battles[0];
  check(!!battle, 'a floor 1 battle is resolved');
  if (battle) {
    check(battle.player.length === 4 && battle.enemy.length >= 1, 'four fighters against the floor lineup');
    check(battle.victory, 'the seeded team wins floor 1');
    check(battle.firstClear && battle.cash > 0 && Object.keys(battle.potions).length > 0, 'first clear pays cash and potions');
    check(r.priv.towerBest === 1, 'tower progress saved');
    const last = battle.events[battle.events.length - 1];
    check(last && last.ko === 1 && last.s === 0, 'the log ends with the last enemy knocked out');
  }

  console.log('\nPersistence');
  const snapshot = { units: r.units.size, rebirths: r.state().rebirths, towerBest: r.priv.towerBest, level: r.units.get(1).l };
  await r.room.leave();
  await wait(800);
  const back = await join_('p_rich');
  check(back.units.size === snapshot.units && back.state().rebirths === snapshot.rebirths, 'units and rebirths survive a reconnect');
  check(back.priv.towerBest === snapshot.towerBest && back.units.get(1).l === snapshot.level && back.units.get(1).p.atk_s === 1, 'tower progress, levels and potions survive');

  console.log('\nMultiplayer visibility');
  const b = await join_('p_viewer');
  const seen = b.room.state.players.get(back.room.sessionId);
  check(!!seen, 'the second player sees the first');
  check(seen && seen.plot === back.state().plot && seen.plot !== b.state().plot, 'each player owns a different plot');
  const stands = seen ? [...seen.display].filter((s) => s.charId) : [];
  check(stands.length >= 5 && stands.every((s) => S.isCharacterId(s.charId) && s.income > 0), 'the first player\'s stands replicate with income', stands.length);
  check(b.room.state.leaderboard.rolls[0].value > 0, 'leaderboards populated');

  console.log('\nAuto-sell');
  back.room.send('setAutoSell', { mask: 0xff });
  await wait(300);
  back.room.send('roll', {});
  await wait(700);
  const sold = back.rolled[back.rolled.length - 1];
  check(sold && sold.sold > 0 && sold.uid === 0, 'a known character of a ticked rarity is sold on the spot');

  await back.room.leave();
  await b.room.leave();
  await a.room.leave();
} catch (error) {
  failures += 1;
  console.error(error);
} finally {
  server.kill('SIGINT');
  await wait(800);
  rmSync(dataDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED\n--- server log ---\n${log.slice(-3000)}`);
  process.exit(1);
}
console.log('\nverify:multiplayer - all checks passed');
process.exit(0);
