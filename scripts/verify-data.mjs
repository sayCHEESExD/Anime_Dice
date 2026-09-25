/**
 * THE DATA, checked: every character row, the rarity bands, the potions and
 * the tower lineups. Adding content is adding rows - this is what catches a
 * row that would break a system (a duplicate id, odds outside its rarity's
 * band, an ability kind the battle does not know, a tower enemy that does not
 * exist).
 *
 *   npm run verify:data
 */
import * as S from '../shared/dist/index.js';

let failures = 0;
const check = (ok, label) => {
  if (ok) console.log(`  ok    ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${label}`);
  }
};

console.log('characters');
const ids = new Set();
const ABILITIES = new Set(['burst', 'pierce', 'heal', 'drain', 'shield', 'stun', 'rage']);
const VFX = new Set(['none', 'aura', 'lightning', 'flames', 'orbit', 'shadow', 'petals', 'frost', 'water', 'wind', 'cosmic']);
const HAIR = new Set(['none', 'spiky', 'super', 'flame', 'messy', 'long', 'longSpiky', 'slick', 'bowl', 'bob', 'ponytail', 'topknot', 'twinTails', 'mohawk', 'afro', 'boar', 'spikyShort', 'fringe']);
let previous = 0;
for (const c of S.CHARACTERS) {
  const rarity = S.rarityById(c.rarity);
  const problems = [];
  if (ids.has(c.id)) problems.push('duplicate id');
  ids.add(c.id);
  if (!/^[a-z0-9]{2,24}$/.test(c.id)) problems.push('id format');
  if (!c.name || !c.series) problems.push('name/series');
  if (!(c.odds >= rarity.minOdds && c.odds < rarity.maxOdds)) problems.push(`odds ${c.odds} outside ${rarity.name} band`);
  if (c.odds < previous) problems.push('pool not sorted by odds');
  previous = c.odds;
  if (c.ability && (!ABILITIES.has(c.ability.kind) || c.ability.every < 1 || !(c.ability.power > 0))) problems.push('ability');
  if (!VFX.has(c.vfx.kind)) problems.push('vfx kind');
  if (!HAIR.has(c.look.hair.style)) problems.push('hair style');
  if (S.baseIncome(c) < 1 || S.baseAttack(c) <= 0 || S.baseHealth(c) <= 0) problems.push('stats');
  if (problems.length) check(false, `${c.id}: ${problems.join(', ')}`);
}
check(S.CHARACTERS.length >= 60, `a large pool (${S.CHARACTERS.length} characters)`);
for (const rarity of S.RARITIES) {
  const count = S.CHARACTERS.filter((c) => c.rarity === rarity.id).length;
  check(count >= 4, `${rarity.name}: ${count} characters`);
}
check(failures === 0, 'every character row is valid');

console.log('\nrarity bands');
for (let i = 1; i < S.RARITIES.length; i += 1) {
  check(S.RARITIES[i].minOdds === S.RARITIES[i - 1].maxOdds && S.RARITIES[i].index === i, `${S.RARITIES[i].name} continues the band`);
}

console.log('\nincome and stats rise with rarity');
let monotonic = true;
for (let i = 1; i < S.CHARACTERS.length; i += 1) {
  if (S.baseIncome(S.CHARACTERS[i]) < S.baseIncome(S.CHARACTERS[i - 1])) monotonic = false;
}
check(monotonic, 'a rarer character never earns less');

console.log('\npotions');
const potionIds = new Set(S.POTIONS.map((p) => p.id));
check(potionIds.size === S.POTIONS.length, 'unique potion ids');
check(S.POTIONS.every((p) => ['atk', 'hp', 'cash', 'level'].includes(p.effect) && p.amount > 0 && p.maxPerUnit > 0), 'every potion has a known effect');

console.log('\ntower');
check(S.TOWER_FLOORS >= 30, `${S.TOWER_FLOORS} floors`);
let lineups = true;
let rising = true;
for (let floor = 1; floor <= S.TOWER_FLOORS; floor += 1) {
  const def = S.floorDef(floor);
  if (!def || def.enemies.length < 1 || def.enemies.length > 4 || def.enemies.some((e) => !S.isCharacterId(e.charId))) lineups = false;
  if (floor > 1 && S.floorStrength(floor) <= S.floorStrength(floor - 1)) rising = false;
  for (const pool of [S.potionPoolFor(floor)]) if (pool.some((d) => !potionIds.has(d.id))) lineups = false;
}
check(lineups, 'every floor has 1-4 known enemies and a valid drop pool');
check(rising, 'every floor is stronger than the one below');
check(S.TOWER_TIERS[0].first === 1 && S.TOWER_TIERS[S.TOWER_TIERS.length - 1].last === S.TOWER_FLOORS, 'difficulty tiers cover every floor');

console.log(failures === 0 ? '\ndata OK' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
