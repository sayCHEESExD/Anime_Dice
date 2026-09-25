/**
 * THE MAP, walked. Checks the layout is sound after any change to
 * `shared/src/config/map.ts`:
 *
 *   - no moving walkway overlaps a building, a board, a stall or a plot,
 *   - every plot spawn stands clear of solids,
 *   - from EVERY plot a player reaches a tower door by walking to the nearest
 *     avenue, riding its inbound walkway and taking the escalator or stairs -
 *     using the real shared movement simulation - and the walkway ride is
 *     faster than walking the same stretch.
 *
 *   npm run build:shared && node scripts/verify-layout.mjs
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

const world = new S.WorldCollision();
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

console.log('walkways are clear');
const walkwaySides = new Set();
for (const e of S.WALKWAYS) {
  const lane = { minX: e.minX, maxX: e.maxX, minZ: e.minZ, maxZ: e.maxZ };
  // Its own side panels touch it by design; anything else overlapping is a clash.
  const clash = world.boxes.filter((b) => overlaps(lane, b) && !(b.maxY <= S.AVENUE.top + 1.4 && b.minY === 0 && (b.maxX - b.minX < 0.7 || b.maxZ - b.minZ < 0.7)));
  if (clash.length) console.log('    clash', JSON.stringify(lane), JSON.stringify(clash[0]));
  check(clash.length === 0, `lane ${e.axis} ${e.low} -> ${e.high} at ${e.axis === 'z' ? e.minX : e.minZ}`);
  walkwaySides.add(e);
}

console.log('\nspawns are clear');
for (const plot of S.PLOTS) {
  const spawn = S.plotSpawn(plot.index);
  const floor = world.floorBelow(spawn.x, spawn.y + 0.5, spawn.z, 1);
  check(Math.abs(floor - spawn.y) < 0.01, `plot ${plot.index} spawn stands on its floor`);
}

/** Drive the shared sim toward a waypoint. Returns false when stuck. */
const drive = (motion, x, z, budget) => {
  const params = S.createSimParams();
  const events = S.createSimEvents();
  let stuck = 0;
  let last = { x: motion.x, z: motion.z };
  for (let t = 0; t < budget; t += 1 / 60) {
    const dx = x - motion.x;
    const dz = z - motion.z;
    if (Math.hypot(dx, dz) < 1.2) return { ok: true, time: t };
    const yaw = Math.atan2(dx, dz);
    S.stepPlayer(motion, { moveX: 0, moveZ: 1, jump: false, cameraYaw: yaw }, params, 1 / 60, world, events);
    if (Math.hypot(motion.x - last.x, motion.z - last.z) < 0.005) stuck += 1;
    else stuck = 0;
    last = { x: motion.x, z: motion.z };
    if (stuck > 90) return { ok: false, time: t };
  }
  return { ok: false, time: budget };
};

console.log('\nevery plot reaches the tower');
const A = S.AVENUE;
for (const plot of S.PLOTS) {
  const spawn = S.plotSpawn(plot.index);
  const motion = S.createMotion(spawn.x, spawn.y, spawn.z, spawn.yaw);
  // Out through the plot's front, to the outer end of the avenue on its side.
  // The avenue on this plot's side points outward, the way the plot faces into itself.
  const dir = S.AVENUE_DIRS.find((d) => d.ux === Math.round(Math.sin(plot.yaw)) && d.uz === Math.round(Math.cos(plot.yaw)));
  const front = S.plotToWorld(plot, 0, -4);
  const legs = [
    [front.x, front.z],
    [dir.ux * (A.to + 3), dir.uz * (A.to + 3)],
    [dir.ux * (A.from - 4), dir.uz * (A.from - 4)],
    [dir.ux * (S.TERRACE.half - 12), dir.uz * (S.TERRACE.half - 12)],
  ];
  let total = 0;
  let ok = true;
  for (const [x, z] of legs) {
    const leg = drive(motion, x, z, 40);
    total += leg.time;
    if (!leg.ok) {
      ok = false;
      console.log(`    plot ${plot.index} stuck near (${motion.x.toFixed(1)}, ${motion.z.toFixed(1)}) heading for (${x}, ${z})`);
      break;
    }
  }
  check(ok && motion.y >= S.TERRACE.top - 0.1, `plot ${plot.index} -> terrace in ${total.toFixed(1)}s`);
}

console.log('\nthe walkways are a shortcut');
{
  const e = S.WALKWAYS[0];
  const ride = S.createMotion(0, A.top, A.to - 1, Math.PI);
  const walk = S.createMotion(A.outboundOffset + 20, 0, A.to - 1, Math.PI);
  const rideTime = drive(ride, 0, A.from + 2, 30).time;
  const walkTime = drive(walk, A.outboundOffset + 20, A.from + 2, 30).time;
  check(rideTime < walkTime * 0.75, `riding in takes ${rideTime.toFixed(1)}s, walking beside it ${walkTime.toFixed(1)}s`);
  void e;
}

console.log(failures === 0 ? '\nlayout OK' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
