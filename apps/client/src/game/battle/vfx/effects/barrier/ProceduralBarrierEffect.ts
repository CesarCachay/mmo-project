import type { BattleMoveVfxPoint, BattleMoveVfxRenderRequest } from "../../battle-move-vfx.types";
import { getBarrierEffectPreset, type BarrierEffectPreset } from "./barrier-effect.presets";

interface BarrierRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

const TAU = Math.PI * 2;

export async function playProceduralBarrierEffect(runtime: BarrierRuntime): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;
  if (request.definition.archetype !== "barrier") return;
  const preset = getBarrierEffectPreset(request.definition.presetId);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const center = request.source;

  if (reduced) {
    drawBarrier(ctx, center, preset, 0.65, performance.now(), 1);
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
      const enter = easeOutBack(Math.min(1, p / 0.28));
      const fade = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
      ctx.clearRect(0, 0, width, height);
      drawBarrier(ctx, center, preset, enter, now, fade);
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

function drawBarrier(ctx: CanvasRenderingContext2D, center: BattleMoveVfxPoint, preset: BarrierEffectPreset, enter: number, now: number, fade: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const panelSpacing = preset.width * 0.34;
  for (let i = 0; i < preset.panelCount; i += 1) {
    const offset = (i - (preset.panelCount - 1) / 2) * panelSpacing;
    const x = center.x + offset * enter;
    const y = center.y - preset.height * 0.16;
    const w = preset.width * (0.58 + (i % 2) * 0.08) * enter;
    const h = preset.height * enter;
    const alpha = (0.24 + (i % 2) * 0.06) * fade;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(preset.tilt + Math.sin(now * 0.0014 + i) * 0.018);
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, rgba(preset.palette.outer, 0));
    g.addColorStop(0.45, rgba(preset.palette.inner, alpha));
    g.addColorStop(0.58, rgba(preset.palette.core, alpha * 1.55));
    g.addColorStop(1, rgba(preset.palette.outer, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = rgba(preset.palette.mid, 0.68 * fade);
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  for (let ring = 0; ring < 2; ring += 1) {
    const rp = ((now * 0.00045) + ring * 0.5) % 1;
    ctx.strokeStyle = rgba(preset.palette.inner, (0.5 * (1 - rp)) * fade);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + preset.height * 0.36, 18 + rp * preset.width * 0.72, 6 + rp * 13, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function rgba(rgb: string, alpha: number): string { return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`; }
function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function easeOutBack(v: number): number { const t = clamp01(v) - 1; const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * t * t * t + c1 * t * t; }
function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
