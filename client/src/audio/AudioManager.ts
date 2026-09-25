import { logger } from '../util/logger.js';

const SCOPE = 'AudioManager';

/** The two supplied tracks: the island's theme and the tower's battle theme. */
const MUSIC_URL = {
  hub: '/audio/anime-music.mp3',
  battle: '/audio/anime-battle-music.mp3',
} as const;

export type MusicTrack = keyof typeof MUSIC_URL;

/** The supplied effects, decoded once. */
const SAMPLE_URLS = {
  jump: '/audio/jump.mp3',
  land: '/audio/fall.mp3',
  death: '/audio/death.mp3',
  katana: '/audio/katana.mp3',
  punch: '/audio/punch.mp3',
} as const;

type SampleName = keyof typeof SAMPLE_URLS;

export type SoundName =
  | SampleName
  | 'step'
  | 'tick'
  | 'roll'
  | 'reveal'
  | 'fanfare'
  | 'buy'
  | 'refuse'
  | 'levelup'
  | 'rebirth'
  | 'coin'
  | 'ability'
  | 'win'
  | 'lose'
  | 'click';

/** Minimum seconds between two plays of the same sound, so nothing machine-guns. */
const COOLDOWN: Partial<Record<SoundName, number>> = { tick: 0.035, step: 0.12, punch: 0.05, katana: 0.05, coin: 0.08 };

const MUSIC_GAIN = 0.42;

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1);

/**
 * THE SOUND. One AudioContext with a master bus and a music bus; the music is
 * two STREAMED elements (the hub theme, and the battle theme loaded only when
 * the first battle starts) crossfaded on the music bus; the supplied effects
 * are decoded buffers; every UI sound - the roll's ticks, the reveal fanfares
 * by rarity, buys and refusals - is synthesised, so none of it costs a byte of
 * download. Nothing plays until the player's first gesture (browser policy).
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private readonly buffers = new Map<SampleName, AudioBuffer>();
  private readonly tracks = new Map<MusicTrack, { element: HTMLAudioElement; gain: GainNode }>();
  private current: MusicTrack = 'hub';
  private readonly lastPlayed = new Map<SoundName, number>();
  private muted = false;
  private masterLevel = 1;
  private musicLevel = 1;

  /** Create or wake the context. Call from a user gesture. */
  resume(): void {
    if (!this.context) {
      try {
        this.context = new AudioContext();
      } catch (error) {
        logger.warn(SCOPE, `no audio: ${String(error)}`);
        return;
      }
      const ctx = this.context;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.masterLevel;
      this.master.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = MUSIC_GAIN * this.musicLevel;
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.8;
      this.sfxBus.connect(this.master);
      for (const name of Object.keys(SAMPLE_URLS) as SampleName[]) void this.loadSample(name);
      this.setMusic(this.current);
    }
    if (this.context.state === 'suspended') void this.context.resume();
    for (const [name, track] of this.tracks) {
      if (name === this.current && !this.muted && track.element.paused) void track.element.play().catch(() => undefined);
    }
  }

  private async loadSample(name: SampleName): Promise<void> {
    const ctx = this.context;
    if (!ctx) return;
    try {
      const response = await fetch(SAMPLE_URLS[name]);
      const data = await response.arrayBuffer();
      this.buffers.set(name, await ctx.decodeAudioData(data));
    } catch (error) {
      logger.warn(SCOPE, `sample ${name} unavailable: ${String(error)}`);
    }
  }

  /** Crossfade to a track (creating its element the first time it is wanted). */
  setMusic(track: MusicTrack): void {
    this.current = track;
    const ctx = this.context;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    if (!this.tracks.has(track)) {
      const element = new Audio(MUSIC_URL[track]);
      element.loop = true;
      element.preload = 'auto';
      element.crossOrigin = 'anonymous';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      try {
        ctx.createMediaElementSource(element).connect(gain);
        gain.connect(bus);
      } catch (error) {
        logger.warn(SCOPE, `music not routed: ${String(error)}`);
      }
      this.tracks.set(track, { element, gain });
    }
    const now = ctx.currentTime;
    for (const [name, entry] of this.tracks) {
      const on = name === track;
      entry.gain.gain.cancelScheduledValues(now);
      entry.gain.gain.setTargetAtTime(on ? 1 : 0, now, 0.35);
      if (on && !this.muted) void entry.element.play().catch(() => undefined);
      if (!on) setTimeout(() => {
        if (this.current !== name) entry.element.pause();
      }, 1600);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : this.masterLevel, this.context.currentTime, 0.05);
    const entry = this.tracks.get(this.current);
    if (entry) {
      if (muted) entry.element.pause();
      else void entry.element.play().catch(() => undefined);
    }
  }

  /** Flip mute. Returns true when sound is ON. */
  toggleMuted(): boolean {
    this.resume();
    this.setMuted(!this.muted);
    return !this.muted;
  }

  setMasterVolume(level: number): void {
    this.masterLevel = clamp01(level);
    if (this.master && this.context && !this.muted) this.master.gain.setTargetAtTime(this.masterLevel, this.context.currentTime, 0.05);
  }

  setMusicVolume(level: number): void {
    this.musicLevel = clamp01(level);
    if (this.musicBus && this.context) this.musicBus.gain.setTargetAtTime(MUSIC_GAIN * this.musicLevel, this.context.currentTime, 0.05);
  }

  /** Play a sound. `intensity` scales its volume (and, for fanfares, its grandeur 0..7). */
  play(name: SoundName, intensity = 1, delay = 0): void {
    const ctx = this.context;
    const bus = this.sfxBus;
    if (!ctx || !bus || this.muted) return;
    const now = ctx.currentTime;
    const cooldown = COOLDOWN[name];
    if (cooldown !== undefined) {
      const last = this.lastPlayed.get(name) ?? -1;
      if (now - last < cooldown) return;
    }
    this.lastPlayed.set(name, now);
    const at = now + Math.max(0, delay);
    switch (name) {
      case 'jump':
      case 'land':
      case 'death':
      case 'katana':
      case 'punch':
        this.sample(name, at, intensity * (name === 'land' ? 0.5 : 0.8));
        break;
      case 'step':
        this.noise(at, 0.05, 900, 0.08 * intensity);
        break;
      case 'tick':
        this.tone(at, 1400 + Math.random() * 200, 0.03, 'square', 0.05 * intensity);
        break;
      case 'roll':
        for (let i = 0; i < 4; i += 1) this.noise(at + i * 0.06, 0.05, 2400, 0.08);
        break;
      case 'click':
        this.tone(at, 900, 0.04, 'triangle', 0.08);
        break;
      case 'reveal':
        this.tone(at, 660, 0.12, 'triangle', 0.14);
        this.tone(at + 0.08, 990, 0.18, 'triangle', 0.12);
        break;
      case 'fanfare':
        this.fanfare(at, intensity);
        break;
      case 'coin':
        this.tone(at, 1320, 0.06, 'square', 0.06);
        this.tone(at + 0.06, 1760, 0.12, 'square', 0.06);
        break;
      case 'buy':
        this.arpeggio(at, [523, 659, 784], 0.07, 'triangle', 0.13);
        break;
      case 'levelup':
        this.arpeggio(at, [523, 659, 784, 1047], 0.07, 'square', 0.08);
        break;
      case 'rebirth':
        this.arpeggio(at, [392, 523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.15);
        this.noise(at, 0.8, 5000, 0.05);
        break;
      case 'refuse':
        this.tone(at, 220, 0.12, 'sawtooth', 0.08);
        this.tone(at + 0.1, 165, 0.16, 'sawtooth', 0.08);
        break;
      case 'ability':
        this.sweep(at, 300, 1400, 0.25, 0.1);
        break;
      case 'win':
        this.arpeggio(at, [523, 659, 784, 1047, 784, 1047], 0.1, 'triangle', 0.16);
        break;
      case 'lose':
        this.arpeggio(at, [392, 349, 311, 262], 0.16, 'sawtooth', 0.08);
        break;
    }
  }

  private sample(name: SampleName, at: number, gain: number): void {
    const ctx = this.context!;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const volume = ctx.createGain();
    volume.gain.value = gain;
    source.connect(volume).connect(this.sfxBus!);
    source.start(at);
  }

  private tone(at: number, frequency: number, duration: number, type: OscillatorType, gain: number): void {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env).connect(this.sfxBus!);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  private sweep(at: number, from: number, to: number, duration: number, gain: number): void {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env).connect(this.sfxBus!);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  private noise(at: number, duration: number, cutoff: number, gain: number): void {
    const ctx = this.context!;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const env = ctx.createGain();
    env.gain.value = gain;
    source.connect(filter).connect(env).connect(this.sfxBus!);
    source.start(at);
  }

  private arpeggio(at: number, notes: readonly number[], step: number, type: OscillatorType, gain: number): void {
    notes.forEach((note, index) => this.tone(at + index * step, note, step * 2.4, type, gain));
  }

  /** A reveal fanfare that grows with the rarity index (0 common .. 7 divine). */
  private fanfare(at: number, tier: number): void {
    const base = [523, 659, 784, 1047, 1319, 1568, 2093, 2637];
    const count = Math.min(base.length, 3 + Math.floor(tier));
    this.arpeggio(at, base.slice(0, count), 0.08, 'triangle', 0.14);
    if (tier >= 4) this.arpeggio(at + count * 0.08, [1047, 1319, 1568, 2093], 0.05, 'square', 0.06);
    if (tier >= 6) this.noise(at, 1.2, 6000, 0.06);
  }

  dispose(): void {
    for (const { element } of this.tracks.values()) {
      element.pause();
      element.removeAttribute('src');
    }
    this.tracks.clear();
    void this.context?.close();
    this.context = null;
  }
}
