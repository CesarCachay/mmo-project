import type {
  BattleMoveVfxPoint,
} from "../../vfx/battle-move-vfx.types";
import {
  resolveBattleTypeImpactProfile,
  type BattleTypeImpactPalette,
  type BattleTypeImpactProfile,
  type BattleTypeImpactRequest,
} from "../../vfx/impact/battle-type-impact";
import {
  getBattleCanvasPixelRatio,
  getBattleVfxPerformanceProfile,
} from "../../vfx/performance/battle-vfx-performance";

const TAU = Math.PI * 2;

export class ModernBattleTypeImpactVfxLayer {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private generation = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "battle-move-vfx battle-type-impact-vfx";
    this.root.setAttribute("aria-hidden", "true");

    this.canvas = document.createElement("canvas");
    this.canvas.className = "battle-move-vfx__canvas";

    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("Battle type impact VFX requires Canvas 2D support");
    }

    this.context = context;
    this.root.appendChild(this.canvas);
    parent.appendChild(this.root);
  }

  public async play(request: BattleTypeImpactRequest): Promise<void> {
    const generation = this.beginEffect();
    const size = this.syncCanvasSize();
    if (size.width <= 0 || size.height <= 0) return;

    const performanceProfile = getBattleVfxPerformanceProfile();
    const reducedMotion = performanceProfile.reducedMotion;
    const baseProfile = resolveBattleTypeImpactProfile(request);
    const profile: BattleTypeImpactProfile = {
      ...baseProfile,
      density: Math.max(0.35, baseProfile.density * performanceProfile.particleScale),
    };
    const durationMs = reducedMotion
      ? Math.min(150, profile.durationMs)
      : Math.max(120, Math.round(profile.durationMs * performanceProfile.impactDurationScale));
    const start = performance.now();

    await new Promise<void>((resolve) => {
      const frame = (now: number): void => {
        if (generation !== this.generation) {
          this.clearCanvas();
          resolve();
          return;
        }

        const progress = clamp01((now - start) / durationMs);
        this.clearCanvas();
        this.drawImpact(request.target, profile, progress, now, reducedMotion);

        if (progress >= 1) {
          this.clearCanvas();
          resolve();
          return;
        }

        window.requestAnimationFrame(frame);
      };

      window.requestAnimationFrame(frame);
    });
  }

  public clear(): void {
    this.generation += 1;
    this.clearCanvas();
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  private drawImpact(
    target: BattleMoveVfxPoint,
    profile: BattleTypeImpactProfile,
    progress: number,
    now: number,
    reducedMotion: boolean,
  ): void {
    const ctx = this.context;
    const alpha = envelope(progress);
    const radius = profile.radius * (0.35 + easeOut(progress) * 0.78);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    drawCore(ctx, target, profile.palette, radius, alpha, profile.intensity);

    if (reducedMotion) {
      drawRing(ctx, target, radius * 0.9, profile.palette.inner, 0.55 * alpha, 3);
      ctx.restore();
      return;
    }

    switch (profile.style) {
      case "fire":
        drawFire(ctx, target, profile, progress, now, alpha);
        break;
      case "water":
        drawWater(ctx, target, profile, progress, now, alpha);
        break;
      case "electric":
        drawElectric(ctx, target, profile, progress, now, alpha);
        break;
      case "grass":
        drawGrass(ctx, target, profile, progress, now, alpha);
        break;
      case "ice":
        drawIce(ctx, target, profile, progress, now, alpha);
        break;
      case "fighting":
        drawFighting(ctx, target, profile, progress, now, alpha);
        break;
      case "poison":
        drawPoison(ctx, target, profile, progress, now, alpha);
        break;
      case "ground":
        drawGround(ctx, target, profile, progress, now, alpha);
        break;
      case "flying":
        drawFlying(ctx, target, profile, progress, now, alpha);
        break;
      case "psychic":
        drawPsychic(ctx, target, profile, progress, now, alpha);
        break;
      case "bug":
        drawBug(ctx, target, profile, progress, now, alpha);
        break;
      case "rock":
        drawRock(ctx, target, profile, progress, now, alpha);
        break;
      case "ghost":
        drawGhost(ctx, target, profile, progress, now, alpha);
        break;
      case "dragon":
        drawDragon(ctx, target, profile, progress, now, alpha);
        break;
      case "dark":
        drawDark(ctx, target, profile, progress, now, alpha);
        break;
      case "steel":
        drawSteel(ctx, target, profile, progress, now, alpha);
        break;
      case "fairy":
        drawFairy(ctx, target, profile, progress, now, alpha);
        break;
      case "shadow":
        drawShadow(ctx, target, profile, progress, now, alpha);
        break;
      case "normal":
      default:
        drawNormal(ctx, target, profile, progress, now, alpha);
        break;
    }

    ctx.restore();
  }

  private beginEffect(): number {
    this.generation += 1;
    this.clearCanvas();
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

  private clearCanvas(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

function drawCore(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  palette: BattleTypeImpactPalette,
  radius: number,
  alpha: number,
  intensity: number,
): void {
  const gradient = ctx.createRadialGradient(
    target.x,
    target.y,
    0,
    target.x,
    target.y,
    radius,
  );
  gradient.addColorStop(0, rgba(palette.core, 0.9 * alpha));
  gradient.addColorStop(0.32, rgba(palette.inner, 0.62 * alpha));
  gradient.addColorStop(0.7, rgba(palette.mid, 0.25 * alpha));
  gradient.addColorStop(1, rgba(palette.outer, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius, 0, TAU);
  ctx.fill();

  drawRing(ctx, target, radius * (0.55 + intensity * 0.1), palette.inner, 0.5 * alpha, 2.5);
}

function drawNormal(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  drawRays(ctx, target, profile, progress, now, alpha, 10, 0.8);
  drawRing(ctx, target, profile.radius * (0.45 + progress), profile.palette.core, 0.5 * alpha, 2);
}

function drawFire(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(9, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI * 0.85 + (i / Math.max(1, count - 1)) * Math.PI * 0.7;
    const distance = profile.radius * (0.3 + progress * (0.8 + (i % 3) * 0.08));
    const x = target.x + Math.cos(angle) * distance + Math.sin(now * 0.01 + i) * 3;
    const y = target.y + Math.sin(angle) * distance - progress * 18;
    const size = 4 + (i % 3) * 2.5;
    ctx.fillStyle = rgba(i % 2 === 0 ? profile.palette.inner : profile.palette.mid, 0.72 * alpha);
    ctx.beginPath();
    ctx.moveTo(x, y - size * 1.8);
    ctx.quadraticCurveTo(x + size, y, x, y + size);
    ctx.quadraticCurveTo(x - size, y, x, y - size * 1.8);
    ctx.fill();
  }
  drawRays(ctx, target, profile, progress, now, alpha, 8, 0.6);
}

function drawWater(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  drawRing(ctx, target, profile.radius * (0.45 + progress * 0.9), profile.palette.inner, 0.72 * alpha, 3);
  const count = densityCount(11, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU - Math.PI / 2;
    const distance = profile.radius * (0.25 + progress * (0.6 + (i % 4) * 0.08));
    const wobble = Math.sin(now * 0.012 + i) * 3;
    drawDroplet(ctx, target.x + Math.cos(angle) * distance + wobble, target.y + Math.sin(angle) * distance, 3 + (i % 3), angle, rgba(profile.palette.inner, 0.7 * alpha));
  }
}

function drawElectric(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const branches = densityCount(7, profile.density);
  for (let i = 0; i < branches; i += 1) {
    const angle = i * TAU / branches + now * 0.001;
    drawLightningBranch(ctx, target, angle, profile.radius * (0.75 + progress * 0.55), profile.palette, alpha, i);
  }
}

function drawGrass(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(10, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = i * TAU / count + now * 0.0018;
    const distance = profile.radius * (0.25 + progress * (0.75 + (i % 2) * 0.12));
    drawLeaf(ctx, target.x + Math.cos(angle) * distance, target.y + Math.sin(angle) * distance * 0.7, angle + Math.PI / 2, 7 + (i % 3) * 2, rgba(i % 2 ? profile.palette.mid : profile.palette.inner, 0.7 * alpha));
  }
}

function drawIce(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(9, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = i * TAU / count + Math.sin(now * 0.004 + i) * 0.08;
    const distance = profile.radius * (0.25 + progress * 0.8);
    drawShard(ctx, target.x + Math.cos(angle) * distance, target.y + Math.sin(angle) * distance, angle, 7 + (i % 3) * 3, rgba(profile.palette.inner, 0.76 * alpha));
  }
  drawRing(ctx, target, profile.radius * (0.5 + progress * 0.55), profile.palette.core, 0.44 * alpha, 2);
}

function drawFighting(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  drawRays(ctx, target, profile, progress, now, alpha, densityCount(12, profile.density), 1.1);
  drawRing(ctx, target, profile.radius * (0.4 + progress * 0.8), profile.palette.inner, 0.62 * alpha, 4);
  drawRing(ctx, target, profile.radius * (0.25 + progress * 0.5), profile.palette.core, 0.45 * alpha, 2);
}

function drawPoison(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(9, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = i * TAU / count + now * 0.0009;
    const distance = profile.radius * (0.15 + progress * (0.65 + (i % 3) * 0.09));
    const x = target.x + Math.cos(angle) * distance;
    const y = target.y + Math.sin(angle) * distance - progress * (8 + (i % 4) * 3);
    const r = 3 + (i % 4) * 1.3;
    ctx.strokeStyle = rgba(i % 2 ? profile.palette.inner : profile.palette.mid, 0.72 * alpha);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
  }
}

function drawGround(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const branches = densityCount(7, profile.density);
  ctx.strokeStyle = rgba(profile.palette.mid, 0.72 * alpha);
  ctx.lineWidth = 3;
  for (let i = 0; i < branches; i += 1) {
    const angle = Math.PI * 0.05 + i * Math.PI / Math.max(1, branches - 1) + Math.sin(now * 0.002 + i) * 0.04;
    const length = profile.radius * (0.5 + progress * 0.8);
    ctx.beginPath();
    ctx.moveTo(target.x, target.y + 8);
    const midX = target.x + Math.cos(angle) * length * 0.5;
    const midY = target.y + 8 + Math.sin(angle) * length * 0.26;
    ctx.lineTo(midX, midY);
    ctx.lineTo(target.x + Math.cos(angle) * length, target.y + 8 + Math.sin(angle) * length * 0.38);
    ctx.stroke();
  }
  drawDust(ctx, target, profile, progress, alpha);
}

function drawFlying(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(8, profile.density);
  for (let i = 0; i < count; i += 1) {
    const offsetY = (i - count / 2) * 5;
    const width = profile.radius * (0.4 + progress * 0.8);
    ctx.strokeStyle = rgba(i % 2 ? profile.palette.inner : profile.palette.mid, 0.5 * alpha);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x - width * 0.15, target.y + offsetY, width, -0.5, 0.5);
    ctx.stroke();
  }
  drawRays(ctx, target, profile, progress, now, alpha, 6, 0.45);
}

function drawPsychic(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  for (let i = 0; i < 3; i += 1) {
    drawRing(ctx, target, profile.radius * (0.35 + progress * (0.45 + i * 0.22)), i % 2 ? profile.palette.inner : profile.palette.mid, (0.6 - i * 0.12) * alpha, 2 + i);
  }
  const count = densityCount(8, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = now * 0.003 + i * TAU / count;
    const r = profile.radius * (0.35 + (i % 2) * 0.25);
    drawCircle(ctx, target.x + Math.cos(angle) * r, target.y + Math.sin(angle) * r * 0.65, 2.5, rgba(profile.palette.core, 0.65 * alpha));
  }
}

function drawBug(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(10, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = i * TAU / count + now * 0.0013;
    const distance = profile.radius * (0.25 + progress * 0.8);
    drawDiamond(ctx, target.x + Math.cos(angle) * distance, target.y + Math.sin(angle) * distance, 4 + (i % 3), angle, rgba(i % 2 ? profile.palette.inner : profile.palette.mid, 0.66 * alpha));
  }
}

function drawRock(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(8, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = i * TAU / count + 0.3;
    const distance = profile.radius * (0.2 + progress * 0.78);
    drawRockChunk(ctx, target.x + Math.cos(angle) * distance, target.y + Math.sin(angle) * distance, 6 + (i % 3) * 2, angle + now * 0.001 * (i % 2 ? 1 : -1), rgba(profile.palette.mid, 0.74 * alpha));
  }
}

function drawGhost(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(7, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = i * TAU / count + now * 0.0018;
    const distance = profile.radius * (0.18 + progress * 0.72);
    drawWisp(ctx, target.x + Math.cos(angle) * distance, target.y + Math.sin(angle) * distance - progress * 10, 6 + (i % 3) * 2, angle, rgba(profile.palette.inner, 0.58 * alpha));
  }
  drawRing(ctx, target, profile.radius * (0.4 + progress * 0.75), profile.palette.mid, 0.45 * alpha, 2);
}

function drawDragon(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(7, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = i * TAU / count + now * 0.001;
    const inner = profile.radius * 0.25;
    const outer = profile.radius * (0.65 + progress * 0.5);
    ctx.strokeStyle = rgba(i % 2 ? profile.palette.inner : profile.palette.mid, 0.7 * alpha);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(target.x + Math.cos(angle) * inner, target.y + Math.sin(angle) * inner);
    ctx.quadraticCurveTo(target.x + Math.cos(angle + 0.28) * outer * 0.72, target.y + Math.sin(angle + 0.28) * outer * 0.72, target.x + Math.cos(angle) * outer, target.y + Math.sin(angle) * outer);
    ctx.stroke();
  }
}

function drawDark(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(8, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = i * TAU / count - now * 0.0015;
    const distance = profile.radius * (0.6 - progress * 0.3);
    ctx.strokeStyle = rgba(i % 2 ? profile.palette.inner : profile.palette.mid, 0.6 * alpha);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x + Math.cos(angle) * distance * 0.35, target.y + Math.sin(angle) * distance * 0.35, distance * 0.4, angle + 0.6, angle + 2.4);
    ctx.stroke();
  }
}

function drawSteel(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  drawRays(ctx, target, profile, progress, now, alpha, densityCount(12, profile.density), 0.9);
  const size = profile.radius * (0.35 + progress * 0.65);
  ctx.strokeStyle = rgba(profile.palette.core, 0.65 * alpha);
  ctx.lineWidth = 3;
  ctx.strokeRect(target.x - size * 0.35, target.y - size * 0.35, size * 0.7, size * 0.7);
}

function drawFairy(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  const count = densityCount(10, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = i * TAU / count + now * 0.0016;
    const distance = profile.radius * (0.2 + progress * (0.7 + (i % 2) * 0.12));
    drawStar(ctx, target.x + Math.cos(angle) * distance, target.y + Math.sin(angle) * distance, 3 + (i % 3), rgba(i % 2 ? profile.palette.core : profile.palette.inner, 0.72 * alpha));
  }
}

function drawShadow(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number): void {
  for (let i = 0; i < 4; i += 1) {
    const radius = profile.radius * (0.28 + progress * (0.32 + i * 0.12));
    ctx.strokeStyle = rgba(i % 2 ? profile.palette.inner : profile.palette.mid, (0.5 - i * 0.07) * alpha);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(target.x, target.y, radius, radius * 0.45, now * 0.001 * (i % 2 ? 1 : -1), 0, TAU);
    ctx.stroke();
  }
  drawGhost(ctx, target, profile, progress, now, alpha * 0.75);
}

function drawRays(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, now: number, alpha: number, count: number, scale: number): void {
  for (let i = 0; i < count; i += 1) {
    const angle = i * TAU / count + now * 0.0007;
    const inner = profile.radius * 0.22;
    const outer = profile.radius * (0.45 + progress * 0.75) * scale;
    ctx.strokeStyle = rgba(i % 2 ? profile.palette.inner : profile.palette.mid, 0.7 * alpha);
    ctx.lineWidth = i % 3 === 0 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(target.x + Math.cos(angle) * inner, target.y + Math.sin(angle) * inner);
    ctx.lineTo(target.x + Math.cos(angle) * outer, target.y + Math.sin(angle) * outer);
    ctx.stroke();
  }
}

function drawLightningBranch(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, angle: number, length: number, palette: BattleTypeImpactPalette, alpha: number, seed: number): void {
  ctx.strokeStyle = rgba(seed % 2 ? palette.inner : palette.core, 0.78 * alpha);
  ctx.lineWidth = seed % 3 === 0 ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(target.x, target.y);
  const segments = 4;
  for (let i = 1; i <= segments; i += 1) {
    const d = length * i / segments;
    const jitter = (seed * 13 + i * 7) % 9 - 4;
    const perpendicular = angle + Math.PI / 2;
    ctx.lineTo(
      target.x + Math.cos(angle) * d + Math.cos(perpendicular) * jitter,
      target.y + Math.sin(angle) * d + Math.sin(perpendicular) * jitter,
    );
  }
  ctx.stroke();
}

function drawDust(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, profile: BattleTypeImpactProfile, progress: number, alpha: number): void {
  const count = densityCount(9, profile.density);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.PI + i * Math.PI / Math.max(1, count - 1);
    const distance = profile.radius * (0.15 + progress * 0.65);
    drawCircle(ctx, target.x + Math.cos(angle) * distance, target.y + 12 + Math.sin(angle) * distance * 0.25, 3 + (i % 3), rgba(profile.palette.inner, 0.42 * alpha));
  }
}

function drawDroplet(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, fill: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.6);
  ctx.quadraticCurveTo(size, 0, 0, size);
  ctx.quadraticCurveTo(-size, 0, 0, -size * 1.6);
  ctx.fill();
  ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number, size: number, fill: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.quadraticCurveTo(0, -size * 0.7, size, 0);
  ctx.quadraticCurveTo(0, size * 0.7, -size, 0);
  ctx.fill();
  ctx.restore();
}

function drawShard(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number, size: number, fill: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.25, size * 0.35);
  ctx.lineTo(-size * 0.7, 0);
  ctx.lineTo(-size * 0.25, -size * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, fill: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.7, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRockChunk(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, fill: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(size * 0.35, size * 0.8);
  ctx.lineTo(-size * 0.7, size * 0.55);
  ctx.lineTo(-size, -size * 0.2);
  ctx.lineTo(-size * 0.25, -size * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWisp(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, stroke: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-size, size * 0.4);
  ctx.quadraticCurveTo(0, -size, size, 0);
  ctx.quadraticCurveTo(size * 0.2, size * 0.2, size * 0.55, size * 0.8);
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / 4;
    const r = i % 2 === 0 ? radius : radius * 0.35;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawRing(ctx: CanvasRenderingContext2D, target: BattleMoveVfxPoint, radius: number, rgb: string, alpha: number, width: number): void {
  ctx.strokeStyle = rgba(rgb, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius, 0, TAU);
  ctx.stroke();
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function densityCount(base: number, density: number): number {
  return Math.max(1, Math.round(base * density));
}

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${clamp01(alpha)})`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOut(value: number): number {
  const t = 1 - clamp01(value);
  return 1 - t * t * t;
}

function envelope(progress: number): number {
  if (progress < 0.12) return progress / 0.12;
  if (progress > 0.78) return (1 - progress) / 0.22;
  return 1;
}
