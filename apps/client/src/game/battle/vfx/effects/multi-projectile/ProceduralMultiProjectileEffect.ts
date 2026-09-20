import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import {
  getMultiProjectileEffectPreset,
  type MultiProjectileEffectPreset,
} from "./multi-projectile-effect.presets";

interface ProceduralMultiProjectileRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

interface MultiProjectileGeometry {
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

export async function playProceduralMultiProjectileEffect(
  runtime: ProceduralMultiProjectileRuntime,
): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;

  if (request.definition.archetype !== "multi-projectile") {
    return;
  }

  const preset = getMultiProjectileEffectPreset(request.definition.presetId);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const resolvedTarget = resolveVolleyTarget(request.source, request.target, request.missed ?? false);
  const geometry = getGeometry(request.source, resolvedTarget);

  if (reduced) {
    drawReducedMotionVolley(ctx, geometry, request.target, request.missed ?? false, preset);
    await delay(140);
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
        drawVolleyCharge(ctx, geometry.source, progress / preset.chargeEnd, now, preset);
      }

      for (let index = 0; index < preset.count; index += 1) {
        drawProjectileForIndex(
          ctx,
          geometry,
          request.target,
          request.missed ?? false,
          preset,
          index,
          progress,
          now,
        );
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

function drawProjectileForIndex(
  ctx: CanvasRenderingContext2D,
  geometry: MultiProjectileGeometry,
  actualTarget: BattleMoveVfxPoint,
  missed: boolean,
  preset: MultiProjectileEffectPreset,
  index: number,
  globalProgress: number,
  now: number,
): void {
  const start = preset.chargeEnd + index * preset.stagger;
  const end = Math.min(preset.volleyEnd, start + (preset.volleyEnd - preset.chargeEnd) * 0.62);
  const impactEnd = Math.min(1, end + 0.16);

  if (globalProgress < start || globalProgress > impactEnd) {
    return;
  }

  const spreadSeed = pseudoRandom(index * 29 + 11) - 0.5;
  const longitudinalSeed = pseudoRandom(index * 43 + 7) - 0.5;
  const targetOffset = spreadSeed * preset.spread;
  const localTarget = {
    x: geometry.target.x + geometry.px * targetOffset + geometry.ux * longitudinalSeed * 7,
    y: geometry.target.y + geometry.py * targetOffset + geometry.uy * longitudinalSeed * 7,
  };
  const localGeometry = getGeometry(geometry.source, localTarget);

  if (globalProgress <= end) {
    const t = easeInOutCubic(clamp01((globalProgress - start) / Math.max(0.001, end - start)));
    const position = getProjectilePosition(localGeometry, t, preset, index);
    drawTrail(ctx, localGeometry, t, position, preset);
    drawProjectile(ctx, position, localGeometry, preset, index, now);
    return;
  }

  if (!missed) {
    const impactProgress = clamp01((globalProgress - end) / Math.max(0.001, impactEnd - end));
    drawMiniImpact(ctx, actualTarget, localGeometry, preset, index, impactProgress);
  }
}

function resolveVolleyTarget(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  missed: boolean,
): BattleMoveVfxPoint {
  if (!missed) {
    return target;
  }

  const geometry = getGeometry(source, target);
  const side = source.x <= target.x ? -1 : 1;
  const offset = Math.min(110, Math.max(64, geometry.distance * 0.2));
  return {
    x: target.x + geometry.px * offset * side + geometry.ux * 34,
    y: target.y + geometry.py * offset * side + geometry.uy * 34,
  };
}

function getGeometry(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
): MultiProjectileGeometry {
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

function getProjectilePosition(
  geometry: MultiProjectileGeometry,
  progress: number,
  preset: MultiProjectileEffectPreset,
  index: number,
): BattleMoveVfxPoint {
  const arcVariation = 0.75 + pseudoRandom(index * 17 + 3) * 0.5;
  const arc = Math.sin(Math.PI * progress) * preset.arcHeight * arcVariation;
  return {
    x: geometry.source.x + geometry.dx * progress,
    y: geometry.source.y + geometry.dy * progress + arc,
  };
}

function drawVolleyCharge(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  progress: number,
  now: number,
  preset: MultiProjectileEffectPreset,
): void {
  const eased = easeOutCubic(clamp01(progress));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let index = 0; index < Math.min(5, preset.count); index += 1) {
    const angle = now * 0.005 + index * (TAU / Math.min(5, preset.count));
    const orbit = 7 + eased * 10;
    drawCircle(
      ctx,
      source.x + Math.cos(angle) * orbit,
      source.y + Math.sin(angle) * orbit,
      1.7 + eased * 1.8,
      rgba(preset.palette.core, 0.6 * eased),
    );
  }
  drawCircle(ctx, source.x, source.y, 7 + eased * 8, rgba(preset.palette.outer, 0.14 * eased));
  ctx.restore();
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  geometry: MultiProjectileGeometry,
  progress: number,
  head: BattleMoveVfxPoint,
  preset: MultiProjectileEffectPreset,
): void {
  const backProgress = Math.max(0, progress - preset.trailLength / geometry.distance);
  const tail = {
    x: geometry.source.x + geometry.dx * backProgress,
    y: geometry.source.y + geometry.dy * backProgress + Math.sin(Math.PI * backProgress) * preset.arcHeight,
  };
  const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
  gradient.addColorStop(0, rgba(preset.palette.trail, 0));
  gradient.addColorStop(1, rgba(preset.palette.trail, 0.64));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = gradient;
  ctx.lineCap = "round";
  ctx.lineWidth = preset.trailWidth;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();
  ctx.restore();
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  position: BattleMoveVfxPoint,
  geometry: MultiProjectileGeometry,
  preset: MultiProjectileEffectPreset,
  index: number,
  now: number,
): void {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(Math.atan2(geometry.dy, geometry.dx));
  ctx.globalCompositeOperation = "lighter";

  if (preset.shape === "needle") {
    ctx.fillStyle = rgba(preset.palette.outer, 0.84);
    ctx.beginPath();
    ctx.moveTo(preset.radius * 2.5, 0);
    ctx.lineTo(-preset.radius * 1.6, -preset.radius * 0.65);
    ctx.lineTo(-preset.radius * 1.1, 0);
    ctx.lineTo(-preset.radius * 1.6, preset.radius * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(preset.palette.core, 0.96);
    ctx.beginPath();
    ctx.moveTo(preset.radius * 2.15, 0);
    ctx.lineTo(-preset.radius * 0.9, -1.2);
    ctx.lineTo(-preset.radius * 0.9, 1.2);
    ctx.closePath();
    ctx.fill();
  } else if (preset.shape === "rock") {
    ctx.rotate(now * 0.005 * (index % 2 === 0 ? 1 : -1));
    ctx.fillStyle = rgba(preset.palette.inner, 0.92);
    ctx.strokeStyle = rgba(preset.palette.core, 0.72);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sides = 6;
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * TAU;
      const r = preset.radius * (0.78 + pseudoRandom(index * 53 + side * 9) * 0.32);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (side === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (preset.shape === "seed") {
    ctx.scale(1.45, 0.78);
    drawCircle(ctx, 0, 0, preset.radius, rgba(preset.palette.inner, 0.94));
    drawCircle(ctx, preset.radius * 0.28, -preset.radius * 0.2, preset.radius * 0.35, rgba(preset.palette.core, 0.85));
  } else {
    drawCircle(ctx, 0, 0, preset.radius * 1.55, rgba(preset.palette.outer, 0.24));
    drawCircle(ctx, 0, 0, preset.radius, rgba(preset.palette.inner, 0.9));
    drawCircle(ctx, -preset.radius * 0.22, -preset.radius * 0.2, preset.radius * 0.35, rgba(preset.palette.core, 0.92));
  }

  ctx.restore();
}

function drawMiniImpact(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  geometry: MultiProjectileGeometry,
  preset: MultiProjectileEffectPreset,
  index: number,
  progress: number,
): void {
  const alpha = 1 - progress;
  const spread = (pseudoRandom(index * 31 + 19) - 0.5) * preset.spread * 0.7;
  const center = {
    x: target.x + geometry.px * spread,
    y: target.y + geometry.py * spread,
  };
  const radius = preset.impactRadius * (0.5 + easeOutCubic(progress) * 0.8);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawCircle(ctx, center.x, center.y, radius, rgba(preset.palette.impact, 0.3 * alpha));
  drawCircle(ctx, center.x, center.y, radius * 0.38, rgba(preset.palette.core, 0.8 * alpha));

  for (let particle = 0; particle < preset.particleCount; particle += 1) {
    const angle = (particle / preset.particleCount) * TAU + index * 0.7;
    const length = radius * (0.7 + pseudoRandom(index * 71 + particle * 13) * 0.7);
    ctx.strokeStyle = rgba(preset.palette.particle, 0.55 * alpha);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(center.x + Math.cos(angle) * length, center.y + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.restore();
}

function drawReducedMotionVolley(
  ctx: CanvasRenderingContext2D,
  geometry: MultiProjectileGeometry,
  actualTarget: BattleMoveVfxPoint,
  missed: boolean,
  preset: MultiProjectileEffectPreset,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(preset.palette.trail, 0.6);
  ctx.lineWidth = 3;
  for (let index = -1; index <= 1; index += 1) {
    ctx.beginPath();
    ctx.moveTo(geometry.source.x + geometry.px * index * 6, geometry.source.y + geometry.py * index * 6);
    ctx.lineTo(geometry.target.x + geometry.px * index * 6, geometry.target.y + geometry.py * index * 6);
    ctx.stroke();
  }
  if (!missed) {
    drawCircle(ctx, actualTarget.x, actualTarget.y, preset.impactRadius, rgba(preset.palette.impact, 0.38));
  }
  ctx.restore();
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
