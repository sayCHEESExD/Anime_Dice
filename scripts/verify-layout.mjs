/**
 * THE MAP, walked. Checks the layout is sound after any change to
 * `shared/src/config/map.ts`:
 *
 *   - nothing solid stands on the loop track, and its straights tile one
 *     closed ring (each ends exactly where the next begins),
 *   - a player standing still on the loop is carried ALL the way round and
 *     back to where they started (no dead end, every corner turns them), and
 *     can step on from the side and off anywhere,
 *   - every plot spawn stands clear of solids,
 *   - from EVERY plot a player walks to the tower (across the loop) and up the
 *     escalator or stairs - using the real shared movement simulation - and
 *     riding the loop is faster than walking beside it.
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
const L = S.LOOP;
const segments = S.LOOP_SEGMENTS;

console.log('the loop track is clear and closed');
{
  const clashes = segments.flatMap((e) => world.boxes.filter((b) => overlaps(e, b)));
  if (clashes.length) console.log('    clash', JSON.stringify(clashes[0]));
  check(clashes.length === 0, `nothing solid on any of the ${segments.length} pieces`);
}
{
  // Every straight ends where the next starts, the pieces never overlap, and
  // the track is as wide as specified everywhere.
  let joined = true;
  for (const [i, e] of segments.entries()) {
    const next = segments[(i + 1) % segments.length];
    // The end of this straight's run is the near edge of the next straight's corner square.
    const endX = e.axis === 'x' ? e.high : (e.minX + e.maxX) / 2;
    const endZ = e.axis === 'z' ? e.high : (e.minZ + e.maxZ) / 2;
    const inside = endX >= next.minX - 1e-6 && endX <= next.maxX + 1e-6 && endZ >= next.minZ - 1e-6 && endZ <= next.maxZ + 1e-6;
    if (!inside) {
      joined = false;
      console.log(`    straight ${i} ends at (${endX}, ${endZ}), outside straight ${(i + 1) % segments.length}`);
    }
  }
  check(joined, `${segments.length} pieces join end to end into one ring`);
  const overlapping = segments.some((a, i) => segments.some((b, j) => j > i && overlaps(a, b)));
  check(!overlapping, 'no two pieces overlap');
  // Straights, and the corner pieces between them (each half a corner square).
  const across = (e) => (e.axis === 'x' ? e.maxZ - e.minZ : e.maxX - e.minX);
  const along = (e) => (e.axis === 'x' ? e.maxX - e.minX : e.maxZ - e.minZ);
  const straights = segments.filter((e) => along(e) > L.half * 2);
  check(straights.length === S.LOOP_WAYPOINTS.length && straights.every((e) => across(e) === L.half * 2), `${straights.length} straights, the track ${L.half * 2} wide throughout`);
  check(segments.filter((e) => along(e) === L.half * 2 && across(e) === L.half).length === S.LOOP_WAYPOINTS.length, 'a turning piece at every corner');
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

/** Stand still (no input) for `seconds`, calling `each` every tick. */
const idle = (motion, seconds, each) => {
  const params = S.createSimParams();
  const events = S.createSimEvents();
  for (let t = 0; t < seconds; t += 1 / 60) {
    S.stepPlayer(motion, { moveX: 0, moveZ: 0, jump: false, cameraYaw: 0 }, params, 1 / 60, world, events);
    if (each(t) === false) return t;
  }
  return seconds;
};

console.log('\nthe loop carries a player all the way round');
{
  const start = S.LOOP_WAYPOINTS[0];
  // Just past the first corner, on the centre line, standing still.
  const motion = S.createMotion(start.x + 12, L.top, start.z, 0);
  const visited = new Set();
  let leftTrack = false;
  let lapTime = -1;
  let travelled = 0;
  let last = { x: motion.x, z: motion.z };
  idle(motion, 400, (t) => {
    travelled += Math.hypot(motion.x - last.x, motion.z - last.z);
    last = { x: motion.x, z: motion.z };
    const on = segments.findIndex((e) => motion.x >= e.minX && motion.x <= e.maxX && motion.z >= e.minZ && motion.z <= e.maxZ);
    if (on < 0) {
      leftTrack = true;
      console.log(`    fell off the track at (${motion.x.toFixed(1)}, ${motion.z.toFixed(1)}) after ${t.toFixed(1)}s`);
      return false;
    }
    visited.add(on);
    if (travelled > 100 && Math.hypot(motion.x - (start.x + 12), motion.z - start.z) < 2) {
      lapTime = t;
      return false;
    }
    return true;
  });
  check(!leftTrack, 'a rider stays on the track round every corner');
  check(visited.size === segments.length, `rides every piece (${visited.size}/${segments.length})`);
  check(lapTime > 0, `back to the start after ${lapTime.toFixed(0)}s and ${travelled.toFixed(0)} units: no dead end`);
  // Past every plot's front: the outer ring's straights run in front of all sixteen.
  const passesAll = S.PLOTS.every((plot) => {
    const front = S.plotToWorld(plot, 0, -(S.PLOT.inner - L.outer));
    return segments.some((e) => front.x >= e.minX - 1 && front.x <= e.maxX + 1 && front.z >= e.minZ - 1 && front.z <= e.maxZ + 1);
  });
  check(passesAll, 'the loop passes in front of all 16 plots');
}

console.log('\non and off anywhere');
{
  let fine = true;
  for (const [i, e] of segments.entries()) {
    if ((e.axis === 'x' ? e.maxX - e.minX : e.maxZ - e.minZ) <= L.half * 2) continue;
    // Mid-way along each straight: walk onto it from the side, then off the other side.
    const mid = { x: (e.minX + e.maxX) / 2, z: (e.minZ + e.maxZ) / 2 };
    const across = e.axis === 'x' ? { x: 0, z: 1 } : { x: 1, z: 0 };
    const beside = { x: mid.x - across.x * (L.half + 3), z: mid.z - across.z * (L.half + 3) };
    const beyond = { x: mid.x + across.x * (L.half + 3), z: mid.z + across.z * (L.half + 3) };
    if (world.floorBelow(beside.x, 1, beside.z, 1) > 0.01 || world.floorBelow(beyond.x, 1, beyond.z, 1) > 0.01) continue;
    const motion = S.createMotion(beside.x, 0, beside.z, 0);
    // Aim across, against the carry: the waypoint is where the push would land us.
    const onto = drive(motion, mid.x, mid.z, 10);
    const rode = Math.abs(motion.y - L.top) < 0.05;
    const off = drive(motion, beyond.x + (e.axis === 'x' ? Math.sign(e.high - e.low) * 6 : 0), beyond.z + (e.axis === 'z' ? Math.sign(e.high - e.low) * 6 : 0), 10);
    const ground = motion.y < 0.05 && !segments.some((s) => motion.x > s.minX && motion.x < s.maxX && motion.z > s.minZ && motion.z < s.maxZ);
    if (!(onto.ok && rode && off.ok && ground)) {
      fine = false;
      console.log(`    straight ${i}: on=${onto.ok} rode=${rode} off=${off.ok} ground=${ground}`);
    }
  }
  check(fine, 'a player steps onto every straight from the side and off the other side');
}

console.log('\nevery plot reaches the tower');
for (const plot of S.PLOTS) {
  const spawn = S.plotSpawn(plot.index);
  const motion = S.createMotion(spawn.x, spawn.y, spawn.z, spawn.yaw);
  // Out through the plot's front, down the avenue on its side (across both rings), up to the terrace.
  const dir = S.AVENUE_DIRS.find((d) => d.ux === Math.round(Math.sin(plot.yaw)) && d.uz === Math.round(Math.cos(plot.yaw)));
  const front = S.plotToWorld(plot, 0, -4);
  const legs = [
    [front.x, front.z],
    [dir.ux * (L.outer + L.half + 3), dir.uz * (L.outer + L.half + 3)],
    [dir.ux * (S.TERRACE.half + 22), dir.uz * (S.TERRACE.half + 22)],
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

console.log('\nthe loop is a shortcut');
{
  // The outer ring's east straight runs -z at x = outer; walk its length on it, and beside it.
  const e = segments.find((s) => s.axis === 'z' && (s.minX + s.maxX) / 2 === L.outer);
  const dir = Math.sign(e.high - e.low);
  const from = e.low + dir * 4;
  const to = e.high - dir * 4;
  const ride = S.createMotion(L.outer, L.top, from, Math.PI);
  const walk = S.createMotion(L.outer - L.half - 6, 0, from, Math.PI);
  const rideTime = drive(ride, L.outer, to, 40).time;
  const walkTime = drive(walk, L.outer - L.half - 6, to, 40).time;
  check(rideTime < walkTime * 0.75, `walking along the loop takes ${rideTime.toFixed(1)}s, walking beside it ${walkTime.toFixed(1)}s`);
}

console.log(failures === 0 ? '\nlayout OK' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
