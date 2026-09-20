import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import {
  getWaveEffectPreset,
  type WaveEffectPreset,
} from "./wave-effect.presets";

interface WaveRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

interface WaveGeometry {
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

export async function playProceduralWaveEffect(runtime: WaveRuntime): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;
  if (request.definition.archetype !== "wave") return;

  const preset = getWaveEffectPreset(request.definition.presetId);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const missed = request.missed ?? false;
  const resolvedTarget = resolveWaveTarget(request.source, request.target, missed);
  const geometry = getGeometry(request.source, resolvedTarget);

  if (reduced) {
    drawReduced(ctx, geometry, preset, !missed);
    await delay(140);
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const durationMs = request.definition.durationMs;
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

      if (p < preset.chargeEnd) {
        drawCharge(ctx, geometry.source, preset, p / preset.chargeEnd, now);
      } else if (p < preset.travelEnd) {
        const travel = easeInOutCubic((p - preset.chargeEnd) / Math.max(0.001, preset.travelEnd - preset.chargeEnd));
        drawWaveTravel(ctx, geometry, preset, travel, now);
      } else {
        const sustain = clamp01((p - preset.travelEnd) / Math.max(0.001, preset.sustainEnd - preset.travelEnd));
        drawWaveTravel(ctx, geometry, preset, 1, now, 1 - sustain * 0.2);
        if (!missed) drawImpact(ctx, request.target, geometry, preset, sustain, now);
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

function drawCharge(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  preset: WaveEffectPreset,
  progress: number,
  now: number,
): void {
  const e = easeOutCubic(progress);
  const pulse = 0.86 + Math.sin(now * 0.024) * 0.14;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  radial(ctx, source, 13 + 24 * e * pulse, preset.palette.outer, preset.palette.core, 0.42 * e);
  for (let i = 0; i < 7; i += 1) {
    const a = now * 0.004 + (i / 7) * TAU;
    const r = 14 + 18 * e;
    circle(ctx, source.x + Math.cos(a) * r, source.y + Math.sin(a) * r, 1.5 + (i % 3), rgba(preset.palette.particle, 0.65 * e));
  }
  ctx.restore();
}

function drawWaveTravel(
  ctx: CanvasRenderingContext2D,
  geometry: WaveGeometry,
  preset: WaveEffectPreset,
  progress: number,
  now: number,
  opacity = 1,
): void {
  const t = clamp01(progress);
  const headX = geometry.source.x + geometry.dx * t;
  const headY = geometry.source.y + geometry.dy * t;
  const length = geometry.distance * t;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  if (preset.kind === "sound") {
    drawSoundBands(ctx, geometry, preset, t, now, opacity);
  } else {
    drawFlowBand(ctx, geometry, preset, headX, headY, length, now, opacity);
  }

  drawParticles(ctx, geometry, preset, t, now, opacity);
  ctx.restore();
}

function drawFlowBand(
  ctx: CanvasRenderingContext2D,
  geometry: WaveGeometry,
  preset: WaveEffectPreset,
  headX: number,
  headY: number,
  length: number,
  now: number,
  opacity: number,
): void {
  const samples = Math.max(8, Math.round(length / 24));
  for (let band = 0; band < preset.bandCount; band += 1) {
    const offset = (band - (preset.bandCount - 1) / 2) * (preset.bandWidth / Math.max(1, preset.bandCount - 1)) * 0.42;
    ctx.strokeStyle = rgba(band % 2 === 0 ? preset.palette.inner : preset.palette.mid, (0.28 + band * 0.055) * opacity);
    ctx.lineWidth = Math.max(2, preset.bandWidth / (preset.bandCount + 1));
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= samples; i += 1) {
      const local = i / samples;
      const distanceAlong = length * local;
      const wave = Math.sin(distanceAlong / preset.wavelength * TAU + now * 0.008 + band) * preset.amplitude;
      const x = geometry.source.x + geometry.ux * distanceAlong + geometry.px * (offset + wave);
      const y = geometry.source.y + geometry.uy * distanceAlong + geometry.py * (offset + wave);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const frontGradient = ctx.createRadialGradient(headX, headY, 0, headX, headY, preset.frontHeight * 0.75);
  frontGradient.addColorStop(0, rgba(preset.palette.core, 0.76 * opacity));
  frontGradient.addColorStop(0.45, rgba(preset.palette.inner, 0.42 * opacity));
  frontGradient.addColorStop(1, rgba(preset.palette.outer, 0));
  ctx.fillStyle = frontGradient;
  ctx.beginPath();
  ctx.ellipse(headX, headY, preset.bandWidth * 0.48, preset.frontHeight * 0.5, Math.atan2(geometry.dy, geometry.dx), 0, TAU);
  ctx.fill();
}

function drawSoundBands(
  ctx: CanvasRenderingContext2D,
  geometry: WaveGeometry,
  preset: WaveEffectPreset,
  progress: number,
  now: number,
  opacity: number,
): void {
  const maxDistance = geometry.distance * progress;
  for (let band = 0; band < preset.bandCount; band += 1) {
    const local = clamp01(progress - band * 0.065);
    const distance = geometry.distance * local;
    if (distance <= 1 || distance > maxDistance + 1) continue;
    const cx = geometry.source.x + geometry.ux * distance;
    const cy = geometry.source.y + geometry.uy * distance;
    const radius = 12 + band * 7 + Math.sin(now * 0.012 + band) * 2;
    ctx.strokeStyle = rgba(band % 2 === 0 ? preset.palette.inner : preset.palette.mid, (0.6 - band * 0.055) * opacity);
    ctx.lineWidth = Math.max(1.5, 4 - band * 0.35);
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 0.55, radius, Math.atan2(geometry.dy, geometry.dx), 0, TAU);
    ctx.stroke();
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  geometry: WaveGeometry,
  preset: WaveEffectPreset,
  progress: number,
  now: number,
  opacity: number,
): void {
  for (let i = 0; i < preset.particleCount; i += 1) {
    const seed = pseudo(i * 47 + 3);
    const along = (seed * 0.9 + ((now * 0.00008 * (0.6 + pseudo(i * 13 + 4))) % 0.1)) * progress;
    const side = (pseudo(i * 23 + 7) - 0.5) * preset.frontHeight * 0.9;
    const x = geometry.source.x + geometry.dx * along + geometry.px * side;
    const y = geometry.source.y + geometry.dy * along + geometry.py * side;
    const alpha = (0.25 + pseudo(i * 31 + 9) * 0.55) * opacity;
    drawParticle(ctx, x, y, preset, i, now, alpha);
  }
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  preset: WaveEffectPreset,
  index: number,
  now: number,
  alpha: number,
): void {
  ctx.strokeStyle = rgba(preset.palette.particle, alpha);
  ctx.fillStyle = rgba(preset.palette.particle, alpha);
  ctx.lineWidth = 1.5;
  const size = 2 + pseudo(index * 61 + 5) * 4;

  if (preset.particleKind === "flake") {
    for (let arm = 0; arm < 3; arm += 1) {
      const a = arm * Math.PI / 3 + now * 0.001;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * size, y - Math.sin(a) * size);
      ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
      ctx.stroke();
    }
    return;
  }

  if (preset.particleKind === "air" || preset.particleKind === "note" || preset.particleKind === "buzz") {
    ctx.beginPath();
    ctx.arc(x, y, size * (preset.particleKind === "buzz" ? 0.55 : 1), 0, TAU);
    ctx.stroke();
    if (preset.particleKind === "note") {
      ctx.beginPath();
      ctx.moveTo(x + size * 0.6, y);
      ctx.lineTo(x + size * 0.6, y - size * 2.1);
      ctx.stroke();
    }
    return;
  }

  circle(ctx, x, y, size, rgba(preset.palette.particle, alpha));
}

function drawImpact(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  geometry: WaveGeometry,
  preset: WaveEffectPreset,
  progress: number,
  now: number,
): void {
  const e = easeOutCubic(progress);
  const fade = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  radial(ctx, target, preset.impactRadius * (0.45 + e * 0.85), preset.palette.outer, preset.palette.core, 0.52 * fade);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * TAU + now * 0.001;
    ctx.strokeStyle = rgba(preset.palette.particle, 0.52 * fade);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(target.x + Math.cos(a) * 8, target.y + Math.sin(a) * 8);
    ctx.lineTo(target.x + Math.cos(a) * preset.impactRadius * (0.55 + e * 0.5), target.y + Math.sin(a) * preset.impactRadius * (0.55 + e * 0.5));
    ctx.stroke();
  }
  if (preset.kind === "water") {
    ctx.strokeStyle = rgba(preset.palette.inner, 0.65 * fade);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(target.x, target.y + 18, 22 + 42 * e, 8 + 10 * e, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  void geometry;
}

function drawReduced(ctx: CanvasRenderingContext2D, geometry: WaveGeometry, preset: WaveEffectPreset, hit: boolean): void {
  ctx.save();
  ctx.strokeStyle = rgba(preset.palette.inner, 0.68);
  ctx.lineWidth = Math.max(3, preset.bandWidth * 0.12);
  ctx.beginPath();
  ctx.moveTo(geometry.source.x, geometry.source.y);
  ctx.lineTo(geometry.target.x, geometry.target.y);
  ctx.stroke();
  if (hit) radial(ctx, geometry.target, preset.impactRadius * 0.6, preset.palette.outer, preset.palette.core, 0.45);
  ctx.restore();
}

function resolveWaveTarget(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint, missed: boolean): BattleMoveVfxPoint {
  if (!missed) return target;
  const g = getGeometry(source, target);
  const side = source.x <= target.x ? -1 : 1;
  const offset = Math.min(120, Math.max(68, g.distance * 0.2));
  return { x: target.x + g.px * offset * side + g.ux * 34, y: target.y + g.py * offset * side + g.uy * 34 };
}

function getGeometry(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint): WaveGeometry {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  return { source, target, dx, dy, distance, ux: dx / distance, uy: dy / distance, px: -dy / distance, py: dx / distance };
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
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string): void { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill(); }
function rgba(rgb: string, alpha: number): string { return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`; }
function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function easeOutCubic(v: number): number { const t = 1 - clamp01(v); return 1 - t * t * t; }
function easeInOutCubic(v: number): number { const t = clamp01(v); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function pseudo(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
