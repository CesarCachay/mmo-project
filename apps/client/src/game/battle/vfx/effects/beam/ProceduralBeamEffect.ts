import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import {
  getBeamEffectPreset,
  type BeamEffectPreset,
  type BeamParticleKind,
} from "./beam-effect.presets";

interface BeamParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  rotation: number;
  spin: number;
  kind: BeamParticleKind;
}

interface ProceduralBeamRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

interface BeamGeometry {
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

export async function playProceduralBeamEffect(
  runtime: ProceduralBeamRuntime,
): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;

  if (request.definition.archetype !== "beam") {
    return;
  }

  const preset = getBeamEffectPreset(request.definition.presetId);
  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const resolvedTarget = resolveBeamTarget(
    request.source,
    request.target,
    request.missed ?? false,
  );
  const geometry = getGeometry(request.source, resolvedTarget);

  if (prefersReducedMotion) {
    drawReducedMotionBeam(
      ctx,
      geometry,
      request.target,
      request.missed ?? false,
      preset,
    );
    await delay(120);
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const particles: BeamParticle[] = [];
  const durationMs = request.definition.durationMs;
  const startTime = performance.now();
  let previousTime = startTime;
  let particleAccumulator = 0;

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
      updateParticles(particles, deltaSeconds);

      let frontProgress = 0;
      let opacity = 1;

      if (progress < preset.chargeEnd) {
        const chargeProgress = easeOutCubic(progress / preset.chargeEnd);
        drawCharge(ctx, geometry, chargeProgress, now, preset);
      } else {
        const travelProgress = clamp01(
          (progress - preset.chargeEnd) / (preset.travelEnd - preset.chargeEnd),
        );
        frontProgress = easeOutCubic(travelProgress);
        const fadeProgress =
          progress <= preset.sustainEnd
            ? 0
            : clamp01((progress - preset.sustainEnd) / (1 - preset.sustainEnd));
        opacity = 1 - easeInCubic(fadeProgress);

        drawBeam(ctx, geometry, frontProgress, opacity, now, preset);

        particleAccumulator +=
          deltaSeconds * preset.particleRate * (0.25 + frontProgress * 0.75);
        while (particleAccumulator >= 1) {
          particleAccumulator -= 1;
          particles.push(createParticle(geometry, frontProgress, preset));
        }

        if (!(request.missed ?? false) && frontProgress > 0.96) {
          const impactProgress = clamp01(
            (progress - (preset.travelEnd - 0.025)) /
              Math.max(0.001, preset.sustainEnd - preset.travelEnd + 0.1),
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

function resolveBeamTarget(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  missed: boolean,
): BattleMoveVfxPoint {
  if (!missed) {
    return target;
  }

  const geometry = getGeometry(source, target);
  const offset = Math.min(120, Math.max(66, geometry.distance * 0.2));
  const side = source.x <= target.x ? -1 : 1;

  return {
    x: target.x + geometry.px * offset * side + geometry.ux * 42,
    y: target.y + geometry.py * offset * side + geometry.uy * 42,
  };
}

function getGeometry(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
): BeamGeometry {
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
  geometry: BeamGeometry,
  progress: number,
  now: number,
  preset: BeamEffectPreset,
): void {
  const pulse = 0.9 + Math.sin(now * 0.024) * 0.1;
  const radius = preset.chargeRadius * (0.35 + progress * 0.65) * pulse;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  drawGlowCircle(
    ctx,
    geometry.source.x,
    geometry.source.y,
    radius * 2.3,
    rgba(preset.palette.outer, 0.16 * progress),
  );
  drawGlowCircle(
    ctx,
    geometry.source.x,
    geometry.source.y,
    radius,
    rgba(preset.palette.inner, 0.62 * progress),
  );
  drawGlowCircle(
    ctx,
    geometry.source.x,
    geometry.source.y,
    radius * 0.38,
    rgba(preset.palette.core, 0.96 * progress),
  );

  const rings = preset.style === "hyper" || preset.style === "solar" ? 3 : 2;
  for (let ringIndex = 0; ringIndex < rings; ringIndex += 1) {
    const phase = (now * 0.0018 + ringIndex / rings) % 1;
    const ringRadius = radius * (0.8 + phase * 1.45);
    ctx.strokeStyle = rgba(
      preset.palette.accents[ringIndex % preset.palette.accents.length] ?? preset.palette.inner,
      (1 - phase) * 0.55 * progress,
    );
    ctx.lineWidth = 1.4 + ringIndex * 0.45;
    ctx.beginPath();
    ctx.arc(geometry.source.x, geometry.source.y, ringRadius, 0, TAU);
    ctx.stroke();
  }

  const orbitCount = preset.style === "solar" ? 10 : preset.style === "hyper" ? 8 : 6;
  for (let index = 0; index < orbitCount; index += 1) {
    const angle = now * (preset.style === "solar" ? 0.003 : 0.0045) + index * (TAU / orbitCount);
    const orbit = radius * (1.05 + (index % 2) * 0.34);
    drawGlowCircle(
      ctx,
      geometry.source.x + Math.cos(angle) * orbit,
      geometry.source.y + Math.sin(angle) * orbit,
      preset.style === "hyper" ? 2.6 : 2,
      rgba(preset.palette.particle, 0.72 * progress),
    );
  }

  ctx.restore();
}

function drawBeam(
  ctx: CanvasRenderingContext2D,
  geometry: BeamGeometry,
  frontProgress: number,
  opacity: number,
  now: number,
  preset: BeamEffectPreset,
): void {
  if (frontProgress <= 0 || opacity <= 0) {
    return;
  }

  const visibleDistance = geometry.distance * frontProgress;
  const pulse = 1 + Math.sin(now * 0.027) * preset.pulseAmount;
  const sampleCount = Math.max(7, Math.ceil(visibleDistance / 26));
  const points: BattleMoveVfxPoint[] = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const distanceAlong = visibleDistance * t;
    const taper = Math.sin(Math.PI * t);
    const wave =
      Math.sin(t * Math.PI * preset.waveFrequency + now * 0.015) *
      preset.waveAmplitude *
      taper;
    const jitter =
      preset.style === "hyper"
        ? Math.sin(now * 0.04 + index * 2.7) * 0.9 * taper
        : 0;

    points.push({
      x: geometry.source.x + geometry.ux * distanceAlong + geometry.px * (wave + jitter),
      y: geometry.source.y + geometry.uy * distanceAlong + geometry.py * (wave + jitter),
    });
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawPolyline(ctx, points, preset.outerWidth * pulse, rgba(preset.palette.outer, 0.2 * opacity));

  if (preset.style === "aurora") {
    drawAuroraBands(ctx, points, geometry, opacity, now, preset);
  } else {
    drawPolyline(ctx, points, preset.midWidth * pulse, rgba(preset.palette.mid, 0.52 * opacity));
  }

  drawPolyline(ctx, points, preset.coreWidth * 2.25 * pulse, rgba(preset.palette.inner, 0.78 * opacity));
  drawPolyline(ctx, points, preset.coreWidth * pulse, rgba(preset.palette.core, 0.98 * opacity));

  if (preset.style === "ice") {
    drawIceFacets(ctx, points, geometry, opacity, preset);
  } else if (preset.style === "hyper") {
    drawHyperRings(ctx, geometry, visibleDistance, opacity, now, preset);
  } else if (preset.style === "solar") {
    drawSolarRays(ctx, geometry, visibleDistance, opacity, now, preset);
  }

  const front = points[points.length - 1];
  if (front) {
    drawGlowCircle(
      ctx,
      front.x,
      front.y,
      preset.midWidth * 1.15,
      rgba(preset.palette.inner, 0.34 * opacity),
    );
    drawGlowCircle(
      ctx,
      front.x,
      front.y,
      preset.coreWidth * 1.2,
      rgba(preset.palette.core, 0.94 * opacity),
    );
  }

  ctx.restore();
}

function drawAuroraBands(
  ctx: CanvasRenderingContext2D,
  points: readonly BattleMoveVfxPoint[],
  geometry: BeamGeometry,
  opacity: number,
  now: number,
  preset: BeamEffectPreset,
): void {
  const offsets = [-5.5, -1.8, 1.8, 5.5];

  offsets.forEach((offset, index) => {
    const shifted = points.map((point, pointIndex) => {
      const shimmer = Math.sin(now * 0.012 + pointIndex * 0.9 + index) * 1.1;
      return {
        x: point.x + geometry.px * (offset + shimmer),
        y: point.y + geometry.py * (offset + shimmer),
      };
    });
    const color = preset.palette.accents[index % preset.palette.accents.length] ?? preset.palette.mid;
    drawPolyline(ctx, shifted, 3.2, rgba(color, 0.58 * opacity));
  });
}

function drawIceFacets(
  ctx: CanvasRenderingContext2D,
  points: readonly BattleMoveVfxPoint[],
  geometry: BeamGeometry,
  opacity: number,
  preset: BeamEffectPreset,
): void {
  for (let index = 2; index < points.length - 1; index += 3) {
    const point = points[index];
    if (!point) {
      continue;
    }

    const side = index % 2 === 0 ? 1 : -1;
    const reach = 7 + (index % 3) * 2;
    ctx.strokeStyle = rgba(preset.palette.particle, 0.52 * opacity);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + geometry.px * reach * side, point.y + geometry.py * reach * side);
    ctx.stroke();
  }
}

function drawHyperRings(
  ctx: CanvasRenderingContext2D,
  geometry: BeamGeometry,
  visibleDistance: number,
  opacity: number,
  now: number,
  preset: BeamEffectPreset,
): void {
  const spacing = 58;
  const count = Math.floor(visibleDistance / spacing);

  for (let index = 1; index <= count; index += 1) {
    const distanceAlong = index * spacing - ((now * 0.05) % spacing);
    if (distanceAlong <= 0 || distanceAlong >= visibleDistance) {
      continue;
    }

    const x = geometry.source.x + geometry.ux * distanceAlong;
    const y = geometry.source.y + geometry.uy * distanceAlong;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(geometry.dy, geometry.dx));
    ctx.scale(0.42, 1);
    ctx.strokeStyle = rgba(preset.palette.particle, 0.48 * opacity);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, preset.midWidth * 0.7, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSolarRays(
  ctx: CanvasRenderingContext2D,
  geometry: BeamGeometry,
  visibleDistance: number,
  opacity: number,
  now: number,
  preset: BeamEffectPreset,
): void {
  const count = Math.max(2, Math.floor(visibleDistance / 90));

  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.5) / count;
    const distanceAlong = visibleDistance * t;
    const x = geometry.source.x + geometry.ux * distanceAlong;
    const y = geometry.source.y + geometry.uy * distanceAlong;
    const length = 9 + Math.sin(now * 0.018 + index) * 3;
    const side = index % 2 === 0 ? 1 : -1;

    ctx.strokeStyle = rgba(preset.palette.accents[index % preset.palette.accents.length] ?? preset.palette.particle, 0.46 * opacity);
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(x - geometry.px * length * side, y - geometry.py * length * side);
    ctx.lineTo(x + geometry.px * length * side, y + geometry.py * length * side);
    ctx.stroke();
  }
}

function drawImpact(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  geometry: BeamGeometry,
  progress: number,
  opacity: number,
  now: number,
  preset: BeamEffectPreset,
): void {
  const burst = Math.sin(Math.PI * clamp01(progress));
  const pulse = 0.9 + Math.sin(now * 0.035) * 0.1;
  const radius = preset.impactRadius * (0.45 + burst * 0.55) * pulse;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGlowCircle(ctx, target.x, target.y, radius * 1.55, rgba(preset.palette.outer, 0.18 * opacity));
  drawGlowCircle(ctx, target.x, target.y, radius, rgba(preset.palette.impact, 0.46 * opacity));
  drawGlowCircle(ctx, target.x, target.y, radius * 0.35, rgba(preset.palette.core, 0.94 * opacity));

  for (let index = 0; index < preset.impactRayCount; index += 1) {
    const angle = index * (TAU / preset.impactRayCount) + now * 0.0015;
    const start = radius * 0.32;
    const end = radius * (0.72 + (index % 3) * 0.18) * burst;
    const directionalBias = Math.max(0.45, 1 + Math.cos(angle - Math.atan2(geometry.dy, geometry.dx)) * 0.25);

    ctx.strokeStyle = rgba(
      preset.palette.accents[index % preset.palette.accents.length] ?? preset.palette.impact,
      0.62 * opacity * burst,
    );
    ctx.lineWidth = 1.2 + (index % 3) * 0.45;
    ctx.beginPath();
    ctx.moveTo(target.x + Math.cos(angle) * start, target.y + Math.sin(angle) * start);
    ctx.lineTo(
      target.x + Math.cos(angle) * end * directionalBias,
      target.y + Math.sin(angle) * end * directionalBias,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function createParticle(
  geometry: BeamGeometry,
  frontProgress: number,
  preset: BeamEffectPreset,
): BeamParticle {
  const t = Math.random() * Math.max(0.08, frontProgress);
  const distanceAlong = geometry.distance * t;
  const sideOffset = (Math.random() - 0.5) * preset.outerWidth * 1.6;
  const x = geometry.source.x + geometry.ux * distanceAlong + geometry.px * sideOffset;
  const y = geometry.source.y + geometry.uy * distanceAlong + geometry.py * sideOffset;
  const drift = (Math.random() - 0.5) * 18;

  return {
    x,
    y,
    vx: geometry.ux * (8 + Math.random() * 24) + geometry.px * drift,
    vy: geometry.uy * (8 + Math.random() * 24) + geometry.py * drift - (preset.style === "solar" ? 8 : 0),
    age: 0,
    life: 0.24 + Math.random() * 0.36,
    size: 1.6 + Math.random() * (preset.style === "hyper" ? 4.2 : 3.2),
    rotation: Math.random() * TAU,
    spin: (Math.random() - 0.5) * 6,
    kind: preset.particleKind,
  };
}

function updateParticles(particles: BeamParticle[], deltaSeconds: number): void {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    if (!particle) {
      continue;
    }

    particle.age += deltaSeconds;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
    particle.rotation += particle.spin * deltaSeconds;
    particle.vx *= Math.pow(0.93, deltaSeconds * 60);
    particle.vy *= Math.pow(0.93, deltaSeconds * 60);

    if (particle.age >= particle.life) {
      particles.splice(index, 1);
    }
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly BeamParticle[],
  preset: BeamEffectPreset,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const particle of particles) {
    const life = 1 - clamp01(particle.age / particle.life);
    const alpha = life * 0.78;

    if (particle.kind === "crystal") {
      drawCrystalParticle(ctx, particle, alpha, preset);
    } else if (particle.kind === "prism") {
      drawPrismParticle(ctx, particle, alpha, preset);
    } else if (particle.kind === "spark") {
      drawSparkParticle(ctx, particle, alpha, preset);
    } else {
      drawSolarParticle(ctx, particle, alpha, preset);
    }
  }

  ctx.restore();
}

function drawCrystalParticle(
  ctx: CanvasRenderingContext2D,
  particle: BeamParticle,
  alpha: number,
  preset: BeamEffectPreset,
): void {
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.fillStyle = rgba(preset.palette.particle, alpha);
  ctx.beginPath();
  ctx.moveTo(0, -particle.size * 1.5);
  ctx.lineTo(particle.size * 0.65, 0);
  ctx.lineTo(0, particle.size * 1.5);
  ctx.lineTo(-particle.size * 0.65, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPrismParticle(
  ctx: CanvasRenderingContext2D,
  particle: BeamParticle,
  alpha: number,
  preset: BeamEffectPreset,
): void {
  const color = preset.palette.accents[
    Math.abs(Math.floor(particle.rotation * 10)) % preset.palette.accents.length
  ] ?? preset.palette.particle;
  drawGlowCircle(ctx, particle.x, particle.y, particle.size * 1.6, rgba(color, alpha * 0.38));
  drawGlowCircle(ctx, particle.x, particle.y, particle.size * 0.55, rgba(color, alpha));
}

function drawSparkParticle(
  ctx: CanvasRenderingContext2D,
  particle: BeamParticle,
  alpha: number,
  preset: BeamEffectPreset,
): void {
  const length = particle.size * 2.5;
  ctx.strokeStyle = rgba(preset.palette.particle, alpha);
  ctx.lineWidth = Math.max(1, particle.size * 0.35);
  ctx.beginPath();
  ctx.moveTo(particle.x - Math.cos(particle.rotation) * length, particle.y - Math.sin(particle.rotation) * length);
  ctx.lineTo(particle.x + Math.cos(particle.rotation) * length, particle.y + Math.sin(particle.rotation) * length);
  ctx.stroke();
}

function drawSolarParticle(
  ctx: CanvasRenderingContext2D,
  particle: BeamParticle,
  alpha: number,
  preset: BeamEffectPreset,
): void {
  drawGlowCircle(
    ctx,
    particle.x,
    particle.y,
    particle.size * 2.2,
    rgba(preset.palette.particle, alpha * 0.28),
  );
  drawGlowCircle(
    ctx,
    particle.x,
    particle.y,
    particle.size * 0.72,
    rgba(preset.palette.core, alpha),
  );
}

function drawReducedMotionBeam(
  ctx: CanvasRenderingContext2D,
  geometry: BeamGeometry,
  actualTarget: BattleMoveVfxPoint,
  missed: boolean,
  preset: BeamEffectPreset,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.strokeStyle = rgba(preset.palette.outer, 0.3);
  ctx.lineWidth = preset.outerWidth * 0.7;
  ctx.beginPath();
  ctx.moveTo(geometry.source.x, geometry.source.y);
  ctx.lineTo(geometry.target.x, geometry.target.y);
  ctx.stroke();

  ctx.strokeStyle = rgba(preset.palette.core, 0.92);
  ctx.lineWidth = Math.max(2, preset.coreWidth * 0.8);
  ctx.beginPath();
  ctx.moveTo(geometry.source.x, geometry.source.y);
  ctx.lineTo(geometry.target.x, geometry.target.y);
  ctx.stroke();

  if (!missed) {
    drawGlowCircle(
      ctx,
      actualTarget.x,
      actualTarget.y,
      preset.impactRadius * 0.5,
      rgba(preset.palette.impact, 0.58),
    );
  }
  ctx.restore();
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly BattleMoveVfxPoint[],
  width: number,
  color: string,
): void {
  const first = points[0];
  if (!first) {
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (point) {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();
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
  gradient.addColorStop(1, rgba(extractRgb(color), 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function extractRgb(color: string): string {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match?.[1]) {
    return "255, 255, 255";
  }

  return match[1].split(",").slice(0, 3).join(",");
}

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${clamp01(alpha)})`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  const clamped = clamp01(value);
  return 1 - Math.pow(1 - clamped, 3);
}

function easeInCubic(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * clamped;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
