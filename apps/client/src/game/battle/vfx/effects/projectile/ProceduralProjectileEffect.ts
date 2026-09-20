import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import {
  getProjectileEffectPreset,
  type ProjectileEffectPreset,
  type ProjectileParticleKind,
} from "./projectile-effect.presets";

interface ProjectileParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  kind: ProjectileParticleKind;
}

interface ProceduralProjectileRuntime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

interface ProjectileGeometry {
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

export async function playProceduralProjectileEffect(
  runtime: ProceduralProjectileRuntime,
): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;

  if (request.definition.archetype !== "projectile") {
    return;
  }

  const preset = getProjectileEffectPreset(request.definition.presetId);
  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const resolvedTarget = resolveProjectileTarget(
    request.source,
    request.target,
    request.missed ?? false,
  );
  const geometry = getGeometry(request.source, resolvedTarget);

  if (prefersReducedMotion) {
    drawReducedMotionProjectile(
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

  const particles: ProjectileParticle[] = [];
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

      if (progress < preset.chargeEnd) {
        const chargeProgress = easeOutCubic(progress / preset.chargeEnd);
        drawCharge(ctx, geometry, chargeProgress, now, preset);
      } else if (progress < preset.travelEnd) {
        const travelProgress = easeInOutCubic(
          (progress - preset.chargeEnd) / (preset.travelEnd - preset.chargeEnd),
        );
        const position = getProjectilePosition(geometry, travelProgress, now, preset);
        drawTrail(ctx, geometry, travelProgress, now, preset);
        drawProjectile(ctx, position, geometry, travelProgress, now, preset);

        particleAccumulator += deltaSeconds * preset.particleRate;
        while (particleAccumulator >= 1) {
          particleAccumulator -= 1;
          particles.push(createParticle(position, geometry, preset));
        }
      } else if (!(request.missed ?? false)) {
        const impactProgress = clamp01(
          (progress - preset.travelEnd) / Math.max(0.001, preset.impactEnd - preset.travelEnd),
        );
        drawImpact(ctx, request.target, geometry, impactProgress, now, preset);
      } else {
        const fadeProgress = clamp01(
          (progress - preset.travelEnd) / Math.max(0.001, 1 - preset.travelEnd),
        );
        const position = getProjectilePosition(geometry, 1, now, preset);
        drawProjectile(
          ctx,
          position,
          geometry,
          1,
          now,
          preset,
          1 - fadeProgress,
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

function resolveProjectileTarget(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
  missed: boolean,
): BattleMoveVfxPoint {
  if (!missed) {
    return target;
  }

  const geometry = getGeometry(source, target);
  const missDirection = source.x <= target.x ? -1 : 1;
  const offset = Math.min(105, Math.max(58, geometry.distance * 0.18));

  return {
    x: target.x + geometry.px * offset * missDirection + geometry.ux * 28,
    y: target.y + geometry.py * offset * missDirection + geometry.uy * 28,
  };
}

function getGeometry(
  source: BattleMoveVfxPoint,
  target: BattleMoveVfxPoint,
): ProjectileGeometry {
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

function getProjectilePosition(
  geometry: ProjectileGeometry,
  progress: number,
  now: number,
  preset: ProjectileEffectPreset,
): BattleMoveVfxPoint {
  const clamped = clamp01(progress);
  const arc = Math.sin(Math.PI * clamped) * preset.arcHeight;
  const wobble =
    Math.sin(now * 0.012 + clamped * 15) * preset.wobble * Math.sin(Math.PI * clamped);

  return {
    x:
      geometry.source.x +
      geometry.dx * clamped +
      geometry.px * wobble,
    y:
      geometry.source.y +
      geometry.dy * clamped +
      arc +
      geometry.py * wobble,
  };
}

function drawCharge(
  ctx: CanvasRenderingContext2D,
  geometry: ProjectileGeometry,
  progress: number,
  now: number,
  preset: ProjectileEffectPreset,
): void {
  const pulse = 0.82 + Math.sin(now * 0.025) * 0.18;
  const radius = preset.radius * (0.35 + progress * 0.65) * pulse;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGlowCircle(
    ctx,
    geometry.source.x,
    geometry.source.y,
    radius * 2.3,
    rgba(preset.palette.outer, 0.2 * progress),
  );
  drawGlowCircle(
    ctx,
    geometry.source.x,
    geometry.source.y,
    radius,
    rgba(preset.palette.inner, 0.75 * progress),
  );
  drawGlowCircle(
    ctx,
    geometry.source.x,
    geometry.source.y,
    radius * 0.38,
    rgba(preset.palette.core, 0.95 * progress),
  );

  for (let index = 0; index < 5; index += 1) {
    const angle = now * 0.004 + index * (TAU / 5);
    const orbit = preset.radius * (0.7 + progress * 0.65);
    drawGlowCircle(
      ctx,
      geometry.source.x + Math.cos(angle) * orbit,
      geometry.source.y + Math.sin(angle) * orbit,
      1.4 + (index % 2),
      rgba(preset.palette.particle, 0.72 * progress),
    );
  }
  ctx.restore();
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  geometry: ProjectileGeometry,
  progress: number,
  now: number,
  preset: ProjectileEffectPreset,
): void {
  const head = getProjectilePosition(geometry, progress, now, preset);
  const trailProgress = Math.max(0, progress - preset.trailLength / geometry.distance);
  const tail = getProjectilePosition(geometry, trailProgress, now, preset);
  const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);

  gradient.addColorStop(0, rgba(preset.palette.trail, 0));
  gradient.addColorStop(0.45, rgba(preset.palette.trail, 0.24));
  gradient.addColorStop(1, rgba(preset.palette.inner, 0.72));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.strokeStyle = gradient;
  ctx.lineWidth = preset.trailWidth;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();
  ctx.restore();
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  position: BattleMoveVfxPoint,
  geometry: ProjectileGeometry,
  progress: number,
  now: number,
  preset: ProjectileEffectPreset,
  opacity = 1,
): void {
  if (opacity <= 0) {
    return;
  }

  ctx.save();
  ctx.translate(position.x, position.y);
  const heading = Math.atan2(geometry.dy, geometry.dx);
  ctx.rotate(heading + now * preset.spinSpeed);

  if (preset.shape === "seed") {
    drawSeedProjectile(ctx, preset, opacity);
  } else if (preset.shape === "sludge-orb") {
    drawSludgeProjectile(ctx, now, preset, opacity);
  } else {
    drawOrbProjectile(ctx, now, progress, preset, opacity);
  }

  ctx.restore();
}

function drawOrbProjectile(
  ctx: CanvasRenderingContext2D,
  now: number,
  progress: number,
  preset: ProjectileEffectPreset,
  opacity: number,
): void {
  const pulse = 0.92 + Math.sin(now * 0.02 + progress * 8) * 0.08;
  const radius = preset.radius * pulse;

  ctx.globalCompositeOperation = "lighter";
  drawGlowCircle(ctx, 0, 0, radius * 2.05, rgba(preset.palette.outer, 0.22 * opacity));
  drawGlowCircle(ctx, 0, 0, radius * 1.28, rgba(preset.palette.mid, 0.52 * opacity));
  drawGlowCircle(ctx, 0, 0, radius * 0.82, rgba(preset.palette.inner, 0.8 * opacity));
  drawGlowCircle(ctx, 0, 0, radius * 0.35, rgba(preset.palette.core, 0.96 * opacity));

  const orbitCount = preset.shape === "shadow-orb" ? 4 : 3;
  for (let index = 0; index < orbitCount; index += 1) {
    const angle = now * 0.006 + index * (TAU / orbitCount);
    const orbit = radius * 1.18;
    drawGlowCircle(
      ctx,
      Math.cos(angle) * orbit,
      Math.sin(angle) * orbit,
      Math.max(1.4, radius * 0.13),
      rgba(preset.palette.particle, 0.68 * opacity),
    );
  }
}

function drawSludgeProjectile(
  ctx: CanvasRenderingContext2D,
  now: number,
  preset: ProjectileEffectPreset,
  opacity: number,
): void {
  const radius = preset.radius;

  ctx.globalCompositeOperation = "source-over";
  drawGlowCircle(ctx, 0, 0, radius * 1.65, rgba(preset.palette.outer, 0.25 * opacity));
  drawGlowCircle(ctx, 0, 0, radius, rgba(preset.palette.mid, 0.92 * opacity));

  for (let index = 0; index < 5; index += 1) {
    const angle = now * 0.003 + index * (TAU / 5);
    const orbit = radius * (0.35 + (index % 2) * 0.2);
    drawGlowCircle(
      ctx,
      Math.cos(angle) * orbit,
      Math.sin(angle) * orbit,
      radius * (0.16 + (index % 3) * 0.06),
      rgba(index % 2 === 0 ? preset.palette.inner : preset.palette.core, 0.58 * opacity),
    );
  }
}

function drawSeedProjectile(
  ctx: CanvasRenderingContext2D,
  preset: ProjectileEffectPreset,
  opacity: number,
): void {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = rgba(preset.palette.outer, 0.92 * opacity);
  ctx.beginPath();
  ctx.ellipse(0, 0, preset.radius * 1.05, preset.radius * 0.72, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = rgba(preset.palette.mid, 0.96 * opacity);
  ctx.beginPath();
  ctx.ellipse(-preset.radius * 0.15, -preset.radius * 0.12, preset.radius * 0.68, preset.radius * 0.42, 0, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = rgba(preset.palette.core, 0.75 * opacity);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-preset.radius * 0.18, 0, preset.radius * 0.43, -1.2, 1.2);
  ctx.stroke();
}

function drawImpact(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  geometry: ProjectileGeometry,
  progress: number,
  now: number,
  preset: ProjectileEffectPreset,
): void {
  const clamped = clamp01(progress);
  const burst = Math.sin(Math.PI * clamped);
  const fade = 1 - clamped * 0.5;
  const radius = 10 + preset.impactRadius * burst;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGlowCircle(ctx, target.x, target.y, radius * 1.7, rgba(preset.palette.outer, 0.18 * fade));
  drawGlowCircle(ctx, target.x, target.y, radius, rgba(preset.palette.impact, 0.55 * fade));
  drawGlowCircle(ctx, target.x, target.y, radius * 0.34, rgba(preset.palette.core, 0.92 * fade));

  for (let index = 0; index < preset.impactRayCount; index += 1) {
    const angle = index * (TAU / preset.impactRayCount) + Math.sin(now * 0.005 + index) * 0.16;
    const length = 12 + burst * (18 + (index % 4) * 6);
    ctx.strokeStyle = rgba(preset.palette.particle, 0.72 * fade);
    ctx.lineWidth = 1.2 + (index % 3) * 0.5;
    ctx.beginPath();
    ctx.moveTo(target.x - geometry.ux * 2, target.y - geometry.uy * 2);
    ctx.lineTo(target.x + Math.cos(angle) * length, target.y + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.restore();
}

function createParticle(
  position: BattleMoveVfxPoint,
  geometry: ProjectileGeometry,
  preset: ProjectileEffectPreset,
): ProjectileParticle {
  const lateral = (Math.random() - 0.5) * 44;
  const backwards = 18 + Math.random() * 52;
  const kind = preset.particleKind;

  return {
    x: position.x + geometry.px * (Math.random() - 0.5) * preset.radius,
    y: position.y + geometry.py * (Math.random() - 0.5) * preset.radius,
    vx: -geometry.ux * backwards + geometry.px * lateral,
    vy: -geometry.uy * backwards + geometry.py * lateral + (kind === "ember" ? -16 : 0),
    age: 0,
    life: kind === "wisp" ? 0.55 + Math.random() * 0.4 : 0.3 + Math.random() * 0.35,
    size: 1.5 + Math.random() * (kind === "sludge" ? 4.8 : 3.2),
    kind,
  };
}

function updateParticles(
  particles: ProjectileParticle[],
  deltaSeconds: number,
): void {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];

    if (!particle) {
      continue;
    }

    particle.age += deltaSeconds;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;

    if (particle.kind === "ember") {
      particle.vy -= 12 * deltaSeconds;
    } else if (particle.kind === "sludge") {
      particle.vy += 38 * deltaSeconds;
    } else if (particle.kind === "leaf" || particle.kind === "spore") {
      particle.vy += 20 * deltaSeconds;
    } else {
      particle.vx *= Math.pow(0.95, deltaSeconds * 60);
      particle.vy *= Math.pow(0.95, deltaSeconds * 60);
    }

    if (particle.age >= particle.life) {
      particles.splice(index, 1);
    }
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly ProjectileParticle[],
  preset: ProjectileEffectPreset,
): void {
  for (const particle of particles) {
    const lifeProgress = clamp01(particle.age / particle.life);
    const alpha = 1 - lifeProgress;

    ctx.save();
    ctx.globalCompositeOperation = particle.kind === "sludge" ? "source-over" : "lighter";

    if (particle.kind === "leaf") {
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.age * 8);
      ctx.fillStyle = rgba(preset.palette.particle, 0.72 * alpha);
      ctx.beginPath();
      ctx.ellipse(0, 0, particle.size * 1.7, particle.size * 0.65, 0.45, 0, TAU);
      ctx.fill();
    } else {
      drawGlowCircle(
        ctx,
        particle.x,
        particle.y,
        particle.size * (1 + lifeProgress * 0.5),
        rgba(preset.palette.particle, (particle.kind === "sludge" ? 0.55 : 0.72) * alpha),
      );
    }

    ctx.restore();
  }
}

function drawReducedMotionProjectile(
  ctx: CanvasRenderingContext2D,
  geometry: ProjectileGeometry,
  realTarget: BattleMoveVfxPoint,
  missed: boolean,
  preset: ProjectileEffectPreset,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(preset.palette.trail, 0.56);
  ctx.lineWidth = Math.max(3, preset.trailWidth * 0.65);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(geometry.source.x, geometry.source.y);
  ctx.lineTo(geometry.target.x, geometry.target.y);
  ctx.stroke();
  drawGlowCircle(
    ctx,
    geometry.target.x,
    geometry.target.y,
    preset.radius * 1.4,
    rgba(preset.palette.inner, 0.78),
  );

  if (!missed) {
    drawGlowCircle(
      ctx,
      realTarget.x,
      realTarget.y,
      preset.impactRadius * 0.75,
      rgba(preset.palette.impact, 0.6),
    );
  }
  ctx.restore();
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

function easeInOutCubic(value: number): number {
  const clamped = clamp01(value);
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
