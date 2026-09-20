import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import {
  getContactEffectPreset,
  type ContactEffectPreset,
} from "./contact-effect.presets";

interface ProceduralContactEffectInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

interface ContactVector {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly nx: number;
  readonly ny: number;
  readonly px: number;
  readonly py: number;
}

const TAU = Math.PI * 2;

export async function playProceduralContactEffect(
  input: ProceduralContactEffectInput,
): Promise<void> {
  const { ctx, width, height, request, isCancelled } = input;

  if (request.definition.archetype !== "contact") {
    return;
  }

  const preset = getContactEffectPreset(request.definition.presetId);
  const actualTarget = resolveContactTarget(request.source, request.target, request.missed);
  const vector = getVector(request.source, actualTarget);

  if (vector.length <= 1) {
    return;
  }

  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  if (prefersReducedMotion) {
    drawReducedContact(ctx, request.source, actualTarget, vector, preset, request.missed);
    await delay(Math.min(180, request.definition.durationMs));
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const actorMotion = request.actorMotion?.playContactMotion({
    target: actualTarget,
    durationMs: request.definition.durationMs,
    windupEnd: preset.windupEnd,
    dashEnd: preset.dashEnd,
    impactHoldEnd: preset.impactHoldEnd,
    travelRatio: preset.travelRatio,
    windupDistance: preset.windupDistance,
    arcHeight: preset.arcHeight,
    style: preset.style,
  }) ?? Promise.resolve();

  const canvasMotion = animateCanvas({
    ctx,
    width,
    height,
    source: request.source,
    target: actualTarget,
    missed: Boolean(request.missed),
    durationMs: request.definition.durationMs,
    preset,
    vector,
    isCancelled,
  });

  await Promise.all([actorMotion, canvasMotion]);
}

function animateCanvas(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly source: BattleMoveVfxPoint;
  readonly target: BattleMoveVfxPoint;
  readonly missed: boolean;
  readonly durationMs: number;
  readonly preset: ContactEffectPreset;
  readonly vector: ContactVector;
  readonly isCancelled: () => boolean;
}): Promise<void> {
  const {
    ctx,
    width,
    height,
    source,
    target,
    missed,
    durationMs,
    preset,
    vector,
    isCancelled,
  } = input;
  const startedAt = performance.now();

  return new Promise<void>((resolve) => {
    const tick = (now: number): void => {
      if (isCancelled()) {
        ctx.clearRect(0, 0, width, height);
        resolve();
        return;
      }

      const progress = clamp01((now - startedAt) / durationMs);
      ctx.clearRect(0, 0, width, height);

      if (progress <= preset.windupEnd) {
        const local = clamp01(progress / Math.max(0.001, preset.windupEnd));
        drawWindup(ctx, source, vector, preset, local);
      } else if (progress <= preset.dashEnd) {
        const local = clamp01(
          (progress - preset.windupEnd) /
            Math.max(0.001, preset.dashEnd - preset.windupEnd),
        );
        const dashProgress = easeInCubic(local);
        drawSpeedLines(ctx, source, target, vector, preset, dashProgress);
        drawMotionArc(ctx, source, target, vector, preset, dashProgress);
      } else if (progress <= preset.impactHoldEnd) {
        const local = clamp01(
          (progress - preset.dashEnd) /
            Math.max(0.001, preset.impactHoldEnd - preset.dashEnd),
        );
        drawSpeedLines(ctx, source, target, vector, preset, 1);
        if (!missed) {
          drawImpact(ctx, target, preset, local);
        } else {
          drawMissWake(ctx, target, vector, preset, local);
        }
      } else {
        const local = clamp01(
          (progress - preset.impactHoldEnd) /
            Math.max(0.001, 1 - preset.impactHoldEnd),
        );
        if (!missed) {
          drawImpact(ctx, target, preset, 1 - local);
        }
        drawReturnDust(ctx, source, vector, preset, 1 - local);
      }

      if (progress >= 1) {
        ctx.clearRect(0, 0, width, height);
        resolve();
        return;
      }

      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  });
}

function drawWindup(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  vector: ContactVector,
  preset: ContactEffectPreset,
  progress: number,
): void {
  const radius = 14 + 10 * progress;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(preset.palette.charge, 0.22 + 0.38 * progress);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(source.x, source.y, radius, -Math.PI * 0.7, Math.PI * 0.7);
  ctx.stroke();

  for (let index = 0; index < 4; index += 1) {
    const offset = (index - 1.5) * 10;
    const x = source.x - vector.nx * (18 + index * 7) + vector.px * offset;
    const y = source.y - vector.ny * (18 + index * 7) + vector.py * offset;
    ctx.strokeStyle = rgba(preset.palette.speedLine, 0.2 + progress * 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - vector.nx * (14 + progress * 18), y - vector.ny * (14 + progress * 18));
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  vector: ContactVector,
  preset: ContactEffectPreset,
  progress: number,
): void {
  const front = lerpPoint(source, target, Math.min(1, preset.travelRatio * progress));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let index = 0; index < preset.speedLineCount; index += 1) {
    const hash = pseudoRandom(index * 17 + 3);
    const hash2 = pseudoRandom(index * 31 + 11);
    const along = Math.max(0, progress - hash * 0.42);
    const center = lerpPoint(source, front, along);
    const side = (hash2 - 0.5) * (32 + preset.impactRadius * 0.55);
    const length = preset.speedLineLength * (0.55 + hash * 0.7) * Math.max(0.25, progress);
    const alpha = 0.12 + (1 - hash) * 0.42;
    const sx = center.x + vector.px * side;
    const sy = center.y + vector.py * side;

    ctx.strokeStyle = rgba(preset.palette.speedLine, alpha);
    ctx.lineWidth = 1 + (1 - hash) * 2.3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - vector.nx * length, sy - vector.ny * length);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMotionArc(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  vector: ContactVector,
  preset: ContactEffectPreset,
  progress: number,
): void {
  if (preset.style !== "slam") {
    return;
  }

  const point = lerpPoint(source, target, preset.travelRatio * progress);
  const lift = Math.sin(progress * Math.PI) * preset.arcHeight;
  ctx.save();
  ctx.strokeStyle = rgba(preset.palette.charge, 0.18 + progress * 0.2);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(
    point.x - vector.px * lift,
    point.y - vector.py * lift - lift * 0.45,
    18 + progress * 8,
    Math.PI * 0.15,
    Math.PI * 1.55,
  );
  ctx.stroke();
  ctx.restore();
}

function drawImpact(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  preset: ContactEffectPreset,
  progress: number,
): void {
  const appear = clamp01(progress / 0.28);
  const fade = clamp01(1 - Math.max(0, progress - 0.35) / 0.65);
  const alpha = appear * fade;
  const radius = preset.impactRadius * (0.45 + progress * 0.75);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const gradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, radius);
  gradient.addColorStop(0, rgba(preset.palette.core, 0.92 * alpha));
  gradient.addColorStop(0.32, rgba(preset.palette.impact, 0.62 * alpha));
  gradient.addColorStop(1, rgba(preset.palette.impact, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = rgba(preset.palette.impact, 0.72 * alpha);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius * 0.72, 0, TAU);
  ctx.stroke();

  for (let index = 0; index < preset.impactRayCount; index += 1) {
    const angle = (index / preset.impactRayCount) * TAU + pseudoRandom(index + 71) * 0.22;
    const inner = radius * (0.42 + pseudoRandom(index + 13) * 0.18);
    const outer = radius * (0.95 + pseudoRandom(index + 41) * 0.55);
    ctx.strokeStyle = rgba(preset.palette.core, (0.28 + pseudoRandom(index) * 0.45) * alpha);
    ctx.lineWidth = 1 + pseudoRandom(index + 5) * 2.4;
    ctx.beginPath();
    ctx.moveTo(target.x + Math.cos(angle) * inner, target.y + Math.sin(angle) * inner);
    ctx.lineTo(target.x + Math.cos(angle) * outer, target.y + Math.sin(angle) * outer);
    ctx.stroke();
  }

  drawDust(ctx, target, preset, alpha, radius);
  ctx.restore();
}

function drawMissWake(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  vector: ContactVector,
  preset: ContactEffectPreset,
  progress: number,
): void {
  ctx.save();
  ctx.strokeStyle = rgba(preset.palette.speedLine, 0.35 * (1 - progress));
  ctx.lineWidth = 2;
  for (let index = 0; index < 5; index += 1) {
    const side = (index - 2) * 9;
    ctx.beginPath();
    ctx.moveTo(target.x + vector.px * side, target.y + vector.py * side);
    ctx.lineTo(
      target.x + vector.nx * (24 + index * 5) + vector.px * side,
      target.y + vector.ny * (24 + index * 5) + vector.py * side,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawReturnDust(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  vector: ContactVector,
  preset: ContactEffectPreset,
  alpha: number,
): void {
  if (preset.style !== "reckless" && preset.style !== "slam") {
    return;
  }

  ctx.save();
  ctx.fillStyle = rgba(preset.palette.dust, 0.18 * alpha);
  for (let index = 0; index < 4; index += 1) {
    const size = 5 + index * 2;
    ctx.beginPath();
    ctx.arc(
      source.x - vector.nx * (12 + index * 9) + vector.px * (index - 1.5) * 7,
      source.y - vector.ny * (12 + index * 9) + vector.py * (index - 1.5) * 7 + 12,
      size,
      0,
      TAU,
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawDust(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  preset: ContactEffectPreset,
  alpha: number,
  radius: number,
): void {
  if (preset.style !== "slam" && preset.style !== "reckless") {
    return;
  }

  ctx.fillStyle = rgba(preset.palette.dust, 0.28 * alpha);
  for (let index = 0; index < 7; index += 1) {
    const angle = Math.PI * (1.05 + (index / 6) * 0.9);
    const distance = radius * (0.38 + pseudoRandom(index + 93) * 0.45);
    ctx.beginPath();
    ctx.arc(
      target.x + Math.cos(angle) * distance,
      target.y + Math.sin(angle) * distance,
      3 + pseudoRandom(index + 20) * 6,
      0,
      TAU,
    );
    ctx.fill();
  }
}

function drawReducedContact(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  vector: ContactVector,
  preset: ContactEffectPreset,
  missed?: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = rgba(preset.palette.speedLine, 0.55);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(target.x - vector.nx * 16, target.y - vector.ny * 16);
  ctx.stroke();

  if (!missed) {
    ctx.fillStyle = rgba(preset.palette.impact, 0.5);
    ctx.beginPath();
    ctx.arc(target.x, target.y, Math.min(24, preset.impactRadius * 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function resolveContactTarget(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  missed?: boolean,
): BattleMoveVfxPoint {
  if (!missed) {
    return target;
  }

  const vector = getVector(source, target);
  const missSide = pseudoRandom(Math.round(source.x + source.y + target.x)) >= 0.5 ? 1 : -1;
  const perpendicularOffset = Math.min(96, Math.max(58, vector.length * 0.16)) * missSide;

  return {
    x: target.x + vector.nx * Math.min(80, vector.length * 0.12) + vector.px * perpendicularOffset,
    y: target.y + vector.ny * Math.min(80, vector.length * 0.12) + vector.py * perpendicularOffset,
  };
}

function getVector(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint): ContactVector {
  const x = target.x - source.x;
  const y = target.y - source.y;
  const length = Math.hypot(x, y);
  const nx = length > 0 ? x / length : 1;
  const ny = length > 0 ? y / length : 0;

  return {
    x,
    y,
    length,
    nx,
    ny,
    px: -ny,
    py: nx,
  };
}

function lerpPoint(
  start: BattleMoveVfxPoint,
  end: BattleMoveVfxPoint,
  progress: number,
): BattleMoveVfxPoint {
  const t = clamp01(progress);
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function easeInCubic(value: number): number {
  return value * value * value;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`;
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}
