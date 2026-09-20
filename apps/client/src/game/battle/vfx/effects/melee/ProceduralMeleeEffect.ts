import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import {
  getMeleeEffectPreset,
  type MeleeEffectPreset,
} from "./melee-effect.presets";

interface ProceduralMeleeEffectInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

interface MeleeVector {
  readonly length: number;
  readonly nx: number;
  readonly ny: number;
  readonly px: number;
  readonly py: number;
}

const TAU = Math.PI * 2;

export async function playProceduralMeleeEffect(
  input: ProceduralMeleeEffectInput,
): Promise<void> {
  const { ctx, width, height, request, isCancelled } = input;

  if (request.definition.archetype !== "melee") {
    return;
  }

  const preset = getMeleeEffectPreset(request.definition.presetId);
  const actualTarget = resolveMeleeTarget(request.source, request.target, request.missed);
  const vector = getVector(request.source, actualTarget);

  if (vector.length <= 1) {
    return;
  }

  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  if (prefersReducedMotion) {
    drawReducedMelee(ctx, request.source, actualTarget, vector, preset, request.missed);
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
    style: "dash",
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
    hitCount: request.hitCount ?? preset.hitCount,
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
  readonly preset: MeleeEffectPreset;
  readonly vector: MeleeVector;
  readonly hitCount: number;
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
    hitCount,
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
        drawApproach(ctx, source, target, vector, preset, easeInCubic(local));
      } else if (progress <= preset.impactHoldEnd) {
        const local = clamp01(
          (progress - preset.dashEnd) /
            Math.max(0.001, preset.impactHoldEnd - preset.dashEnd),
        );
        if (missed) {
          drawMiss(ctx, target, vector, preset, local);
        } else {
          drawFamilyImpact(ctx, target, vector, preset, local, hitCount);
        }
      } else if (!missed) {
        const local = clamp01(
          (progress - preset.impactHoldEnd) /
            Math.max(0.001, 1 - preset.impactHoldEnd),
        );
        drawFamilyImpact(ctx, target, vector, preset, 1 - local, hitCount);
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
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  progress: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const radius = 10 + preset.impactRadius * 0.22 * progress;
  ctx.strokeStyle = rgba(preset.palette.primary, 0.18 + progress * 0.45);
  ctx.lineWidth = 2 + preset.strokeWidth * 0.25;
  ctx.beginPath();
  ctx.arc(source.x, source.y, radius, -Math.PI * 0.85, Math.PI * 0.85);
  ctx.stroke();

  for (let index = 0; index < 4; index += 1) {
    const side = (index - 1.5) * 8;
    const x = source.x - vector.nx * (12 + index * 6) + vector.px * side;
    const y = source.y - vector.ny * (12 + index * 6) + vector.py * side;
    ctx.strokeStyle = rgba(preset.palette.secondary, 0.12 + progress * 0.26);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - vector.nx * (12 + 14 * progress), y - vector.ny * (12 + 14 * progress));
    ctx.stroke();
  }
  ctx.restore();
}

function drawApproach(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  progress: number,
): void {
  const front = lerpPoint(source, target, preset.travelRatio * progress);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  const lineCount = 5 + Math.round(preset.impactRadius / 12);
  for (let index = 0; index < lineCount; index += 1) {
    const r1 = pseudoRandom(index * 17 + 5);
    const r2 = pseudoRandom(index * 31 + 7);
    const point = lerpPoint(source, front, Math.max(0, progress - r1 * 0.35));
    const side = (r2 - 0.5) * (28 + preset.impactRadius * 0.35);
    const length = 20 + preset.impactRadius * (0.25 + r1 * 0.3);
    ctx.strokeStyle = rgba(preset.palette.primary, 0.14 + 0.28 * (1 - r1));
    ctx.lineWidth = 1 + 1.5 * (1 - r2);
    ctx.beginPath();
    ctx.moveTo(point.x + vector.px * side, point.y + vector.py * side);
    ctx.lineTo(
      point.x - vector.nx * length + vector.px * side,
      point.y - vector.ny * length + vector.py * side,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawFamilyImpact(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  progress: number,
  hitCount: number,
): void {
  const alpha = getImpactAlpha(progress);
  if (alpha <= 0) {
    return;
  }

  const pulse = 0.82 + Math.sin(progress * Math.PI) * 0.22;
  const radius = preset.impactRadius * pulse;

  drawImpactGlow(ctx, target, preset, radius, alpha);

  if (preset.family === "slash" || preset.family === "claw") {
    drawSlashMarks(ctx, target, vector, preset, radius, alpha);
  } else if (preset.family === "punch") {
    drawPunchImpact(ctx, target, vector, preset, radius, alpha);
  } else if (preset.family === "kick") {
    drawKickImpact(ctx, target, vector, preset, radius, alpha, progress, hitCount);
  } else {
    drawBiteImpact(ctx, target, vector, preset, radius, alpha, progress);
  }

  drawElementAccent(ctx, target, vector, preset, radius, alpha, progress);
}

function drawImpactGlow(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, radius);
  gradient.addColorStop(0, rgba(preset.palette.core, 0.82 * alpha));
  gradient.addColorStop(0.3, rgba(preset.palette.primary, 0.42 * alpha));
  gradient.addColorStop(1, rgba(preset.palette.secondary, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawSlashMarks(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
): void {
  const count = preset.markCount;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * radius * 0.24;
    const sx = target.x - vector.nx * radius * 0.72 + vector.px * offset;
    const sy = target.y - vector.ny * radius * 0.72 + vector.py * offset;
    const ex = target.x + vector.nx * radius * 0.72 + vector.px * offset;
    const ey = target.y + vector.ny * radius * 0.72 + vector.py * offset;
    const bow = (index % 2 === 0 ? 1 : -1) * radius * 0.32;

    ctx.strokeStyle = rgba(preset.palette.core, 0.92 * alpha);
    ctx.lineWidth = preset.strokeWidth + 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(
      target.x + vector.px * (offset + bow),
      target.y + vector.py * (offset + bow),
      ex,
      ey,
    );
    ctx.stroke();

    ctx.strokeStyle = rgba(preset.palette.primary, 0.86 * alpha);
    ctx.lineWidth = preset.strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPunchImpact(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(preset.palette.primary, 0.78 * alpha);
  ctx.lineWidth = preset.strokeWidth;
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius * 0.55, 0, TAU);
  ctx.stroke();

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * TAU;
    const inner = radius * 0.34;
    const outer = radius * (0.7 + pseudoRandom(index + 20) * 0.42);
    ctx.strokeStyle = rgba(preset.palette.secondary, (0.32 + pseudoRandom(index) * 0.45) * alpha);
    ctx.lineWidth = 1.4 + pseudoRandom(index + 3) * 2.4;
    ctx.beginPath();
    ctx.moveTo(target.x + Math.cos(angle) * inner, target.y + Math.sin(angle) * inner);
    ctx.lineTo(target.x + Math.cos(angle) * outer, target.y + Math.sin(angle) * outer);
    ctx.stroke();
  }

  const backX = target.x - vector.nx * radius * 0.44;
  const backY = target.y - vector.ny * radius * 0.44;
  ctx.fillStyle = rgba(preset.palette.core, 0.54 * alpha);
  ctx.beginPath();
  ctx.arc(backX, backY, radius * 0.22, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawKickImpact(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
  progress: number,
  hitCount: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const resolvedHitCount = Math.max(1, Math.min(10, Math.floor(hitCount)));
  const hitPhase = Math.min(
    resolvedHitCount - 1,
    Math.floor(clamp01(progress) * resolvedHitCount),
  );
  const side = (hitPhase % 2 === 0 ? -1 : 1) * radius * 0.16;
  const centerX = target.x + vector.px * side;
  const centerY = target.y + vector.py * side;
  const baseAngle = Math.atan2(vector.ny, vector.nx);

  ctx.strokeStyle = rgba(preset.palette.core, 0.9 * alpha);
  ctx.lineWidth = preset.strokeWidth + 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.72, baseAngle - 1.15, baseAngle + 0.62);
  ctx.stroke();

  ctx.strokeStyle = rgba(preset.palette.primary, 0.88 * alpha);
  ctx.lineWidth = preset.strokeWidth;
  ctx.stroke();

  for (let index = 0; index < 8; index += 1) {
    const angle = baseAngle + Math.PI + (index - 3.5) * 0.11;
    const length = radius * (0.52 + pseudoRandom(index + 61) * 0.4);
    ctx.strokeStyle = rgba(preset.palette.secondary, (0.24 + pseudoRandom(index) * 0.42) * alpha);
    ctx.lineWidth = 1.5 + pseudoRandom(index + 7) * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * length, centerY + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBiteImpact(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
  progress: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const close = Math.sin(clamp01(progress) * Math.PI * 0.9);
  const jawOffset = radius * (0.38 - close * 0.2);
  const angle = Math.atan2(vector.ny, vector.nx);

  ctx.translate(target.x, target.y);
  ctx.rotate(angle);
  ctx.strokeStyle = rgba(preset.palette.primary, 0.9 * alpha);
  ctx.lineWidth = preset.strokeWidth;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(0, -jawOffset, radius * 0.62, 0.18, Math.PI - 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, jawOffset, radius * 0.62, Math.PI + 0.18, TAU - 0.18);
  ctx.stroke();

  ctx.fillStyle = rgba(preset.palette.core, 0.75 * alpha);
  for (const sign of [-1, 1] as const) {
    for (let index = -2; index <= 2; index += 1) {
      const x = index * radius * 0.19;
      const y = sign * (jawOffset + radius * 0.2);
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.055, y);
      ctx.lineTo(x + radius * 0.055, y);
      ctx.lineTo(x, y - sign * radius * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawElementAccent(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
  progress: number,
): void {
  if (preset.accent === "none") {
    drawGenericParticles(ctx, target, preset, radius, alpha);
    return;
  }

  if (preset.accent === "electric") {
    drawElectricAccent(ctx, target, preset, radius, alpha, progress);
    return;
  }

  if (preset.accent === "ice") {
    drawIceAccent(ctx, target, preset, radius, alpha);
    return;
  }

  if (preset.accent === "fire") {
    drawFireAccent(ctx, target, preset, radius, alpha, progress);
    return;
  }

  drawEnergyAccent(ctx, target, vector, preset, radius, alpha, progress);
}

function drawGenericParticles(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
): void {
  ctx.save();
  ctx.fillStyle = rgba(preset.palette.secondary, 0.5 * alpha);
  for (let index = 0; index < preset.particleCount; index += 1) {
    const angle = pseudoRandom(index * 13 + 2) * TAU;
    const distance = radius * (0.35 + pseudoRandom(index * 19 + 4) * 0.8);
    const size = 1.5 + pseudoRandom(index + 8) * 3.2;
    ctx.beginPath();
    ctx.arc(
      target.x + Math.cos(angle) * distance,
      target.y + Math.sin(angle) * distance,
      size,
      0,
      TAU,
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawFireAccent(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
  progress: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let index = 0; index < preset.particleCount; index += 1) {
    const angle = pseudoRandom(index * 17 + 9) * TAU;
    const distance = radius * (0.25 + pseudoRandom(index + 3) * (0.55 + progress * 0.4));
    const x = target.x + Math.cos(angle) * distance;
    const y = target.y + Math.sin(angle) * distance - progress * 8;
    ctx.fillStyle = rgba(index % 2 === 0 ? preset.palette.primary : preset.palette.accent, 0.62 * alpha);
    ctx.beginPath();
    ctx.arc(x, y, 2 + pseudoRandom(index + 11) * 3.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawIceAccent(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let index = 0; index < preset.particleCount; index += 1) {
    const angle = pseudoRandom(index * 23 + 1) * TAU;
    const distance = radius * (0.35 + pseudoRandom(index + 9) * 0.78);
    const x = target.x + Math.cos(angle) * distance;
    const y = target.y + Math.sin(angle) * distance;
    const size = 3 + pseudoRandom(index + 4) * 5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = rgba(index % 2 === 0 ? preset.palette.core : preset.palette.primary, 0.7 * alpha);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(0, size * 0.45);
    ctx.lineTo(-size, 0);
    ctx.lineTo(0, -size * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawElectricAccent(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
  progress: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(preset.palette.primary, 0.78 * alpha);
  ctx.lineWidth = 2.1;
  const branches = Math.max(5, Math.round(preset.particleCount / 3));
  for (let index = 0; index < branches; index += 1) {
    const angle = (index / branches) * TAU + pseudoRandom(index + 33) * 0.35;
    const length = radius * (0.65 + pseudoRandom(index + 6) * 0.65);
    const mid = length * (0.38 + pseudoRandom(index + 14) * 0.22);
    ctx.beginPath();
    ctx.moveTo(target.x, target.y);
    ctx.lineTo(
      target.x + Math.cos(angle + 0.22) * mid,
      target.y + Math.sin(angle + 0.22) * mid,
    );
    ctx.lineTo(
      target.x + Math.cos(angle - 0.12) * length * (0.7 + progress * 0.15),
      target.y + Math.sin(angle - 0.12) * length * (0.7 + progress * 0.15),
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnergyAccent(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  radius: number,
  alpha: number,
  progress: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(preset.palette.accent, 0.52 * alpha);
  ctx.lineWidth = 2;
  for (let index = 0; index < preset.particleCount; index += 1) {
    const angle = pseudoRandom(index * 29 + 2) * TAU;
    const distance = radius * (0.35 + pseudoRandom(index + 15) * 0.9);
    const curl = Math.sin(progress * Math.PI * 2 + index) * 8;
    const x = target.x + Math.cos(angle) * distance + vector.px * curl;
    const y = target.y + Math.sin(angle) * distance + vector.py * curl;
    const length = 5 + pseudoRandom(index + 4) * 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x - vector.nx * length * 0.5 + vector.px * 5,
      y - vector.ny * length * 0.5 + vector.py * 5,
      x - vector.nx * length,
      y - vector.ny * length,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawMiss(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  progress: number,
): void {
  const alpha = 0.5 * (1 - progress);
  ctx.save();
  ctx.strokeStyle = rgba(preset.palette.primary, alpha);
  ctx.lineWidth = 2;
  for (let index = 0; index < 5; index += 1) {
    const side = (index - 2) * 8;
    ctx.beginPath();
    ctx.moveTo(target.x + vector.px * side, target.y + vector.py * side);
    ctx.lineTo(
      target.x + vector.nx * (26 + index * 5) + vector.px * side,
      target.y + vector.ny * (26 + index * 5) + vector.py * side,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawReducedMelee(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  vector: MeleeVector,
  preset: MeleeEffectPreset,
  missed?: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = rgba(preset.palette.primary, 0.6);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(target.x - vector.nx * 16, target.y - vector.ny * 16);
  ctx.stroke();

  if (!missed) {
    ctx.fillStyle = rgba(preset.palette.secondary, 0.5);
    ctx.beginPath();
    ctx.arc(target.x, target.y, Math.min(25, preset.impactRadius * 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function resolveMeleeTarget(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  missed?: boolean,
): BattleMoveVfxPoint {
  if (!missed) {
    return target;
  }

  const vector = getVector(source, target);
  const side = pseudoRandom(Math.round(source.x + source.y + target.x + target.y)) >= 0.5 ? 1 : -1;
  return {
    x: target.x + vector.px * 62 * side + vector.nx * 18,
    y: target.y + vector.py * 62 * side + vector.ny * 18,
  };
}

function getVector(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint): MeleeVector {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) {
    return { length: 0, nx: 0, ny: 0, px: 0, py: 0 };
  }
  const nx = dx / length;
  const ny = dy / length;
  return { length, nx, ny, px: -ny, py: nx };
}

function getImpactAlpha(progress: number): number {
  const appear = clamp01(progress / 0.22);
  const fade = clamp01(1 - Math.max(0, progress - 0.42) / 0.58);
  return appear * fade;
}

function lerpPoint(
  a: BattleMoveVfxPoint,
  b: BattleMoveVfxPoint,
  t: number,
): BattleMoveVfxPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`;
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function easeInCubic(value: number): number {
  return value * value * value;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}
