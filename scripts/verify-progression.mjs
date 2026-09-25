/**
 * THE PROGRESSION RULES, pinned: the spec's figures (upgrade prices, the first
 * rebirth, the display-slot ladder, the reference's income labels, the $1
 * roll) and the behaviour of the pure systems (luck really moves the odds,
 * battles are deterministic and follow the stats, potions and upgrades feed
 * the figures they should).
 *
 *   npm run verify:progression
 */
import * as S from '../shared/dist/index.js';

let failures = 0;
const check = (ok, label, detail = '') => {
  if (ok) console.log(`  ok    ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  }
};
const unit = (c, l = 1, p = {}) => ({ u: 1, c, l, p, k: false });

console.log('the dice');
check(S.DICE.cost === 1, 'a roll costs $1');

console.log('\nupgrades');
check(S.upgradeCost('money', 0) === 250, 'Money I costs $250');
check(S.upgradeCost('luck', 0) === 500, 'Luck I costs $500');
check(S.upgradeCost('storage', 0) === 2500, 'Unit Storage I costs $2,500');
check(S.upgradeCost('damage', 0) === 1000, 'Damage I costs $1,000');
for (const u of S.UPGRADES) {
  let ok = true;
  for (let level = 0; level < 20 && level + 1 < u.maxLevel; level += 1) {
    if (!(S.upgradeCost(u.id, level + 1) >= S.upgradeCost(u.id, level) * 1.8)) ok = false;
  }
  check(ok, `${u.name}: every level is substantially dearer (x1.8+)`);
}
check(S.unitCapacity({ storage: 3 }) === S.BASE_UNIT_STORAGE + 30, 'Unit Storage adds capacity');
check(S.cashMultiplier(0, { money: 2 }) > S.cashMultiplier(0, {}), 'Money raises the cash multiplier');
check(S.luckMultiplier(0, { luck: 2 }) > S.luckMultiplier(0, {}), 'Luck raises the luck multiplier');
check(S.damageMultiplier({ damage: 2 }) > S.damageMultiplier({}), 'Damage raises tower damage');

console.log('\nrebirth');
check(S.rebirthCost(0) === 50_000, 'Rebirth 1 needs $50,000');
check(S.cashMultiplier(0, {}) === 1 && S.luckMultiplier(0, {}) === 1, 'rebirth 0: 1x cash, 1x luck');
check(S.cashMultiplier(1, {}) === 1.5 && S.luckMultiplier(1, {}) === 1.5, 'rebirth 1: 1.5x cash, 1.5x luck');
let climbing = true;
for (let r = 1; r < 40; r += 1) {
  if (!(S.rebirthCost(r) > S.rebirthCost(r - 1)) || !(S.cashMultiplier(r, {}) > S.cashMultiplier(r - 1, {}))) climbing = false;
}
check(climbing, 'the rebirth curve keeps climbing (price and multipliers)');

console.log('\ndisplay slots');
check([0, 1, 2, 3, 4].every((i) => S.displaySlotRebirths(i) === 0), 'slots 1-5 are free');
check(S.displaySlotRebirths(5) === 1 && S.displaySlotRebirths(6) === 2 && S.displaySlotRebirths(7) === 3, 'slot 6 -> 1 rebirth, 7 -> 2, 8 -> 3');
check(S.displaySlotRebirths(19) === 15 && S.DISPLAY_SLOTS === 20, 'slot 20 needs 15 rebirths');
check(S.openDisplaySlots(0) === 5 && S.openDisplaySlots(15) === 20 && S.openDisplaySlots(40) === 20, 'open slots follow the ladder and cap at 20');
check(S.TEAM_SIZE === 4, 'a tower team is 4');

console.log('\nthe reference figures');
const byOdds = (odds) => S.baseIncome({ odds });
check(byOdds(6) === 3 && byOdds(20) === 8 && byOdds(52) === 17, '1 in 6 -> $3/s, 1 in 20 -> $8/s, 1 in 52 -> $17/s');
check(S.baseAttack(S.characterById('friza')) === 9.8 && S.baseHealth(S.characterById('friza')) === 9.8, 'Friza fights at 9.8 / 9.8');
check(S.baseAttack(S.characterById('tien')) === 5.6 && S.baseAttack(S.characterById('aizan')) === 2.8, 'Tien 5.6, Aizan 2.8');
check(S.levelUpCost(unit('tien')) === 48, 'levelling an $8/s unit to 2 costs $48');

console.log('\nlevels and potions feed the figures');
check(S.unitIncome(unit('tien', 2)) > S.unitIncome(unit('tien', 1)), 'a level raises income');
check(S.unitAttack(unit('tien', 1, { atk_s: 2 })) > S.unitAttack(unit('tien')), 'attack potions raise attack');
check(S.unitHealth(unit('tien', 1, { hp_l: 1 })) > S.unitHealth(unit('tien')), 'health potions raise health');
check(S.unitIncome(unit('tien', 1, { cash_s: 1 })) > S.unitIncome(unit('tien')), 'cash potions raise income');
check(S.potionRoom(unit('tien', 1, { atk_s: 10 }), 'atk_s') === 0, 'potion stacks are capped per unit');

console.log('\nluck moves the odds');
const rareShare = (luck) => {
  const random = S.seededRandom(7);
  let rare = 0;
  const n = 200_000;
  for (let i = 0; i < n; i += 1) if (S.rarityById(S.rollCharacter(luck, random).rarity).index >= 2) rare += 1;
  return rare / n;
};
const at1 = rareShare(1);
const at5 = rareShare(5);
check(at5 > at1 * 3, `Rare+ share grows with luck (${(at1 * 100).toFixed(2)}% at 1x -> ${(at5 * 100).toFixed(2)}% at 5x)`);
const expected = S.effectiveOdds(1);
check(Math.abs(1 / expected.get('supergokku') - 1 / 9500) / (1 / 9500) < 0.05, 'effective odds match the listed 1 in N for a rare');

console.log('\nbattles');
const team = ['friza', 'tien', 'tien', 'aizan'].map((c, i) => ({ u: i + 1, c, l: 1, p: {}, k: false }));
const a = S.simulateBattle(S.teamFighters(team, {}), S.floorFighters(3), S.seededRandom(42));
const b = S.simulateBattle(S.teamFighters(team, {}), S.floorFighters(3), S.seededRandom(42));
check(JSON.stringify(a.events) === JSON.stringify(b.events), 'the same seed plays the same battle');
const wins = (units, floor, upgrades = {}) => {
  let n = 0;
  for (let s = 0; s < 200; s += 1) if (S.simulateBattle(S.teamFighters(units, upgrades), S.floorFighters(floor), S.seededRandom(s)).victory) n += 1;
  return n;
};
/*
 * THE TOWER IS A GOAL, NOT A FREEBIE. A new player's best four (from their
 * first rolls, unlevelled) must not clear even floor 1: the floors ask for a
 * lot more rolling, levelling and upgrading first.
 */
const bestFour = (rolls, level, seed) => {
  const random = S.seededRandom(seed);
  const units = [];
  for (let i = 0; i < rolls; i += 1) units.push({ u: i + 1, c: S.rollCharacter(1, random).id, l: level, p: {}, k: false });
  const power = (u) => S.unitAttack(u) * S.unitHealth(u);
  return units.sort((x, y) => power(y) - power(x)).slice(0, 4);
};
// Across 60 new players: how many field a team that wins floor 1 at least half the time.
const clearers = (rolls) => {
  let n = 0;
  for (let seed = 1; seed <= 60; seed += 1) {
    const team = bestFour(rolls, 1, seed);
    let won = 0;
    for (let s = 0; s < 30; s += 1) if (S.simulateBattle(S.teamFighters(team, {}), S.floorFighters(1), S.seededRandom(s)).victory) won += 1;
    if (won >= 15) n += 1;
  }
  return n;
};
const after30 = clearers(30);
const after100 = clearers(100);
const after300 = clearers(300);
check(after30 <= 3, `floor 1 is out of reach of a starting team: ${after30}/60 can clear it after 30 rolls`);
check(after100 <= 9, `and of most teams after 100 rolls: ${after100}/60`);
check(after300 >= 20, `but reachable with more rolling: ${after300}/60 after 300 rolls`);
check(wins(team, 1) === 0, 'nor can the reference team');
const grown = bestFour(1000, 10, 7);
check(wins(grown, 1) === 200, 'a grown team (best of 1000 rolls, level 10) always clears floor 1');
check(wins(grown, 10) === 0, 'but cannot clear floor 10');
check(wins(grown, 5, { damage: 10, health: 10 }) > wins(grown, 5), 'Damage and Health upgrades win more fights');
let lastKo = true;
for (let s = 0; s < 50; s += 1) {
  const r = S.simulateBattle(S.teamFighters(team, {}), S.floorFighters(2), S.seededRandom(s));
  const kos = r.events.filter((e) => e.ko === 1 && e.s === (r.victory ? 0 : 1)).length + r.events.filter((e) => e.sp?.ko === 1 && e.s === (r.victory ? 0 : 1)).length;
  const loser = r.victory ? r.enemy.length : r.player.length;
  if (kos < loser) lastKo = false;
}
check(lastKo, 'a battle ends only when the losing side is fully knocked out');

console.log(failures === 0 ? '\nprogression OK' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
