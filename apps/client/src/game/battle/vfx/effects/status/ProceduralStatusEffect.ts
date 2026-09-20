import type { BattleMoveVfxPoint, BattleMoveVfxRenderRequest } from "../../battle-move-vfx.types";
import { getStatusEffectPreset, type StatusEffectPreset } from "./status-effect.presets";

interface StatusRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

const TAU = Math.PI * 2;

export async function playProceduralStatusEffect(runtime: StatusRuntime): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;
  if (request.definition.archetype !== "status") return;
  const preset = getStatusEffectPreset(request.definition.presetId);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const center = resolveStatusCenter(request.source, request.target, request.missed ?? false);

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
      drawStatus(ctx, center, preset, p, now);
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

function drawStatus(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: StatusEffectPreset, p: number, now: number): void {
  const fade = p < 0.78 ? 1 : 1 - (p - 0.78) / 0.22;
  const enter = easeOutCubic(Math.min(1, p / 0.24));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  radial(ctx, center, preset.radius * (0.45 + enter * 0.6), preset.palette.outer, preset.palette.core, 0.2 * fade);

  if (preset.kind === "powder") drawPowder(ctx, center, preset, p, now, fade);
  else if (preset.kind === "hypnosis") drawHypnosis(ctx, center, preset, p, now, fade);
  else if (preset.kind === "confusion") drawConfusion(ctx, center, preset, p, now, fade);
  else if (preset.kind === "song") drawSong(ctx, center, preset, p, now, fade);
  else drawDebuff(ctx, center, preset, p, now, fade);
  ctx.restore();
}

function drawPowder(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: StatusEffectPreset, p: number, now: number, fade: number): void {
  for (let i = 0; i < preset.particleCount; i += 1) {
    const seed = pseudo(i * 43 + 5);
    const phase = (p * (0.7 + pseudo(i * 17 + 2) * 0.7) + seed) % 1;
    const angle = seed * TAU + now * 0.0008;
    const radius = (16 + pseudo(i * 29 + 8) * preset.radius) * Math.sin(Math.min(1, phase) * Math.PI * 0.78 + 0.2);
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + 26 - phase * 88 + Math.sin(angle) * 7;
    const alpha = Math.sin(phase * Math.PI) * (0.3 + pseudo(i * 61 + 4) * 0.55) * fade;
    circle(ctx, x, y, 1.5 + pseudo(i * 37 + 9) * 4, rgba(preset.palette.particle, alpha));
  }
}

function drawHypnosis(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: StatusEffectPreset, p: number, now: number, fade: number): void {
  for (let ring = 0; ring < 5; ring += 1) {
    const rp = (p * 1.25 + ring * 0.14) % 1;
    const r = 9 + rp * preset.radius;
    ctx.strokeStyle = rgba(ring % 2 === 0 ? preset.palette.inner : preset.palette.mid, (0.72 * (1 - rp)) * fade);
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, now * 0.001 + ring * 0.4, now * 0.001 + ring * 0.4 + Math.PI * 1.55);
    ctx.stroke();
  }
}

function drawConfusion(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: StatusEffectPreset, p: number, now: number, fade: number): void {
  for (let i = 0; i < preset.particleCount; i += 1) {
    const a = now * 0.0035 + i * TAU / preset.particleCount;
    const r = 26 + (i % 3) * 11 + Math.sin(p * Math.PI) * 10;
    const x = center.x + Math.cos(a) * r;
    const y = center.y - 20 + Math.sin(a) * r * 0.32;
    drawStar(ctx, x, y, 3 + (i % 3), rgba(preset.palette.particle, (0.45 + (i % 2) * 0.2) * fade));
  }
}

function drawSong(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: StatusEffectPreset, p: number, now: number, fade: number): void {
  for (let i = 0; i < 6; i += 1) {
    const phase = (p * 1.3 + i * 0.16) % 1;
    const x = center.x - 28 + phase * 62 + Math.sin(now * 0.004 + i) * 5;
    const y = center.y + 26 - phase * 88 - i * 2;
    ctx.strokeStyle = rgba(preset.palette.particle, Math.sin(phase * Math.PI) * 0.75 * fade);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 4, y - 18);
    ctx.lineTo(x + 12, y - 14);
    ctx.stroke();
  }
}

function drawDebuff(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: StatusEffectPreset, p: number, now: number, fade: number): void {
  const e = easeOutCubic(Math.min(1, p * 1.5));
  for (let i = 0; i < 3; i += 1) {
    const x = center.x + (i - 1) * 20;
    const y = center.y - 22 + Math.sin(now * 0.006 + i) * 3;
    ctx.strokeStyle = rgba(i === 1 ? preset.palette.core : preset.palette.inner, 0.72 * fade);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 18 * e);
    ctx.lineTo(x, y + 18 * e);
    ctx.moveTo(x - 6, y + 10 * e);
    ctx.lineTo(x, y + 18 * e);
    ctx.lineTo(x + 6, y + 10 * e);
    ctx.stroke();
  }
}

function drawReduced(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: StatusEffectPreset): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  radial(ctx, center, preset.radius * 0.72, preset.palette.outer, preset.palette.core, 0.34);
  ctx.strokeStyle = rgba(preset.palette.inner, 0.72);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center.x, center.y, preset.radius * 0.48, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function resolveStatusCenter(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint, missed: boolean): BattleMoveVfxPoint {
  if (!missed) return target;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  return { x: target.x - dy / d * 90 + dx / d * 22, y: target.y + dx / d * 90 + dy / d * 22 };
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
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string): void { ctx.fillStyle = fill; ctx.beginPath(); for (let i = 0; i < 10; i += 1) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 === 0 ? radius : radius * 0.45; const px = x + Math.cos(a) * r; const py = y + Math.sin(a) * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.fill(); }
function rgba(rgb: string, alpha: number): string { return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`; }
function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function easeOutCubic(v: number): number { const t = 1 - clamp01(v); return 1 - t * t * t; }
function pseudo(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
