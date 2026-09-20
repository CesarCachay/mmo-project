import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import { getGroundEffectPreset, type GroundEffectPreset } from "./ground-effect.presets";

interface GroundRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

const TAU = Math.PI * 2;

export async function playProceduralGroundEffect(runtime: GroundRuntime): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;
  if (request.definition.archetype !== "ground") return;

  const preset = getGroundEffectPreset(request.definition.presetId);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const missed = request.missed ?? false;
  const target = resolveTarget(request.source, request.target, missed);
  const durationMs = request.definition.durationMs;

  if (reduced) {
    drawReduced(ctx, width, height, target, preset, !missed || preset.mode === "quake");
    await delay(140);
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const frame = (now: number): void => {
      if (isCancelled()) {
        ctx.clearRect(0, 0, width, height);
        resolve();
        return;
      }

      const elapsed = Math.min(durationMs, now - start);
      const p = clamp01(elapsed / durationMs);
      ctx.clearRect(0, 0, width, height);

      if (preset.mode === "quake") {
        drawEarthquake(ctx, width, height, target, preset, p, now);
      } else {
        drawEarthPower(ctx, height, request.source, target, preset, p, now, !missed);
      }

      if (elapsed >= durationMs) {
        ctx.clearRect(0, 0, width, height);
        resolve();
        return;
      }
      window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(frame);
  });
}

function drawEarthquake(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  target: BattleMoveVfxPoint,
  preset: GroundEffectPreset,
  progress: number,
  now: number,
): void {
  const groundY = Math.min(height - 8, Math.max(target.y + 36, height * preset.groundYRatio));
  const active = easeOutCubic(clamp01((progress - preset.chargeEnd) / Math.max(0.001, preset.impactEnd - preset.chargeEnd)));
  const fade = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
  const shake = Math.sin(now * 0.085) * 6 * active * fade;

  ctx.save();
  ctx.translate(shake, 0);
  ctx.globalCompositeOperation = "lighter";

  if (progress > preset.chargeEnd && progress < 0.34 && preset.screenFlashAlpha > 0) {
    ctx.fillStyle = rgba(preset.palette.core, preset.screenFlashAlpha * (1 - (progress - preset.chargeEnd) / 0.24));
    ctx.fillRect(-10, 0, width + 20, height);
  }

  const spread = width * preset.crackSpread * active;
  for (let i = 0; i < preset.crackCount; i += 1) {
    const seed = pseudo(i * 37 + 11);
    const x = width * 0.5 + (seed - 0.5) * spread;
    const length = 22 + pseudo(i * 67 + 3) * 58 * active;
    const lean = (pseudo(i * 19 + 5) - 0.5) * 28;
    ctx.strokeStyle = rgba(preset.palette.crack, (0.35 + pseudo(i * 23 + 7) * 0.45) * fade);
    ctx.lineWidth = 1.4 + pseudo(i * 13 + 2) * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + lean * 0.35, groundY - length * 0.38);
    ctx.lineTo(x - lean * 0.2, groundY - length * 0.68);
    ctx.lineTo(x + lean, groundY - length);
    ctx.stroke();
  }

  for (let ring = 0; ring < preset.ringCount; ring += 1) {
    const rp = clamp01(active - ring * 0.12);
    ctx.strokeStyle = rgba(preset.palette.glow, (0.45 - ring * 0.07) * fade);
    ctx.lineWidth = Math.max(1, 4 - ring * 0.7);
    ctx.beginPath();
    ctx.ellipse(target.x, groundY - 2, 28 + rp * (70 + ring * 24), 8 + rp * (18 + ring * 4), 0, 0, TAU);
    ctx.stroke();
  }

  drawDust(ctx, target, groundY, preset, active, fade, now);
  ctx.restore();
}

function drawEarthPower(
  ctx: CanvasRenderingContext2D,
  height: number,
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  preset: GroundEffectPreset,
  progress: number,
  now: number,
  shouldImpact: boolean,
): void {
  const groundY = Math.min(height - 8, Math.max(target.y + 38, height * preset.groundYRatio));
  const sourceGround = { x: source.x, y: Math.min(height - 8, Math.max(source.y + 36, height * preset.groundYRatio)) };
  const travel = easeInOutCubic(clamp01((progress - preset.chargeEnd) / Math.max(0.001, preset.travelEnd - preset.chargeEnd)));

  if (progress < preset.chargeEnd) {
    const c = easeOutCubic(progress / preset.chargeEnd);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    radial(ctx, sourceGround, 16 + 26 * c, preset.palette.glow, preset.palette.core, 0.5 * c);
    ctx.restore();
    return;
  }

  const dx = target.x - sourceGround.x;
  const segments = Math.max(4, Math.round(12 * travel));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(preset.palette.crack, 0.78);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sourceGround.x, sourceGround.y);
  for (let i = 1; i <= segments; i += 1) {
    const t = (i / 12) * travel;
    const x = sourceGround.x + dx * t;
    const y = sourceGround.y + (groundY - sourceGround.y) * t + Math.sin(i * 2.2) * 5;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  if (progress >= preset.travelEnd && shouldImpact) {
    const ip = clamp01((progress - preset.travelEnd) / Math.max(0.001, preset.impactEnd - preset.travelEnd));
    const fade = ip < 0.68 ? 1 : 1 - (ip - 0.68) / 0.32;
    for (let i = 0; i < preset.eruptionCount; i += 1) {
      const offset = (pseudo(i * 31 + 9) - 0.5) * 92;
      const local = clamp01(ip * 1.35 - i * 0.055);
      const h = (24 + pseudo(i * 43 + 2) * 64) * easeOutCubic(local);
      const x = target.x + offset;
      const baseY = groundY + pseudo(i * 17 + 4) * 8;
      const g = ctx.createLinearGradient(x, baseY, x, baseY - h);
      g.addColorStop(0, rgba(preset.palette.glow, 0));
      g.addColorStop(0.35, rgba(preset.palette.glow, 0.6 * fade));
      g.addColorStop(1, rgba(preset.palette.core, 0.88 * fade));
      ctx.strokeStyle = g;
      ctx.lineWidth = 5 + pseudo(i * 13 + 7) * 7;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + (pseudo(i * 29 + 5) - 0.5) * 12, baseY - h);
      ctx.stroke();
    }
    radial(ctx, { x: target.x, y: groundY - 10 }, 42 + ip * 48, preset.palette.glow, preset.palette.core, 0.45 * fade);
    drawDust(ctx, target, groundY, preset, ip, fade, now);
  }
  ctx.restore();
}

function drawDust(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  groundY: number,
  preset: GroundEffectPreset,
  progress: number,
  fade: number,
  now: number,
): void {
  for (let i = 0; i < preset.dustCount; i += 1) {
    const angle = pseudo(i * 41 + 1) * Math.PI;
    const drift = (20 + pseudo(i * 17 + 8) * 95) * progress;
    const x = target.x + Math.cos(angle) * drift + Math.sin(now * 0.002 + i) * 2;
    const y = groundY - Math.sin(angle) * drift * 0.22 - progress * (8 + pseudo(i * 29 + 6) * 20);
    circle(ctx, x, y, 3 + pseudo(i * 53 + 3) * 7, rgba(preset.palette.dust, 0.18 * fade));
  }
}

function drawReduced(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  target: BattleMoveVfxPoint,
  preset: GroundEffectPreset,
  shouldImpact: boolean,
): void {
  if (!shouldImpact) return;
  const y = Math.min(height - 8, Math.max(target.y + 36, height * preset.groundYRatio));
  ctx.save();
  ctx.strokeStyle = rgba(preset.palette.crack, 0.7);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.max(0, target.x - width * 0.16), y);
  ctx.lineTo(target.x - 18, y - 16);
  ctx.lineTo(target.x, y + 2);
  ctx.lineTo(target.x + 20, y - 14);
  ctx.lineTo(Math.min(width, target.x + width * 0.16), y);
  ctx.stroke();
  ctx.restore();
}

function resolveTarget(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint, missed: boolean): BattleMoveVfxPoint {
  if (!missed) return target;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  const px = -dy / d;
  const py = dx / d;
  const side = source.x <= target.x ? -1 : 1;
  return { x: target.x + px * 82 * side + (dx / d) * 26, y: target.y + py * 82 * side + (dy / d) * 26 };
}

function radial(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, radius: number, outer: string, core: string, alpha: number): void {
  const g = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(1, radius));
  g.addColorStop(0, rgba(core, alpha));
  g.addColorStop(1, rgba(outer, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, TAU);
  ctx.fill();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function rgba(rgb: string, alpha: number): string { return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`; }
function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function easeOutCubic(v: number): number { const t = 1 - clamp01(v); return 1 - t * t * t; }
function easeInOutCubic(v: number): number { const t = clamp01(v); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function pseudo(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
