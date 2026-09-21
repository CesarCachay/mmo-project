import type {
  BattleMoveVfxRenderer,
  BattleMoveVfxRenderRequest,
} from "../../vfx/battle-move-vfx.types";
import { playProceduralAoeEffect } from "../../vfx/effects/aoe/ProceduralAoeEffect";
import { playProceduralBattlefieldEffect } from "../../vfx/effects/battlefield/ProceduralBattlefieldEffect";
import { playProceduralGenericEffect } from "../../vfx/effects/generic/ProceduralGenericEffect";
import { playProceduralBarrierEffect } from "../../vfx/effects/barrier/ProceduralBarrierEffect";
import { playProceduralStatusEffect } from "../../vfx/effects/status/ProceduralStatusEffect";
import { playProceduralSupportEffect } from "../../vfx/effects/support/ProceduralSupportEffect";
import { playProceduralTetherEffect } from "../../vfx/effects/tether/ProceduralTetherEffect";
import { playProceduralBeamEffect } from "../../vfx/effects/beam/ProceduralBeamEffect";
import { playProceduralContactEffect } from "../../vfx/effects/contact/ProceduralContactEffect";
import { playProceduralBurstEffect } from "../../vfx/effects/burst/ProceduralBurstEffect";
import { playProceduralGroundEffect } from "../../vfx/effects/ground/ProceduralGroundEffect";
import { playProceduralMeleeEffect } from "../../vfx/effects/melee/ProceduralMeleeEffect";
import { playProceduralMultiProjectileEffect } from "../../vfx/effects/multi-projectile/ProceduralMultiProjectileEffect";
import { playProceduralProjectileEffect } from "../../vfx/effects/projectile/ProceduralProjectileEffect";
import { playProceduralStreamEffect } from "../../vfx/effects/stream/ProceduralStreamEffect";
import { playProceduralSignatureEffect } from "../../vfx/effects/signature/ProceduralSignatureEffect";
import { playProceduralWaveEffect } from "../../vfx/effects/wave/ProceduralWaveEffect";
import { getBattleCanvasPixelRatio } from "../../vfx/performance/battle-vfx-performance";

export class ModernBattleMoveVfxLayer implements BattleMoveVfxRenderer {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private generation = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "battle-move-vfx";
    this.root.setAttribute("aria-hidden", "true");

    this.canvas = document.createElement("canvas");
    this.canvas.className = "battle-move-vfx__canvas";

    const context = this.canvas.getContext("2d");

    if (!context) {
      throw new Error("Battle Move VFX requires Canvas 2D support");
    }

    this.context = context;
    this.root.appendChild(this.canvas);
    parent.appendChild(this.root);
  }

  public async play(request: BattleMoveVfxRenderRequest): Promise<void> {
    const generation = this.beginEffect();
    const size = this.syncCanvasSize();

    if (size.width <= 0 || size.height <= 0) {
      return;
    }

    if (request.definition.archetype === "stream") {
      await playProceduralStreamEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "projectile") {
      await playProceduralProjectileEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "beam") {
      await playProceduralBeamEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "contact") {
      await playProceduralContactEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "melee") {
      await playProceduralMeleeEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "multi-projectile") {
      await playProceduralMultiProjectileEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "burst") {
      await playProceduralBurstEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "ground") {
      await playProceduralGroundEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "wave") {
      await playProceduralWaveEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "aoe") {
      await playProceduralAoeEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "support") {
      await playProceduralSupportEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "status") {
      await playProceduralStatusEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "barrier") {
      await playProceduralBarrierEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "tether") {
      await playProceduralTetherEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "battlefield") {
      await playProceduralBattlefieldEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "signature") {
      await playProceduralSignatureEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }

    if (request.definition.archetype === "generic") {
      await playProceduralGenericEffect({
        ctx: this.context,
        width: size.width,
        height: size.height,
        request,
        isCancelled: () => generation !== this.generation,
      });
      return;
    }
  }

  public clear(): void {
    this.generation += 1;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  private beginEffect(): number {
    this.generation += 1;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    return this.generation;
  }

  private syncCanvasSize(): { width: number; height: number } {
    const bounds = this.root.getBoundingClientRect();
    const width = Math.max(0, bounds.width);
    const height = Math.max(0, bounds.height);
    const pixelRatio = getBattleCanvasPixelRatio();
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    return { width, height };
  }
}
