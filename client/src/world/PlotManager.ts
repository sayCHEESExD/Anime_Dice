import { PLOTS, type UnitRecord } from '@dice/shared';
import { Group, type Vector3 } from 'three';
import type { NetPlayerState } from '../net/netTypes.js';
import { PlotView, buildBudget, type PlotOwner, type StandData } from './PlotView.js';

/** How often the local plot's price boards re-check affordability. */
const LOCAL_REFRESH = 0.5;

/**
 * EVERY PLOT IN THE ROOM. Sixteen `PlotView`s, one per plot of the map; each
 * shows whichever player the server assigned to it (`PlayerState.plot`) and
 * that player's replicated display, or an empty plot.
 */
export class PlotManager {
  readonly root = new Group();
  private readonly views: PlotView[];
  /** Plot index -> the session that owns it. */
  private readonly owners = new Map<number, string>();
  private localSession = '';
  private localPlot = -1;
  private localTimer = 0;

  constructor() {
    this.views = PLOTS.map((placement) => new PlotView(placement));
    for (const view of this.views) this.root.add(view.root);
  }

  setLocalSession(sessionId: string): void {
    this.localSession = sessionId;
  }

  get ownPlot(): number {
    return this.localPlot;
  }

  /** A player's replicated state changed: re-point their plot. */
  apply(sessionId: string, state: NetPlayerState): void {
    const plot = state.plot;
    // A player moved plots (never in practice): release the old one.
    for (const [index, owner] of this.owners) {
      if (owner === sessionId && index !== plot) {
        this.owners.delete(index);
        this.views[index]?.setOwner(null);
        this.views[index]?.setStands([]);
      }
    }
    const view = this.views[plot];
    if (!view) return;
    this.owners.set(plot, sessionId);
    const local = sessionId === this.localSession;
    if (local) this.localPlot = plot;
    const owner: PlotOwner = {
      name: state.displayName,
      avatarUrl: state.avatarUrl,
      rebirths: state.rebirths,
      cashPerSec: 0,
      local,
    };
    view.setOwner(owner);
    const stands: StandData[] = [];
    for (let i = 0; i < state.display.length; i += 1) {
      const slot = state.display[i];
      stands.push(slot ? { charId: slot.charId, level: slot.level, income: slot.income, uid: slot.uid } : { charId: '', level: 0, income: 0, uid: 0 });
    }
    view.setStands(stands);
  }

  remove(sessionId: string): void {
    for (const [index, owner] of this.owners) {
      if (owner !== sessionId) continue;
      this.owners.delete(index);
      this.views[index]?.setOwner(null);
      this.views[index]?.setStands([]);
    }
  }

  /** The local inventory and cash, for the price boards on the local plot. */
  setLocal(units: ReadonlyMap<number, UnitRecord>, cash: number, changed: boolean): void {
    const view = this.views[this.localPlot];
    if (!view) return;
    view.setLocal(units, cash);
    if (changed) view.touch();
  }

  update(delta: number, camera: Vector3): void {
    buildBudget.remaining = 3;
    this.localTimer += delta;
    if (this.localTimer >= LOCAL_REFRESH) {
      this.localTimer = 0;
      this.views[this.localPlot]?.touch();
    }
    for (const view of this.views) view.update(delta, camera);
  }

  dispose(): void {
    for (const view of this.views) view.dispose();
    this.root.removeFromParent();
  }
}
