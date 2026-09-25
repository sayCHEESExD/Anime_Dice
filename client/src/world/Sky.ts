import {
  BackSide,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD_HALF } from '@dice/shared';
import { PALETTE, WORLD_FOG } from '../config/worldVisuals.js';

/** How far out the dome sits. Inside the camera's far plane. */
const DOME_RADIUS = 950;

/**
 * The world around the island: a bright gradient dome that melts into the
 * fog colour at the horizon, a ring of blocky clouds that fade into it with
 * distance, and the OCEAN (one plane with a cheap animated shimmer) that
 * thickens into the same fog. A handful of meshes, and no horizon line: the
 * island's edge is where the fog takes over.
 */
export class Sky {
  readonly root = new Group();
  private readonly dome: Mesh;
  private readonly oceanMaterial: ShaderMaterial;
  private readonly disposables: (BufferGeometry | ShaderMaterial | MeshBasicMaterial)[] = [];

  constructor() {
    this.dome = this.buildDome();
    this.root.add(this.dome);
    this.oceanMaterial = this.buildOcean();
    this.buildClouds(0x51a3, 46);
    this.root.renderOrder = -1;
  }

  follow(x: number, z: number): void {
    this.dome.position.set(x, 0, z);
  }

  update(time: number): void {
    const uniform = this.oceanMaterial.uniforms['time'];
    if (uniform) uniform.value = time;
  }

  private buildDome(): Mesh {
    const geometry = new SphereGeometry(DOME_RADIUS, 24, 16);
    const material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new Color(PALETTE.skyTop) },
        midColor: { value: new Color(PALETTE.sky) },
        bottomColor: { value: new Color(PALETTE.fog) },
      },
      vertexShader: `
        varying float vHeight;
        void main() {
          vHeight = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        varying float vHeight;
        void main() {
          float h = clamp(vHeight, -1.0, 1.0);
          vec3 sky = mix(midColor, topColor, smoothstep(0.1, 0.7, h));
          // A deep band of fog colour at the horizon, easing up into the sky.
          float haze = 1.0 - smoothstep(-0.02, 0.28, h);
          gl_FragColor = vec4(mix(sky, bottomColor, haze), 1.0);
        }
      `,
    });
    this.disposables.push(geometry, material);
    const dome = new Mesh(geometry, material);
    dome.frustumCulled = false;
    return dome;
  }

  private buildOcean(): ShaderMaterial {
    const geometry = new PlaneGeometry(2600, 2600, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    const material = new ShaderMaterial({
      fog: true,
      uniforms: {
        time: { value: 0 },
        shallow: { value: new Color(PALETTE.ocean) },
        deep: { value: new Color(PALETTE.oceanDeep) },
        fogColor: { value: new Color(PALETTE.fog) },
        fogNear: { value: WORLD_FOG.near },
        fogFar: { value: WORLD_FOG.far },
      },
      vertexShader: `
        varying vec3 vWorld;
        varying float vDepth;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          vec4 view = viewMatrix * world;
          vDepth = -view.z;
          gl_Position = projectionMatrix * view;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 shallow;
        uniform vec3 deep;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        varying vec3 vWorld;
        varying float vDepth;
        void main() {
          float d = length(vWorld.xz);
          float shore = smoothstep(${(WORLD_HALF + 10).toFixed(1)}, ${(WORLD_HALF + 140).toFixed(1)}, d);
          vec3 color = mix(shallow, deep, shore);
          float wave = sin(vWorld.x * 0.08 + time * 0.9) * sin(vWorld.z * 0.07 - time * 0.7);
          float glint = smoothstep(0.82, 1.0, wave);
          color += glint * 0.22;
          // Camera-distance fog like the rest of the world, AND fog by distance from
          // the island: past the beach the sea dissolves into the horizon wherever
          // the camera is, so the playable island reads as the whole world.
          float edge = smoothstep(${(WORLD_HALF + 32).toFixed(1)}, ${(WORLD_HALF + 190).toFixed(1)}, d);
          float f = max(smoothstep(fogNear, fogFar, vDepth), edge);
          gl_FragColor = vec4(mix(color, fogColor, f), 1.0);
        }
      `,
    });
    material.fog = false;
    this.disposables.push(geometry, material);
    const ocean = new Mesh(geometry, material);
    ocean.position.y = -1.2;
    ocean.frustumCulled = false;
    this.root.add(ocean);
    return material;
  }

  private buildClouds(seed: number, clusters: number): void {
    const random = seeded(seed);
    const tops: BufferGeometry[] = [];
    const bases: BufferGeometry[] = [];
    for (let i = 0; i < clusters; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = 180 + random() * 520;
      const cx = Math.sin(angle) * distance;
      const cz = Math.cos(angle) * distance;
      const cy = 120 + random() * 110;
      const scale = 9 + random() * 16;
      const blocks = 4 + Math.floor(random() * 4);
      for (let b = 0; b < blocks; b += 1) {
        const t = blocks === 1 ? 0.5 : b / (blocks - 1);
        const bulge = Math.sin(t * Math.PI);
        const w = scale * (1.1 + bulge * 1.5 + random() * 0.4);
        const h = scale * (0.5 + bulge * 0.55);
        const d = scale * (1.0 + bulge * 1.2 + random() * 0.4);
        const x = cx + (t - 0.5) * scale * 4.2;
        const y = cy + bulge * scale * 0.35;
        const z = cz + (random() - 0.5) * scale * 1.2;
        const top = new BoxGeometry(w, h, d);
        top.translate(x, y, z);
        tops.push(top);
        const base = new BoxGeometry(w * 1.04, h * 0.32, d * 1.04);
        base.translate(x, y - h * 0.62, z);
        bases.push(base);
      }
    }
    this.addLayer(tops, PALETTE.skyCloud);
    this.addLayer(bases, PALETTE.skyCloudShade);
  }

  private addLayer(parts: BufferGeometry[], color: number): void {
    const merged = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (!merged) return;
    const material = new MeshBasicMaterial({ color, fog: true });
    this.disposables.push(merged, material);
    const mesh = new Mesh(merged, material);
    mesh.frustumCulled = false;
    this.root.add(mesh);
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables.length = 0;
    this.root.removeFromParent();
  }
}

const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
