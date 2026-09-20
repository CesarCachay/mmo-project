import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import {
  getStreamEffectPreset,
  type StreamEffectPreset,
  type StreamParticleKind,
} from "./stream-effect.presets";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  kind: StreamParticleKind;
}

interface ProceduralStreamRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

interface StreamGeometry {
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

export async function playProceduralStreamEffect(
  runtime: ProceduralStreamRuntime,
): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;

  if (request.definition.archetype !== "stream") {
    return;
  }

  const preset = getStreamEffectPreset(request.definition.presetId);
  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  if (prefersReducedMotion) {
    drawReducedMotionStream(
      ctx,
      request.source,
      request.target,
      request.missed ?? false,
      preset,
    );
    await delay(120);
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const particles: Particle[] = [];
  const durationMs = request.definition.durationMs;
  const startTime = performance.now();
  let previousTime = startTime;
  let primaryParticleAccumulator = 0;
  let secondaryParticleAccumulator = 0;

  await new Promise<void>((resolve) => {
    const frame = (now: number): void => {
      if (isCancelled()) {
        ctx.clearRect(0, 0, width, height);
        resolve();
        return;
      }

      const elapsed = Math.min(durationMs, now - startTime);
      const progress = clamp01(elapsed / durationMs);
      const deltaSeconds = Math.min(0.04, Math.max(0, now - previousTime) / 1000);
      previousTime = now;

      ctx.clearRect(0, 0, width, height);

      const resolvedTarget = resolveStreamTarget(
        request.source,
        request.target,
        request.missed ?? false,
      );
      const geometry = getGeometry(request.source, resolvedTarget);

      updateParticles(particles, deltaSeconds);

      let frontProgress = 0;

      if (progress < preset.chargeEnd) {
        const chargeProgress = easeOutCubic(progress / preset.chargeEnd);
        drawCharge(ctx, request.source, geometry, chargeProgress, now, preset);
      } else {
        const travelProgress = clamp01(
          (progress - preset.chargeEnd) / (preset.travelEnd - preset.chargeEnd),
        );
        frontProgress = easeOutCubic(travelProgress);
        const dissipateProgress =
          progress <= preset.sustainEnd
            ? 0
            : clamp01((progress - preset.sustainEnd) / (1 - preset.sustainEnd));
        const opacity = 1 - easeInCubic(dissipateProgress);

        drawStream(ctx, geometry, frontProgress, opacity, now, preset);

        primaryParticleAccumulator +=
          deltaSeconds * preset.primaryParticleRate * (0.35 + frontProgress * 0.65);
        secondaryParticleAccumulator +=
          deltaSeconds * preset.secondaryParticleRate * (0.25 + frontProgress * 0.75);

        if (!(request.missed ?? false) && frontProgress > 0.93) {
          const impactProgress = clamp01(
            (progress - (preset.travelEnd - 0.035)) / 0.2,
          );
          drawImpact(
            ctx,
            request.target,
            geometry,
            impactProgress,
            opacity,
            now,
            preset,
          );
        }
      }

      while (primaryParticleAccumulator >= 1) {
        primaryParticleAccumulator -= 1;
        particles.push(
          createParticle(
            preset.primaryParticleKind,
            request.source,
            resolvedTarget,
            frontProgress,
            preset,
          ),
        );
      }

      while (secondaryParticleAccumulator >= 1) {
        secondaryParticleAccumulator -= 1;
        particles.push(
          createParticle(
            preset.secondaryParticleKind,
            request.source,
            resolvedTarget,
            frontProgress,
            preset,
          ),
        );
      }

      drawParticles(ctx, particles, preset);

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

function resolveStreamTarget(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  missed: boolean,
): BattleMoveVfxPoint {
  if (!missed) {
    return target;
  }

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const perpendicularX = -dy / distance;
  const perpendicularY = dx / distance;
  const missOffset = Math.min(100, Math.max(54, distance * 0.18));

  return {
    x: target.x + perpendicularX * missOffset,
    y: target.y + perpendicularY * missOffset,
  };
}

function getGeometry(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
): StreamGeometry {
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

function drawCharge(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  geometry: StreamGeometry,
  progress: number,
  now: number,
  preset: StreamEffectPreset,
): void {
  const pulse = 0.85 + Math.sin(now * 0.022) * 0.15;
  const radius =
    preset.medium === "fire" ? 9 + progress * 17 : 7 + progress * 12;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  drawGlowCircle(
    ctx,
    source.x,
    source.y,
    radius * 2,
    rgba(preset.palette.outer, 0.16),
  );
  drawGlowCircle(
    ctx,
    source.x,
    source.y,
    radius * 1.18,
    rgba(preset.palette.inner, 0.4),
  );
  drawGlowCircle(
    ctx,
    source.x,
    source.y,
    radius * 0.5 * pulse,
    rgba(preset.palette.core, 0.92),
  );

  const ringRadius = radius * (0.8 + progress * 0.45);
  ctx.strokeStyle = rgba(preset.palette.inner, 0.62 * progress);
  ctx.lineWidth = preset.medium === "fire" ? 2 : 1.5;
  ctx.beginPath();
  ctx.arc(source.x, source.y, ringRadius, 0, TAU);
  ctx.stroke();

  const orbitCount = preset.medium === "fire" ? 7 : 5;
  for (let index = 0; index < orbitCount; index += 1) {
    const angle = now * 0.0026 + index * (TAU / orbitCount);
    const orbit = 15 + progress * 11 + (index % 2) * 4;
    const x = source.x + Math.cos(angle) * orbit;
    const y = source.y + Math.sin(angle) * orbit;
    const forward = 3 + index * 0.45;

    drawGlowCircle(
      ctx,
      x + geometry.ux * forward,
      y + geometry.uy * forward,
      preset.medium === "fire" ? 2.4 + (index % 3) : 1.7 + (index % 2),
      rgba(preset.palette.particlePrimary, 0.8),
    );
  }

  ctx.restore();
}

function drawStream(
  ctx: CanvasRenderingContext2D,
  geometry: StreamGeometry,
  frontProgress: number,
  opacity: number,
  now: number,
  preset: StreamEffectPreset,
): void {
  if (frontProgress <= 0 || opacity <= 0) {
    return;
  }

  const streamDistance = geometry.distance * frontProgress;
  const sampleCount = Math.max(
    6,
    Math.ceil(streamDistance / preset.sampleSpacing),
  );

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let index = sampleCount; index >= 0; index -= 1) {
    const t = index / Math.max(1, sampleCount);
    const distanceAlong = streamDistance * t;
    const normalizedDistance = distanceAlong / Math.max(1, geometry.distance);
    const turbulence =
      Math.sin(now * 0.012 + index * 1.73) *
      (1.2 + normalizedDistance * preset.turbulence);
    const secondaryTurbulence =
      Math.sin(now * 0.018 - index * 0.91) * preset.secondaryTurbulence;
    const centerX = geometry.source.x + geometry.ux * distanceAlong;
    const centerY = geometry.source.y + geometry.uy * distanceAlong;
    const x = centerX + geometry.px * (turbulence + secondaryTurbulence);
    const y = centerY + geometry.py * (turbulence + secondaryTurbulence);
    const taperAtFront = 0.58 + 0.42 * Math.sin(Math.PI * Math.min(1, t));
    const radius =
      (preset.startRadius +
        normalizedDistance * (preset.endRadius - preset.startRadius)) *
      taperAtFront;

    if (preset.medium === "fire") {
      drawFireSample(ctx, x, y, radius, opacity, preset);
    } else {
      drawWaterSample(
        ctx,
        x,
        y,
        radius,
        opacity,
        index,
        geometry,
        preset,
      );
    }
  }

  const frontX = geometry.source.x + geometry.ux * streamDistance;
  const frontY = geometry.source.y + geometry.uy * streamDistance;
  const frontRadius = preset.frontRadius * (0.72 + frontProgress * 0.28);

  drawGlowCircle(
    ctx,
    frontX,
    frontY,
    frontRadius * 1.45,
    rgba(preset.palette.outer, 0.22 * opacity),
  );
  drawGlowCircle(
    ctx,
    frontX,
    frontY,
    frontRadius,
    rgba(preset.palette.inner, 0.5 * opacity),
  );
  drawGlowCircle(
    ctx,
    frontX,
    frontY,
    frontRadius * 0.43,
    rgba(preset.palette.core, 0.88 * opacity),
  );

  ctx.restore();
}

function drawFireSample(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  opacity: number,
  preset: StreamEffectPreset,
): void {
  drawGlowCircle(ctx, x, y, radius * 1.9, rgba(preset.palette.outer, 0.09 * opacity));
  drawGlowCircle(ctx, x, y, radius * 1.22, rgba(preset.palette.mid, 0.23 * opacity));
  drawGlowCircle(ctx, x, y, radius * 0.78, rgba(preset.palette.inner, 0.48 * opacity));
  drawGlowCircle(ctx, x, y, radius * 0.37, rgba(preset.palette.core, 0.78 * opacity));
}

function drawWaterSample(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  opacity: number,
  index: number,
  geometry: StreamGeometry,
  preset: StreamEffectPreset,
): void {
  drawGlowCircle(ctx, x, y, radius * 1.65, rgba(preset.palette.outer, 0.1 * opacity));
  drawGlowCircle(ctx, x, y, radius * 1.05, rgba(preset.palette.mid, 0.3 * opacity));
  drawGlowCircle(ctx, x, y, radius * 0.7, rgba(preset.palette.inner, 0.58 * opacity));
  drawGlowCircle(ctx, x, y, radius * 0.3, rgba(preset.palette.core, 0.88 * opacity));

  if (index % 3 === 0) {
    const sprayLength = Math.max(3, radius * 0.85);
    const direction = index % 2 === 0 ? 1 : -1;
    ctx.strokeStyle = rgba(preset.palette.inner, 0.38 * opacity);
    ctx.lineWidth = Math.max(1, radius * 0.08);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - geometry.ux * sprayLength + geometry.px * direction * sprayLength * 0.7,
      y - geometry.uy * sprayLength + geometry.py * direction * sprayLength * 0.7,
    );
    ctx.stroke();
  }
}

function drawImpact(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  geometry: StreamGeometry,
  progress: number,
  opacity: number,
  now: number,
  preset: StreamEffectPreset,
): void {
  if (progress <= 0 || opacity <= 0) {
    return;
  }

  const burst = Math.sin(Math.PI * Math.min(1, progress));
  const radius = 14 + burst * preset.impactRadius;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGlowCircle(
    ctx,
    target.x,
    target.y,
    radius * 1.75,
    rgba(preset.palette.outer, 0.16 * opacity),
  );
  drawGlowCircle(
    ctx,
    target.x,
    target.y,
    radius,
    rgba(preset.palette.impact, 0.5 * opacity),
  );
  drawGlowCircle(
    ctx,
    target.x,
    target.y,
    radius * 0.4,
    rgba(preset.palette.core, 0.92 * opacity),
  );

  for (let index = 0; index < preset.impactRayCount; index += 1) {
    const angle =
      index * (TAU / preset.impactRayCount) + Math.sin(now * 0.004 + index) * 0.2;
    const distance = 16 + burst * (20 + (index % 4) * 7);
    const x = target.x + Math.cos(angle) * distance;
    const y = target.y + Math.sin(angle) * distance;

    ctx.strokeStyle = rgba(preset.palette.inner, 0.7 * opacity);
    ctx.lineWidth = preset.medium === "fire" ? 1.5 + (index % 2) : 1.2 + (index % 3) * 0.45;
    ctx.beginPath();
    ctx.moveTo(target.x + geometry.ux * 3, target.y + geometry.uy * 3);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  if (preset.medium === "water") {
    const ringRadius = radius * (0.35 + progress * 0.75);
    ctx.strokeStyle = rgba(preset.palette.core, 0.62 * opacity * (1 - progress * 0.45));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, ringRadius, 0, TAU);
    ctx.stroke();
  }

  ctx.restore();
}

function drawReducedMotionStream(
  ctx: CanvasRenderingContext2D,
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  missed: boolean,
  preset: StreamEffectPreset,
): void {
  const resolvedTarget = resolveStreamTarget(source, target, missed);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(preset.palette.mid, 0.72);
  ctx.lineWidth = Math.max(8, preset.endRadius * 0.55);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(resolvedTarget.x, resolvedTarget.y);
  ctx.stroke();

  ctx.strokeStyle = rgba(preset.palette.core, 0.84);
  ctx.lineWidth = Math.max(3, preset.endRadius * 0.2);
  ctx.stroke();

  if (!missed) {
    drawGlowCircle(
      ctx,
      target.x,
      target.y,
      Math.max(22, preset.impactRadius * 0.8),
      rgba(preset.palette.impact, 0.68),
    );
  }

  ctx.restore();
}

function createParticle(
  kind: StreamParticleKind,
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  frontProgress: number,
  preset: StreamEffectPreset,
): Particle {
  const geometry = getGeometry(source, target);
  const maxAlong = geometry.distance * Math.max(0.05, frontProgress) * 0.96;
  const along = Math.random() * maxAlong;
  const spread =
    preset.startRadius +
    (along / Math.max(1, geometry.distance)) *
      (preset.endRadius - preset.startRadius);
  const side = (Math.random() - 0.5) * Math.max(8, spread * 1.8);
  const baseX = source.x + geometry.ux * along + geometry.px * side;
  const baseY = source.y + geometry.uy * along + geometry.py * side;

  if (kind === "ember") {
    return {
      x: baseX,
      y: baseY,
      vx:
        geometry.ux * (34 + Math.random() * 72) +
        geometry.px * (Math.random() - 0.5) * 38,
      vy:
        geometry.uy * (34 + Math.random() * 72) +
        geometry.py * (Math.random() - 0.5) * 38 -
        14,
      age: 0,
      life: 0.28 + Math.random() * 0.42,
      size: 1.2 + Math.random() * 2.8,
      kind,
    };
  }

  if (kind === "smoke") {
    return {
      x: baseX,
      y: baseY,
      vx:
        geometry.ux * (8 + Math.random() * 20) +
        geometry.px * (Math.random() - 0.5) * 14,
      vy: geometry.uy * (8 + Math.random() * 20) - 18 - Math.random() * 14,
      age: 0,
      life: 0.65 + Math.random() * 0.55,
      size: 8 + Math.random() * 14,
      kind,
    };
  }

  if (kind === "droplet") {
    return {
      x: baseX,
      y: baseY,
      vx:
        geometry.ux * (45 + Math.random() * 90) +
        geometry.px * (Math.random() - 0.5) * 48,
      vy:
        geometry.uy * (45 + Math.random() * 90) +
        geometry.py * (Math.random() - 0.5) * 44,
      age: 0,
      life: 0.24 + Math.random() * 0.34,
      size: 1.2 + Math.random() * 2.6,
      kind,
    };
  }

  return {
    x: baseX,
    y: baseY,
    vx:
      geometry.ux * (12 + Math.random() * 22) +
      geometry.px * (Math.random() - 0.5) * 20,
    vy: geometry.uy * (8 + Math.random() * 16) - 5 - Math.random() * 8,
    age: 0,
    life: 0.42 + Math.random() * 0.42,
    size: 5 + Math.random() * 9,
    kind,
  };
}

function updateParticles(particles: Particle[], deltaSeconds: number): void {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];

    if (!particle) {
      continue;
    }

    particle.age += deltaSeconds;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;

    switch (particle.kind) {
      case "ember":
        particle.vy -= 8 * deltaSeconds;
        break;
      case "smoke":
        particle.vx *= Math.pow(0.92, deltaSeconds * 60);
        particle.vy -= 3 * deltaSeconds;
        break;
      case "droplet":
        particle.vx *= Math.pow(0.985, deltaSeconds * 60);
        particle.vy += 70 * deltaSeconds;
        break;
      case "mist":
        particle.vx *= Math.pow(0.94, deltaSeconds * 60);
        particle.vy -= 4 * deltaSeconds;
        break;
    }

    if (particle.age >= particle.life) {
      particles.splice(index, 1);
    }
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly Particle[],
  preset: StreamEffectPreset,
): void {
  for (const particle of particles) {
    const lifeProgress = clamp01(particle.age / particle.life);
    const alpha = 1 - lifeProgress;

    if (particle.kind === "ember") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawGlowCircle(
        ctx,
        particle.x,
        particle.y,
        particle.size * (1 + lifeProgress * 0.6),
        rgba(preset.palette.particlePrimary, 0.82 * alpha),
      );
      ctx.restore();
      continue;
    }

    if (particle.kind === "droplet") {
      const speed = Math.max(1, Math.hypot(particle.vx, particle.vy));
      const ux = particle.vx / speed;
      const uy = particle.vy / speed;
      const streakLength = 4 + particle.size * 2.4;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = rgba(preset.palette.particlePrimary, 0.7 * alpha);
      ctx.lineWidth = Math.max(1, particle.size * 0.7);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(
        particle.x - ux * streakLength,
        particle.y - uy * streakLength,
      );
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    drawGlowCircle(
      ctx,
      particle.x,
      particle.y,
      particle.size * (1 + lifeProgress * 0.7),
      particle.kind === "smoke"
        ? rgba(preset.palette.particleSecondary, 0.2 * alpha)
        : rgba(preset.palette.particleSecondary, 0.18 * alpha),
    );
    ctx.restore();
  }
}

function drawGlowCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  if (radius <= 0) {
    return;
  }

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`;
}

function easeOutCubic(value: number): number {
  const inverse = 1 - clamp01(value);
  return 1 - inverse * inverse * inverse;
}

function easeInCubic(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * clamped;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
