import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import {
  getBurstEffectPreset,
  type BurstEffectPreset,
} from "./burst-effect.presets";

interface ProceduralBurstRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

interface BurstGeometry {
  readonly source: BattleMoveVfxPoint;
  readonly target: BattleMoveVfxPoint;
  readonly dx: number;
  readonly dy: number;
  readonly distance: number;
  readonly ux: number;
  readonly uy: number;
  readonly px: number;
  readonly py: number;
}

const TAU = Math.PI * 2;

export async function playProceduralBurstEffect(runtime: ProceduralBurstRuntime): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;

  if (request.definition.archetype !== "burst") {
    return;
  }

  const preset = getBurstEffectPreset(request.definition.presetId);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const missed = request.missed ?? false;
  const resolvedTarget = preset.origin === "target"
    ? resolveBurstTarget(request.source, request.target, missed)
    : request.target;
  const geometry = getGeometry(request.source, resolvedTarget);

  if (reduced) {
    const center = preset.origin === "source" ? request.source : resolvedTarget;
    drawReducedBurst(ctx, center, preset, preset.origin === "source" || !missed);
    await delay(150);
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const durationMs = request.definition.durationMs;
  const startTime = performance.now();

  await new Promise<void>((resolve) => {
    const frame = (now: number): void => {
      if (isCancelled()) {
        ctx.clearRect(0, 0, width, height);
        resolve();
        return;
      }

      const elapsed = Math.min(durationMs, now - startTime);
      const progress = clamp01(elapsed / durationMs);
      ctx.clearRect(0, 0, width, height);

      if (progress < preset.chargeEnd) {
        drawBurstCharge(ctx, request.source, preset, progress / preset.chargeEnd, now);
      } else if (preset.origin === "target" && progress < preset.travelEnd) {
        const travelProgress = easeInOutCubic(
          (progress - preset.chargeEnd) / Math.max(0.001, preset.travelEnd - preset.chargeEnd),
        );
        drawTravelFlare(ctx, geometry, travelProgress, preset, now);
      } else {
        const canBurst = preset.origin === "source" || !missed;
        if (canBurst) {
          const burstStart = preset.origin === "source" ? preset.chargeEnd : preset.travelEnd;
          const burstProgress = clamp01(
            (progress - burstStart) / Math.max(0.001, preset.burstEnd - burstStart),
          );
          const center = preset.origin === "source" ? request.source : request.target;
          drawBurst(ctx, center, preset, burstProgress, now, width, height);
        } else if (preset.origin === "target") {
          const fade = 1 - clamp01((progress - preset.travelEnd) / Math.max(0.001, 1 - preset.travelEnd));
          drawTravelFlare(ctx, geometry, 1, preset, now, fade);
        }
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

function resolveBurstTarget(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  missed: boolean,
): BattleMoveVfxPoint {
  if (!missed) return target;
  const geometry = getGeometry(source, target);
  const side = source.x <= target.x ? -1 : 1;
  const offset = Math.min(115, Math.max(64, geometry.distance * 0.2));
  return {
    x: target.x + geometry.px * offset * side + geometry.ux * 30,
    y: target.y + geometry.py * offset * side + geometry.uy * 30,
  };
}

function getGeometry(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint): BurstGeometry {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  return {
    source,
    target,
    dx,
    dy,
    distance,
    ux: dx / distance,
    uy: dy / distance,
    px: -dy / distance,
    py: dx / distance,
  };
}

function drawBurstCharge(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  preset: BurstEffectPreset,
  progress: number,
  now: number,
): void {
  const eased = easeOutCubic(clamp01(progress));
  const pulse = 0.9 + Math.sin(now * 0.025) * 0.1;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawRadial(ctx, source, 14 + 25 * eased * pulse, preset.palette.outer, preset.palette.core, 0.5 * eased);
  for (let index = 0; index < 8; index += 1) {
    const angle = now * 0.004 + index * TAU / 8;
    const orbit = 18 + 18 * eased;
    drawCircle(
      ctx,
      source.x + Math.cos(angle) * orbit,
      source.y + Math.sin(angle) * orbit,
      2 + eased * 2.5,
      rgba(preset.palette.inner, 0.75 * eased),
    );
  }
  ctx.restore();
}

function drawTravelFlare(
  ctx: CanvasRenderingContext2D,
  geometry: BurstGeometry,
  progress: number,
  preset: BurstEffectPreset,
  now: number,
  opacity = 1,
): void {
  const t = clamp01(progress);
  const wobble = Math.sin(now * 0.013 + t * 9) * 6 * Math.sin(Math.PI * t);
  const x = geometry.source.x + geometry.dx * t + geometry.px * wobble;
  const y = geometry.source.y + geometry.dy * t + geometry.py * wobble;
  const tailT = Math.max(0, t - 70 / geometry.distance);
  const tx = geometry.source.x + geometry.dx * tailT;
  const ty = geometry.source.y + geometry.dy * tailT;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createLinearGradient(tx, ty, x, y);
  gradient.addColorStop(0, rgba(preset.palette.outer, 0));
  gradient.addColorStop(1, rgba(preset.palette.inner, 0.7 * opacity));
  ctx.strokeStyle = gradient;
  ctx.lineWidth = preset.travelRadius * 0.85;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(x, y);
  ctx.stroke();
  drawRadial(
    ctx,
    { x, y },
    preset.travelRadius * 2,
    preset.palette.outer,
    preset.palette.core,
    0.85 * opacity,
  );
  ctx.restore();
}

function drawBurst(
  ctx: CanvasRenderingContext2D,
  center: BattleMoveVfxPoint,
  preset: BurstEffectPreset,
  progress: number,
  now: number,
  width: number,
  height: number,
): void {
  const p = clamp01(progress);
  const expansion = easeOutCubic(Math.min(1, p * 1.25));
  const fade = p < 0.62 ? 1 : 1 - (p - 0.62) / 0.38;
  const radius = preset.burstRadius * expansion;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  if (preset.screenFlashAlpha > 0 && p < 0.22) {
    ctx.fillStyle = rgba(preset.palette.core, preset.screenFlashAlpha * (1 - p / 0.22));
    ctx.fillRect(0, 0, width, height);
  }

  drawRadial(ctx, center, radius, preset.palette.outer, preset.palette.core, 0.72 * fade);
  drawRadial(ctx, center, radius * 0.55, preset.palette.mid, preset.palette.core, 0.86 * fade);

  for (let ring = 0; ring < preset.ringCount; ring += 1) {
    const ringProgress = clamp01(p * 1.25 - ring * 0.08);
    const ringRadius = preset.burstRadius * ringProgress * (0.72 + ring * 0.14);
    ctx.strokeStyle = rgba(preset.palette.inner, (0.62 - ring * 0.08) * fade);
    ctx.lineWidth = Math.max(1.5, 5 - ring * 0.8);
    ctx.beginPath();
    ctx.arc(center.x, center.y, ringRadius, 0, TAU);
    ctx.stroke();
  }

  for (let ray = 0; ray < preset.rayCount; ray += 1) {
    const angle = (ray / preset.rayCount) * TAU + pseudoRandom(ray * 19 + 5) * 0.2;
    const rayLength = radius * (0.55 + pseudoRandom(ray * 41 + 3) * 0.75);
    const inner = radius * 0.2;
    ctx.strokeStyle = rgba(preset.palette.ray, (0.3 + pseudoRandom(ray * 23 + 9) * 0.45) * fade);
    ctx.lineWidth = 1 + pseudoRandom(ray * 13 + 1) * 2.4;
    ctx.beginPath();
    ctx.moveTo(center.x + Math.cos(angle) * inner, center.y + Math.sin(angle) * inner);
    ctx.lineTo(center.x + Math.cos(angle) * rayLength, center.y + Math.sin(angle) * rayLength);
    ctx.stroke();
  }

  drawSmoke(ctx, center, radius, preset, p, now, fade);
  ctx.restore();
}

function drawSmoke(
  ctx: CanvasRenderingContext2D,
  center: BattleMoveVfxPoint,
  radius: number,
  preset: BurstEffectPreset,
  progress: number,
  now: number,
  fade: number,
): void {
  if (progress < 0.2) return;
  const smokeProgress = clamp01((progress - 0.2) / 0.8);
  for (let index = 0; index < preset.smokeCount; index += 1) {
    const angle = (index / preset.smokeCount) * TAU + pseudoRandom(index * 31 + 4) * 0.5;
    const drift = radius * (0.3 + smokeProgress * (0.45 + pseudoRandom(index * 17 + 6) * 0.4));
    const lift = smokeProgress * (12 + pseudoRandom(index * 47 + 8) * 24);
    const wobble = Math.sin(now * 0.003 + index) * 3;
    const x = center.x + Math.cos(angle) * drift + wobble;
    const y = center.y + Math.sin(angle) * drift - lift;
    const size = 7 + pseudoRandom(index * 61 + 2) * 13 + smokeProgress * 7;
    drawCircle(ctx, x, y, size, rgba(preset.palette.smoke, 0.18 * fade));
  }
}

function drawReducedBurst(
  ctx: CanvasRenderingContext2D,
  center: BattleMoveVfxPoint,
  preset: BurstEffectPreset,
  shouldBurst: boolean,
): void {
  if (!shouldBurst) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawRadial(ctx, center, preset.burstRadius * 0.65, preset.palette.outer, preset.palette.core, 0.5);
  ctx.strokeStyle = rgba(preset.palette.inner, 0.65);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center.x, center.y, preset.burstRadius * 0.72, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawRadial(
  ctx: CanvasRenderingContext2D,
  center: BattleMoveVfxPoint,
  radius: number,
  outer: string,
  core: string,
  alpha: number,
): void {
  if (radius <= 0) return;
  const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
  gradient.addColorStop(0, rgba(core, alpha));
  gradient.addColorStop(0.35, rgba(core, alpha * 0.72));
  gradient.addColorStop(0.72, rgba(outer, alpha * 0.45));
  gradient.addColorStop(1, rgba(outer, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, TAU);
  ctx.fill();
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, radius), 0, TAU);
  ctx.fill();
}

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${clamp01(alpha)})`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(value: number): number {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
