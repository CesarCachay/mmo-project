import type { BattleMoveVfxPoint, BattleMoveVfxRenderRequest } from "../../battle-move-vfx.types";
import { getSupportEffectPreset, type SupportEffectPreset } from "./support-effect.presets";

interface SupportRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

const TAU = Math.PI * 2;

export async function playProceduralSupportEffect(runtime: SupportRuntime): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;
  if (request.definition.archetype !== "support") return;
  const preset = getSupportEffectPreset(request.definition.presetId);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  if (reduced) {
    drawReduced(ctx, request.source, preset);
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
      drawSupport(ctx, request.source, preset, p, now);
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

function drawSupport(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: SupportEffectPreset, p: number, now: number): void {
  const enter = easeOutCubic(Math.min(1, p / 0.22));
  const fade = p < 0.78 ? 1 : 1 - (p - 0.78) / 0.22;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  radial(ctx, center, preset.radius * (0.55 + enter * 0.5), preset.palette.outer, preset.palette.core, 0.32 * fade);

  for (let ring = 0; ring < preset.ringCount; ring += 1) {
    const rp = (p * 1.45 + ring * 0.19) % 1;
    const r = 12 + rp * preset.radius;
    ctx.strokeStyle = rgba(ring % 2 === 0 ? preset.palette.inner : preset.palette.mid, (0.58 * (1 - rp)) * fade);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 10, r, r * 0.34, 0, 0, TAU);
    ctx.stroke();
  }

  drawKindGlyph(ctx, center, preset, p, now, fade);

  for (let i = 0; i < preset.particleCount; i += 1) {
    const seed = pseudo(i * 41 + 3);
    const phase = (p * (0.85 + pseudo(i * 17 + 7) * 0.45) + seed) % 1;
    const angle = seed * TAU + Math.sin(now * 0.0015 + i) * 0.25;
    const radius = 12 + pseudo(i * 29 + 5) * preset.radius * 0.8;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + 28 - phase * preset.rise + Math.sin(angle) * 5;
    const alpha = Math.sin(phase * Math.PI) * (0.35 + pseudo(i * 53 + 9) * 0.55) * fade;
    circle(ctx, x, y, 1.5 + pseudo(i * 61 + 4) * 3.5, rgba(preset.palette.particle, alpha));
  }
  ctx.restore();
}

function drawKindGlyph(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: SupportEffectPreset, p: number, now: number, fade: number): void {
  const pulse = 0.9 + Math.sin(now * 0.018) * 0.1;
  ctx.strokeStyle = rgba(preset.palette.core, 0.75 * fade);
  ctx.fillStyle = rgba(preset.palette.inner, 0.54 * fade);
  ctx.lineWidth = 2.5;

  if (preset.kind === "heal") {
    const s = 16 * pulse;
    ctx.fillRect(center.x - s * 0.28, center.y - s, s * 0.56, s * 2);
    ctx.fillRect(center.x - s, center.y - s * 0.28, s * 2, s * 0.56);
    return;
  }
  if (preset.kind === "speed") {
    for (let i = 0; i < 4; i += 1) {
      const y = center.y - 22 + i * 14;
      ctx.beginPath();
      ctx.moveTo(center.x - 38 - i * 4, y);
      ctx.lineTo(center.x + 24 + i * 5, y - 5);
      ctx.stroke();
    }
    return;
  }
  if (preset.kind === "evasion") {
    for (let i = 0; i < 3; i += 1) {
      const offset = (i - 1) * 26;
      ctx.strokeStyle = rgba(preset.palette.inner, (0.48 - Math.abs(i - 1) * 0.1) * fade);
      ctx.beginPath();
      ctx.ellipse(center.x + offset + Math.sin(now * 0.006 + i) * 5, center.y, 13, 28, 0, 0, TAU);
      ctx.stroke();
    }
    return;
  }
  if (preset.kind === "cleanse") {
    for (let i = 0; i < 6; i += 1) {
      const a = now * 0.003 + i * TAU / 6;
      const r = 18 + p * 30;
      circle(ctx, center.x + Math.cos(a) * r, center.y + Math.sin(a) * r, 3.5, rgba(preset.palette.core, 0.72 * fade));
    }
    return;
  }
  if (preset.kind === "rest") {
    for (let i = 0; i < 3; i += 1) {
      const x = center.x + 10 + i * 14;
      const y = center.y - 26 - i * 12 - Math.sin(now * 0.004 + i) * 4;
      ctx.strokeRect(x, y, 7 + i * 2, 7 + i * 2);
    }
    return;
  }

  const arrowCount = preset.kind === "buff" ? 3 : 2;
  for (let i = 0; i < arrowCount; i += 1) {
    const x = center.x + (i - (arrowCount - 1) / 2) * 18;
    const y = center.y + 18 - Math.sin(now * 0.008 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 20);
    ctx.lineTo(x, y - 16);
    ctx.moveTo(x - 6, y - 8);
    ctx.lineTo(x, y - 16);
    ctx.lineTo(x + 6, y - 8);
    ctx.stroke();
  }
}

function drawReduced(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: SupportEffectPreset): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  radial(ctx, center, preset.radius * 0.72, preset.palette.outer, preset.palette.core, 0.38);
  ctx.strokeStyle = rgba(preset.palette.inner, 0.75);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + 10, preset.radius * 0.6, preset.radius * 0.22, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
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
function pseudo(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
