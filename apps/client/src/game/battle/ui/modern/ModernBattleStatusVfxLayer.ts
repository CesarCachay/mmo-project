import type { BattleMajorStatusCondition } from "@cesar-mmo/shared";

import {
  getBattleStatusVfxBurstDefinition,
  getBattleStatusVfxDefinition,
  type BattleStatusVfxBurstKind,
  type BattleStatusVfxId,
} from "./battle-status-vfx";

export interface ModernBattleStatusVfxState {
  readonly major: BattleMajorStatusCondition | null;
  readonly confused: boolean;
}

const MAX_CONCURRENT_STATUS_BURSTS = 2;

export class ModernBattleStatusVfxLayer {
  private readonly root: HTMLDivElement;
  private readonly majorLayer: HTMLDivElement;
  private readonly confusionLayer: HTMLDivElement;
  private readonly burstLayer: HTMLDivElement;

  private major: BattleMajorStatusCondition | null = null;
  private confused = false;
  private visible = true;
  private burstTimers = new Set<number>();
  private activeBursts: HTMLDivElement[] = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "battle-status-vfx";
    this.root.ariaHidden = "true";

    this.majorLayer = document.createElement("div");
    this.majorLayer.className = "battle-status-vfx__slot battle-status-vfx__slot--major";

    this.confusionLayer = document.createElement("div");
    this.confusionLayer.className = "battle-status-vfx__slot battle-status-vfx__slot--confusion";

    this.burstLayer = document.createElement("div");
    this.burstLayer.className = "battle-status-vfx__burst-layer";

    this.root.append(this.majorLayer, this.confusionLayer, this.burstLayer);
    parent.appendChild(this.root);
    this.refreshVisibility();
  }

  public setState(state: ModernBattleStatusVfxState): void {
    this.setMajorStatus(state.major);
    this.setConfused(state.confused);
  }

  public setMajorStatus(status: BattleMajorStatusCondition | null): void {
    if (this.major === status) {
      return;
    }

    this.major = status;
    this.renderSlot(this.majorLayer, status);
    this.refreshVisibility();
  }

  public setConfused(confused: boolean): void {
    if (this.confused === confused) {
      return;
    }

    this.confused = confused;
    this.renderSlot(this.confusionLayer, confused ? "confusion" : null);
    this.refreshVisibility();
  }

  public playBurst(status: BattleStatusVfxId, kind: BattleStatusVfxBurstKind): Promise<void> {
    const definition = getBattleStatusVfxDefinition(status);
    const burstDefinition = getBattleStatusVfxBurstDefinition(kind);
    const burst = document.createElement("div");
    burst.className = [
      "battle-status-vfx__burst",
      definition.className,
      burstDefinition.className,
      `battle-status-vfx__burst--status-${status}`,
    ].join(" ");
    burst.setAttribute("aria-label", `${definition.ariaLabel} ${kind} burst`);
    burst.dataset.statusVfx = status;
    burst.dataset.statusVfxBurst = kind;

    for (let index = 0; index < burstDefinition.particleCount; index += 1) {
      const particle = document.createElement("span");
      particle.className = "battle-status-vfx__burst-particle";
      particle.style.setProperty("--status-vfx-index", String(index));
      particle.style.setProperty("--status-vfx-count", String(burstDefinition.particleCount));
      particle.style.setProperty("--status-vfx-x", `${14 + ((index * 13) % 72)}%`);
      particle.style.setProperty("--status-vfx-y", `${12 + ((index * 17) % 58)}%`);
      particle.style.setProperty("--status-vfx-angle", `${(360 / burstDefinition.particleCount) * index}deg`);
      particle.style.setProperty("--status-vfx-delay", `${index * 25}ms`);
      burst.appendChild(particle);
    }

    while (this.activeBursts.length >= MAX_CONCURRENT_STATUS_BURSTS) {
      const oldestBurst = this.activeBursts.shift();
      oldestBurst?.remove();
    }

    this.activeBursts.push(burst);
    this.burstLayer.appendChild(burst);
    this.refreshVisibility();

    return new Promise((resolve) => {
      const cleanup = () => {
        timerHandle && this.burstTimers.delete(timerHandle);
        burst.remove();
        this.activeBursts = this.activeBursts.filter((candidate) => candidate !== burst);
        this.refreshVisibility();
        resolve();
      };
      const timerHandle = window.setTimeout(cleanup, burstDefinition.durationMs);
      this.burstTimers.add(timerHandle);
    });
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.refreshVisibility();
  }

  public syncToSprite(sprite: HTMLElement): void {
    const computedStyle = window.getComputedStyle(sprite);

    this.root.style.left = `${sprite.offsetLeft}px`;
    this.root.style.top = `${sprite.offsetTop}px`;
    this.root.style.width = `${sprite.offsetWidth}px`;
    this.root.style.height = `${sprite.offsetHeight}px`;
    this.root.style.transform = computedStyle.transform;
    this.root.style.transformOrigin = computedStyle.transformOrigin;
  }

  public clear(): void {
    this.major = null;
    this.confused = false;
    this.majorLayer.replaceChildren();
    this.confusionLayer.replaceChildren();
    this.burstLayer.replaceChildren();
    this.activeBursts = [];
    for (const timer of this.burstTimers) {
      window.clearTimeout(timer);
    }
    this.burstTimers.clear();
    this.root.removeAttribute("style");
    this.visible = true;
    this.refreshVisibility();
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  private renderSlot(
    slot: HTMLDivElement,
    status: BattleStatusVfxId | null,
  ): void {
    slot.replaceChildren();

    if (status === null) {
      return;
    }

    const definition = getBattleStatusVfxDefinition(status);
    const effect = document.createElement("div");
    effect.className = [
      "battle-status-vfx__effect",
      definition.className,
    ].join(" ");
    effect.setAttribute("aria-label", definition.ariaLabel);
    effect.dataset.statusVfx = status;

    for (let index = 0; index < definition.particleCount; index += 1) {
      const particle = document.createElement("span");
      particle.className = "battle-status-vfx__particle";
      particle.style.setProperty("--status-vfx-index", String(index));
      particle.style.setProperty(
        "--status-vfx-count",
        String(definition.particleCount),
      );
      particle.style.setProperty(
        "--status-vfx-x",
        `${10 + ((index * 17) % 78)}%`,
      );
      particle.style.setProperty(
        "--status-vfx-y",
        `${8 + ((index * 19) % 64)}%`,
      );
      particle.style.setProperty(
        "--status-vfx-angle",
        `${(360 / definition.particleCount) * index}deg`,
      );
      particle.style.setProperty(
        "--status-vfx-delay",
        `${-index * 170}ms`,
      );
      effect.appendChild(particle);
    }

    slot.appendChild(effect);
  }

  private refreshVisibility(): void {
    const hasBurst = this.burstLayer.childElementCount > 0;
    this.root.hidden = !this.visible || (!hasBurst && this.major === null && !this.confused);
  }
}
