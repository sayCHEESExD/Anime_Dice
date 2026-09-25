import { rarityById, type CharacterDef, type VfxKind } from '@dice/shared';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  NormalBlending,
  Points,
  RingGeometry,
  ShaderMaterial,
  Sphere,
  Vector3,
} from 'three';

/**
 * TROPHY EFFECTS. Every displayed character stands in:
 *
 *  - a RING on its pedestal in its rarity's colour (every tier),
 *  - a light COLUMN for Epic and above,
 *  - a PARTICLE RIG for its ability-inspired `vfx` kind (aura flames,
 *    lightning, petals, orbiting orbs...), denser the rarer it is,
 *  - a second spinning HALO ring from Mythic up.
 *
 * All of it is shader-animated from ONE shared time uniform: no per-frame CPU
 * work per stand, no textures. Geometry is shared per particle count and
 * materials per character, so twenty copies of one character share one
 * material.
 */

/** The one clock every effect reads. */
export const vfxTime = { value: 0 };

const KIND_CODE: Readonly<Record<VfxKind, number>> = {
  none: 0,
  aura: 0,
  lightning: 1,
  flames: 2,
  orbit: 3,
  shadow: 4,
  petals: 5,
  frost: 6,
  water: 7,
  wind: 8,
  cosmic: 9,
};

const particleVertex = /* glsl */ `
  attribute vec4 seed;
  uniform float uTime;
  uniform float uKind;
  uniform float uHeight;
  uniform float uSize;
  varying float vAlpha;
  varying float vMix;
  const float TAU = 6.2831853;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    vec3 p = vec3(0.0);
    float t = uTime + seed.w * 37.0;
    vAlpha = 1.0;
    vMix = seed.x;
    float size = uSize * (0.6 + seed.z * 0.8);
    if (uKind < 0.5) {
      // AURA: licks of energy rising close around the body.
      float life = fract(t * 0.55 + seed.x);
      float ang = seed.y * TAU + life * 1.2;
      float r = 0.75 + seed.z * 0.45 - life * 0.35;
      p = vec3(cos(ang) * r, life * uHeight * 1.15, sin(ang) * r);
      vAlpha = sin(life * 3.14159);
      vMix = life;
    } else if (uKind < 1.5) {
      // LIGHTNING: sparks that snap between random points and flicker.
      float st = floor(t * 9.0);
      float s = hash(st + seed.y * 91.0);
      float ang = hash(st * 1.7 + seed.x * 13.0) * TAU;
      float r = 0.6 + s * 0.8;
      p = vec3(cos(ang) * r, hash(st * 2.3 + seed.z * 7.0) * uHeight * 1.1, sin(ang) * r);
      vAlpha = step(0.45, hash(st * 3.1 + seed.w * 5.0));
      size *= 0.8 + s;
    } else if (uKind < 2.5) {
      // FLAMES: tongues rising and narrowing, colour to colour2 as they cool.
      float life = fract(t * 0.8 + seed.x);
      float ang = seed.y * TAU;
      float r = (1.0 - life) * (0.7 + seed.z * 0.6);
      p = vec3(cos(ang) * r, life * uHeight * 1.25, sin(ang) * r);
      vAlpha = 1.0 - life;
      vMix = life;
      size *= 1.3 - life * 0.7;
    } else if (uKind < 3.5) {
      // ORBIT: orbs circling in tilted rings.
      float ang = seed.y * TAU + t * (0.9 + seed.z * 0.6);
      float r = 1.3 + seed.x * 0.6;
      float tilt = (seed.z - 0.5) * 1.2;
      p = vec3(cos(ang) * r, uHeight * (0.35 + seed.x * 0.5) + sin(ang) * tilt, sin(ang) * r);
      size *= 1.2;
    } else if (uKind < 4.5) {
      // SHADOW: dark wisps drifting up and out.
      float life = fract(t * 0.3 + seed.x);
      float ang = seed.y * TAU + life * 2.0;
      float r = 0.6 + life * 1.1;
      p = vec3(cos(ang) * r, life * uHeight * 1.1, sin(ang) * r);
      vAlpha = sin(life * 3.14159) * 0.9;
      size *= 1.6 + life;
    } else if (uKind < 5.5) {
      // PETALS: drifting down in slow spirals.
      float life = fract(t * 0.18 + seed.x);
      float ang = seed.y * TAU + life * 5.0;
      float r = 1.0 + seed.z * 1.4;
      p = vec3(cos(ang) * r, (1.0 - life) * uHeight * 1.6, sin(ang) * r);
      vAlpha = sin(life * 3.14159);
    } else if (uKind < 6.5) {
      // FROST: crystals hanging and twinkling.
      float ang = seed.y * TAU + t * 0.2;
      float r = 0.9 + seed.z * 1.0;
      p = vec3(cos(ang) * r, seed.x * uHeight * 1.2 + sin(t + seed.w * 6.0) * 0.2, sin(ang) * r);
      vAlpha = 0.5 + 0.5 * sin(t * 4.0 + seed.w * 20.0);
    } else if (uKind < 7.5) {
      // WATER: rings of droplets rising and widening.
      float life = fract(t * 0.45 + seed.x);
      float ang = seed.y * TAU;
      float r = 0.6 + life * 1.3;
      p = vec3(cos(ang) * r, life * uHeight * 0.9, sin(ang) * r);
      vAlpha = 1.0 - life;
    } else if (uKind < 8.5) {
      // WIND: fast streaks spiralling up.
      float life = fract(t * 0.9 + seed.x);
      float ang = seed.y * TAU + life * 9.0;
      float r = 1.0 + seed.z * 0.6;
      p = vec3(cos(ang) * r, life * uHeight * 1.2, sin(ang) * r);
      vAlpha = sin(life * 3.14159) * 0.8;
      size *= 0.7;
    } else {
      // COSMIC: stars orbiting a halo and twinkling.
      float ang = seed.y * TAU + t * 0.35 * (seed.z > 0.5 ? 1.0 : -1.0);
      float r = 1.1 + seed.x * 1.3;
      p = vec3(cos(ang) * r, uHeight * (0.2 + seed.z) + sin(t * 0.7 + seed.w * 9.0) * 0.3, sin(ang) * r);
      vAlpha = 0.45 + 0.55 * sin(t * 3.0 + seed.w * 30.0);
      size *= 1.1;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = size * (220.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const particleFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  varying float vAlpha;
  varying float vMix;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, r);
    vec3 color = mix(uColor, uColor2, vMix);
    gl_FragColor = vec4(color * (0.8 + soft * 0.6), soft * vAlpha);
  }
`;

const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float pulse = 0.65 + 0.35 * sin(uTime * 2.5);
    float edge = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
    gl_FragColor = vec4(uColor, edge * pulse * uStrength);
  }
`;

const columnFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 1.6);
    float bands = 0.75 + 0.25 * sin(vUv.y * 22.0 - uTime * 4.0);
    gl_FragColor = vec4(uColor, fade * bands * uStrength);
  }
`;

const uvVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const particleGeometries = new Map<number, BufferGeometry>();
const particleMaterials = new Map<string, ShaderMaterial>();
const ringMaterials = new Map<string, ShaderMaterial>();
let ringGeometry: RingGeometry | null = null;
let haloGeometry: RingGeometry | null = null;
let columnGeometry: CylinderGeometry | null = null;

const particles = (count: number): BufferGeometry => {
  let geometry = particleGeometries.get(count);
  if (geometry) return geometry;
  geometry = new BufferGeometry();
  const seeds = new Float32Array(count * 4);
  let s = 1234567 + count;
  const rand = (): number => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s & 0xffffff) / 0x1000000;
  };
  for (let i = 0; i < seeds.length; i += 1) seeds[i] = rand();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('seed', new BufferAttribute(seeds, 4));
  // Positions are computed in the shader: give sorting and culling a generous sphere.
  geometry.boundingSphere = new Sphere(new Vector3(0, 3, 0), 8);
  particleGeometries.set(count, geometry);
  return geometry;
};

const particleMaterial = (character: CharacterDef, height: number): ShaderMaterial => {
  const key = `${character.id}:${height.toFixed(1)}`;
  let material = particleMaterials.get(key);
  if (material) return material;
  const kind = character.vfx.kind;
  const rarity = rarityById(character.rarity);
  material = new ShaderMaterial({
    uniforms: {
      uTime: vfxTime,
      uKind: { value: KIND_CODE[kind] },
      uHeight: { value: height },
      uSize: { value: kind === 'shadow' ? 1.3 : 0.9 + rarity.fxLevel * 0.4 },
      uColor: { value: new Color(character.vfx.color) },
      uColor2: { value: new Color(character.vfx.color2 ?? character.vfx.color) },
    },
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending: kind === 'shadow' ? NormalBlending : AdditiveBlending,
  });
  particleMaterials.set(key, material);
  return material;
};

const glowMaterial = (color: number, fragment: string, strength: number): ShaderMaterial => {
  const key = `${color}:${fragment.length}:${strength}`;
  let material = ringMaterials.get(key);
  if (material) return material;
  material = new ShaderMaterial({
    uniforms: { uTime: vfxTime, uColor: { value: new Color(color) }, uStrength: { value: strength } },
    vertexShader: uvVertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
  ringMaterials.set(key, material);
  return material;
};

/**
 * The effect rig for one displayed character, parented at the TOP of its
 * pedestal. `height` is the character's drawn height.
 */
export const createStandVfx = (character: CharacterDef, height: number): Group => {
  const rarity = rarityById(character.rarity);
  const group = new Group();
  group.name = `vfx-${character.id}`;

  ringGeometry ??= (() => {
    const g = new RingGeometry(1.7, 2.35, 32, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const ring = new Mesh(ringGeometry, glowMaterial(rarity.color, ringFragment, 0.55 + rarity.fxLevel * 0.45));
  ring.position.y = 0.04;
  ring.renderOrder = 2;
  group.add(ring);

  if (rarity.fxLevel >= 0.45) {
    columnGeometry ??= (() => {
      const g = new CylinderGeometry(1.9, 2.2, 1, 24, 1, true);
      g.translate(0, 0.5, 0);
      return g;
    })();
    const column = new Mesh(columnGeometry, glowMaterial(rarity.color, columnFragment, 0.25 + rarity.fxLevel * 0.35));
    column.scale.y = height * (1.1 + rarity.fxLevel * 0.8);
    column.renderOrder = 2;
    group.add(column);
  }

  if (character.vfx.kind !== 'none') {
    const count = Math.round(10 + rarity.fxLevel * 46);
    const points = new Points(particles(count), particleMaterial(character, height));
    points.frustumCulled = false;
    points.renderOrder = 3;
    group.add(points);
  }

  if (rarity.fxLevel >= 0.75) {
    haloGeometry ??= (() => {
      const g = new RingGeometry(2.3, 2.55, 40, 1);
      g.rotateX(-Math.PI / 2);
      return g;
    })();
    const halo = new Mesh(haloGeometry, glowMaterial(rarity.color2, ringFragment, 0.9));
    halo.position.y = height * 0.55;
    halo.rotation.x = 0.35;
    halo.userData['spin'] = true;
    halo.renderOrder = 2;
    group.add(halo);
  }
  return group;
};
