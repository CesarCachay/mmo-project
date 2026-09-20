import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import { getAoeEffectPreset, type AoeEffectPreset } from "./aoe-effect.presets";

interface AoeRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

const TAU = Math.PI * 2;

export async function playProceduralAoeEffect(runtime: AoeRuntime): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;
  if (request.definition.archetype !== "aoe") return;

  const preset = getAoeEffectPreset(request.definition.presetId);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const missed = request.missed ?? false;
  const center = resolveCenter(request.source, request.target, missed);

  if (reduced) {
    drawReduced(ctx, center, preset);
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
        drawCharge(ctx, center, preset, p / preset.chargeEnd, now);
      } else {
        const action = clamp01((p - preset.chargeEnd) / Math.max(0.001, preset.actionEnd - preset.chargeEnd));
        if (preset.kind === "falling-rocks") drawRockSlide(ctx, center, preset, action, now);
        else if (preset.kind === "vortex") drawTwister(ctx, center, preset, action, now);
        else drawMuddyWater(ctx, center, preset, action, now);
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

function drawCharge(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: AoeEffectPreset, progress: number, now: number): void {
  const e = easeOutCubic(progress);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let ring = 0; ring < 3; ring += 1) {
    const r = 12 + e * (18 + ring * 10);
    ctx.strokeStyle = rgba(preset.palette.inner, (0.5 - ring * 0.1) * e);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r + Math.sin(now * 0.015 + ring) * 2, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRockSlide(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: AoeEffectPreset, progress: number, now: number): void {
  const fade = progress < 0.78 ? 1 : 1 - (progress - 0.78) / 0.22;
  ctx.save();
  for (let i = 0; i < preset.itemCount; i += 1) {
    const delayOffset = i * 0.055;
    const local = clamp01((progress - delayOffset) / Math.max(0.001, 0.72 - delayOffset));
    if (local <= 0) continue;
    const x = center.x + (pseudo(i * 41 + 2) - 0.5) * preset.radius * 1.7;
    const startY = center.y - 140 - pseudo(i * 17 + 6) * 80;
    const endY = center.y + 24 + pseudo(i * 23 + 8) * 16;
    const y = startY + (endY - startY) * easeInCubic(local);
    const size = 6 + pseudo(i * 37 + 4) * 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(now * 0.002 * (i % 2 === 0 ? 1 : -1));
    ctx.fillStyle = rgba(preset.palette.mid, 0.95 * fade);
    ctx.beginPath();
    for (let p = 0; p < 6; p += 1) {
      const a = (p / 6) * TAU;
      const rr = size * (0.7 + pseudo(i * 101 + p * 13) * 0.45);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (local > 0.82) {
      const hit = clamp01((local - 0.82) / 0.18);
      drawImpactRing(ctx, { x, y: endY }, preset, hit, fade * 0.7);
    }
  }
  drawGroundImpacts(ctx, center, preset, progress, fade, now);
  ctx.restore();
}

function drawTwister(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: AoeEffectPreset, progress: number, now: number): void {
  const fade = progress < 0.8 ? 1 : 1 - (progress - 0.8) / 0.2;
  const grow = easeOutCubic(Math.min(1, progress * 1.4));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let ring = 0; ring < preset.ringCount; ring += 1) {
    const y = center.y + 46 - ring * 18 * grow;
    const rx = (18 + ring * 8) * grow;
    const ry = 6 + ring * 2.5;
    ctx.strokeStyle = rgba(ring % 2 === 0 ? preset.palette.inner : preset.palette.mid, (0.62 - ring * 0.055) * fade);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(center.x + Math.sin(now * 0.01 + ring) * 4, y, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }

  for (let i = 0; i < preset.itemCount; i += 1) {
    const seed = pseudo(i * 43 + 5);
    const phase = (now * 0.0018 * (0.8 + pseudo(i * 17 + 2)) + seed) % 1;
    const level = phase * grow;
    const angle = phase * TAU * 2.4 + i;
    const radius = (14 + level * preset.radius * 0.72) * (0.7 + pseudo(i * 29 + 4) * 0.45);
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + 42 - level * 118 + Math.sin(angle) * 5;
    circle(ctx, x, y, 1.5 + pseudo(i * 61 + 7) * 3.2, rgba(preset.palette.particle, (0.35 + seed * 0.5) * fade));
  }
  radial(ctx, center, preset.radius * 0.7 * grow, preset.palette.outer, preset.palette.core, 0.18 * fade);
  ctx.restore();
}

function drawMuddyWater(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: AoeEffectPreset, progress: number, now: number): void {
  const fade = progress < 0.78 ? 1 : 1 - (progress - 0.78) / 0.22;
  const grow = easeOutCubic(Math.min(1, progress * 1.35));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const basin = preset.radius * grow;
  const g = ctx.createRadialGradient(center.x, center.y + 22, 0, center.x, center.y + 22, Math.max(1, basin));
  g.addColorStop(0, rgba(preset.palette.inner, 0.38 * fade));
  g.addColorStop(0.65, rgba(preset.palette.mid, 0.24 * fade));
  g.addColorStop(1, rgba(preset.palette.outer, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + 22, basin, basin * 0.36, 0, 0, TAU);
  ctx.fill();

  for (let ring = 0; ring < preset.ringCount; ring += 1) {
    const rp = clamp01(progress * 1.4 - ring * 0.12);
    ctx.strokeStyle = rgba(preset.palette.inner, (0.55 - ring * 0.1) * fade);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 20, 18 + rp * (48 + ring * 18), 6 + rp * (12 + ring * 4), 0, 0, TAU);
    ctx.stroke();
  }

  for (let i = 0; i < preset.itemCount; i += 1) {
    const a = pseudo(i * 31 + 3) * Math.PI;
    const distance = (18 + pseudo(i * 47 + 9) * preset.radius) * grow;
    const lift = Math.sin(progress * Math.PI) * (18 + pseudo(i * 19 + 2) * 54);
    const x = center.x + Math.cos(a) * distance + Math.sin(now * 0.002 + i) * 2;
    const y = center.y + 18 - Math.sin(a) * distance * 0.25 - lift;
    circle(ctx, x, y, 2 + pseudo(i * 59 + 5) * 5, rgba(preset.palette.particle, (0.36 + pseudo(i * 23 + 7) * 0.42) * fade));
  }
  ctx.restore();
}

function drawGroundImpacts(
  ctx: CanvasRenderingContext2D,
  center: BattleMoveVfxPoint,
  preset: AoeEffectPreset,
  progress: number,
  fade: number,
  now: number,
): void {
  for (let i = 0; i < preset.impactCount; i += 1) {
    const local = clamp01(progress * 1.25 - i * 0.07);
    if (local <= 0) continue;
    const x = center.x + (pseudo(i * 71 + 8) - 0.5) * preset.radius * 1.6;
    const y = center.y + 24 + pseudo(i * 37 + 2) * 10;
    const drift = 12 + local * 28 + Math.sin(now * 0.003 + i) * 2;
    circle(ctx, x - drift * 0.3, y - local * 16, 3 + pseudo(i * 43 + 4) * 6, rgba(preset.palette.particle, 0.18 * fade));
  }
}

function drawImpactRing(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: AoeEffectPreset, progress: number, alpha: number): void {
  ctx.strokeStyle = rgba(preset.palette.inner, alpha * (1 - progress * 0.5));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, 8 + progress * 24, 3 + progress * 8, 0, 0, TAU);
  ctx.stroke();
}

function drawReduced(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: AoeEffectPreset): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  radial(ctx, center, preset.radius * 0.65, preset.palette.outer, preset.palette.core, 0.35);
  ctx.strokeStyle = rgba(preset.palette.inner, 0.65);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + 14, preset.radius * 0.58, preset.radius * 0.2, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function resolveCenter(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint, missed: boolean): BattleMoveVfxPoint {
  if (!missed) return target;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  const px = -dy / d;
  const py = dx / d;
  const side = source.x <= target.x ? -1 : 1;
  return { x: target.x + px * 92 * side + (dx / d) * 28, y: target.y + py * 92 * side + (dy / d) * 28 };
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
function easeInCubic(v: number): number { const t = clamp01(v); return t * t * t; }
function pseudo(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
