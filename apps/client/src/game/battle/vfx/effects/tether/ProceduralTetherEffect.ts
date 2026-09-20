import type { BattleMoveVfxPoint, BattleMoveVfxRenderRequest } from "../../battle-move-vfx.types";
import { getTetherEffectPreset, type TetherEffectPreset } from "./tether-effect.presets";

interface TetherRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

interface Geometry {
  readonly dx: number;
  readonly dy: number;
  readonly distance: number;
  readonly ux: number;
  readonly uy: number;
  readonly px: number;
  readonly py: number;
}

const TAU = Math.PI * 2;

export async function playProceduralTetherEffect(runtime: TetherRuntime): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;
  if (request.definition.archetype !== "tether") return;
  const preset = getTetherEffectPreset(request.definition.presetId);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const missed = request.missed ?? false;
  const resolvedTarget = preset.kind === "roots" ? request.source : resolveTarget(request.source, request.target, missed);

  if (reduced) {
    drawReduced(ctx, request.source, resolvedTarget, preset, !missed || preset.kind === "roots");
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
      if (preset.kind === "roots") drawRoots(ctx, request.source, preset, p, now);
      else if (preset.kind === "seed") drawSeedTether(ctx, request.source, resolvedTarget, preset, p, now, missed);
      else drawDrain(ctx, request.source, resolvedTarget, preset, p, now, missed);
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

function drawDrain(ctx: CanvasRenderingContext2D, source: BattleMoveVfxPoint, target: BattleMoveVfxPoint, preset: TetherEffectPreset, p: number, now: number, missed: boolean): void {
  const g = geometry(target, source);
  const connect = easeOutCubic(Math.min(1, p / 0.35));
  const fade = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let strand = 0; strand < preset.strandCount; strand += 1) {
    ctx.strokeStyle = rgba(strand % 2 === 0 ? preset.palette.inner : preset.palette.mid, (0.38 + strand * 0.05) * fade);
    ctx.lineWidth = preset.width * (0.72 + strand * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    const samples = 20;
    for (let i = 0; i <= samples; i += 1) {
      const local = i / samples * connect;
      const along = g.distance * local;
      const wave = Math.sin(local * TAU * 2.2 + now * 0.008 + strand) * (5 + strand * 2);
      const x = target.x + g.ux * along + g.px * wave;
      const y = target.y + g.uy * along + g.py * wave;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (let i = 0; i < preset.particleCount; i += 1) {
    const seed = pseudo(i * 31 + 7);
    const phase = (p * (0.9 + pseudo(i * 17 + 3) * 0.45) + seed) % 1;
    const along = g.distance * phase * connect;
    const side = (pseudo(i * 43 + 4) - 0.5) * 18;
    const x = target.x + g.ux * along + g.px * side;
    const y = target.y + g.uy * along + g.py * side;
    circle(ctx, x, y, 1.5 + pseudo(i * 59 + 6) * 3.5, rgba(preset.palette.particle, Math.sin(phase * Math.PI) * 0.8 * fade));
  }
  if (!missed && p > 0.25) radial(ctx, source, 24 + p * 28, preset.palette.outer, preset.palette.core, 0.36 * fade);
  ctx.restore();
}

function drawSeedTether(ctx: CanvasRenderingContext2D, source: BattleMoveVfxPoint, target: BattleMoveVfxPoint, preset: TetherEffectPreset, p: number, now: number, missed: boolean): void {
  const g = geometry(source, target);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (p < 0.34) {
    const t = easeOutCubic(p / 0.34);
    const x = source.x + g.dx * t;
    const y = source.y + g.dy * t - Math.sin(t * Math.PI) * 42;
    radial(ctx, { x, y }, 12, preset.palette.outer, preset.palette.core, 0.72);
    circle(ctx, x, y, 4.5, rgba(preset.palette.inner, 0.95));
  } else {
    const grow = easeOutCubic(Math.min(1, (p - 0.34) / 0.34));
    const fade = p < 0.82 ? 1 : 1 - (p - 0.82) / 0.18;
    for (let strand = 0; strand < preset.strandCount; strand += 1) {
      const angle = -Math.PI * 0.35 + strand * (Math.PI * 0.7 / Math.max(1, preset.strandCount - 1));
      ctx.strokeStyle = rgba(strand % 2 === 0 ? preset.palette.inner : preset.palette.mid, 0.65 * fade);
      ctx.lineWidth = preset.width;
      ctx.beginPath();
      ctx.moveTo(target.x, target.y + 8);
      ctx.quadraticCurveTo(target.x + Math.cos(angle) * 26, target.y - 18, target.x + Math.cos(angle) * 44 * grow, target.y - 48 * grow + Math.sin(now * 0.004 + strand) * 3);
      ctx.stroke();
    }
    if (!missed) radial(ctx, target, 34 + grow * 22, preset.palette.outer, preset.palette.core, 0.28 * fade);
  }
  ctx.restore();
}

function drawRoots(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: TetherEffectPreset, p: number, now: number): void {
  const grow = easeOutCubic(Math.min(1, p / 0.58));
  const fade = p < 0.82 ? 1 : 1 - (p - 0.82) / 0.18;
  ctx.save();
  for (let i = 0; i < preset.strandCount; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const length = (28 + i * 8) * grow;
    ctx.strokeStyle = rgba(i % 2 === 0 ? preset.palette.mid : preset.palette.inner, 0.72 * fade);
    ctx.lineWidth = preset.width;
    ctx.beginPath();
    ctx.moveTo(center.x + side * 5, center.y + 22);
    ctx.bezierCurveTo(center.x + side * 12, center.y + 34, center.x + side * length * 0.55, center.y + 38 + Math.sin(now * 0.004 + i) * 2, center.x + side * length, center.y + 44 + (i % 3) * 5);
    ctx.stroke();
  }
  for (let i = 0; i < preset.particleCount; i += 1) {
    const a = pseudo(i * 29 + 3) * Math.PI;
    const r = (10 + pseudo(i * 41 + 8) * 56) * grow;
    circle(ctx, center.x + Math.cos(a) * r, center.y + 37 + Math.sin(a) * r * 0.2, 1.5 + pseudo(i * 53 + 5) * 2.5, rgba(preset.palette.particle, 0.32 * fade));
  }
  ctx.restore();
}

function drawReduced(ctx: CanvasRenderingContext2D, source: BattleMoveVfxPoint, target: BattleMoveVfxPoint, preset: TetherEffectPreset, hit: boolean): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (preset.kind === "roots") {
    radial(ctx, source, 44, preset.palette.outer, preset.palette.core, 0.34);
  } else {
    ctx.strokeStyle = rgba(preset.palette.inner, 0.7);
    ctx.lineWidth = preset.width;
    ctx.beginPath();
    ctx.moveTo(target.x, target.y);
    ctx.lineTo(source.x, source.y);
    ctx.stroke();
    if (hit) radial(ctx, source, 34, preset.palette.outer, preset.palette.core, 0.36);
  }
  ctx.restore();
}

function resolveTarget(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint, missed: boolean): BattleMoveVfxPoint {
  if (!missed) return target;
  const g = geometry(source, target);
  return { x: target.x + g.px * 88 + g.ux * 24, y: target.y + g.py * 88 + g.uy * 24 };
}
function geometry(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint): Geometry { const dx = target.x - source.x; const dy = target.y - source.y; const distance = Math.max(1, Math.hypot(dx, dy)); return { dx, dy, distance, ux: dx / distance, uy: dy / distance, px: -dy / distance, py: dx / distance }; }
function radial(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, radius: number, outer: string, core: string, alpha: number): void { const g = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(1, radius)); g.addColorStop(0, rgba(core, alpha)); g.addColorStop(1, rgba(outer, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, TAU); ctx.fill(); }
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string): void { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill(); }
function rgba(rgb: string, alpha: number): string { return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`; }
function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function easeOutCubic(v: number): number { const t = 1 - clamp01(v); return 1 - t * t * t; }
function pseudo(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
