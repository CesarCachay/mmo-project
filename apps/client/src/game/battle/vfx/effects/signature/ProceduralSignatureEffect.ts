import type {
  BattleMoveVfxPoint,
  BattleMoveVfxRenderRequest,
} from "../../battle-move-vfx.types";
import {
  getSignatureEffectPreset,
  type SignatureEffectPreset,
} from "./signature-effect.presets";

interface ProceduralSignatureEffectInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

interface Vector {
  readonly dx: number;
  readonly dy: number;
  readonly length: number;
  readonly nx: number;
  readonly ny: number;
  readonly px: number;
  readonly py: number;
}

const TAU = Math.PI * 2;

export async function playProceduralSignatureEffect(
  input: ProceduralSignatureEffectInput,
): Promise<void> {
  const { ctx, width, height, request, isCancelled } = input;
  if (request.definition.archetype !== "signature") return;

  const preset = getSignatureEffectPreset(request.definition.presetId);
  const target = resolveTarget(request.source, request.target, Boolean(request.missed));
  const vector = getVector(request.source, target);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  if (vector.length <= 1) return;

  if (reduced) {
    drawReduced(ctx, request.source, target, preset, Boolean(request.missed));
    await delay(Math.min(190, request.definition.durationMs));
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const actorMotion = playActorMotionIfNeeded(request, target, preset);
  const canvasMotion = animate({
    ctx,
    width,
    height,
    source: request.source,
    target,
    missed: Boolean(request.missed),
    durationMs: request.definition.durationMs,
    preset,
    vector,
    isCancelled,
  });

  await Promise.all([actorMotion, canvasMotion]);
}

function playActorMotionIfNeeded(
  request: BattleMoveVfxRenderRequest,
  target: BattleMoveVfxPoint,
  preset: SignatureEffectPreset,
): Promise<void> {
  const actor = request.actorMotion;
  if (!actor) return Promise.resolve();

  if (preset.style === "brave-bird") {
    return actor.playContactMotion({
      target,
      durationMs: request.definition.durationMs,
      windupEnd: 0.14,
      dashEnd: 0.62,
      impactHoldEnd: 0.76,
      travelRatio: 0.82,
      windupDistance: 12,
      arcHeight: 24,
      style: "reckless",
    });
  }

  if (preset.style === "close-combat") {
    return actor.playContactMotion({
      target,
      durationMs: request.definition.durationMs,
      windupEnd: 0.12,
      dashEnd: 0.44,
      impactHoldEnd: 0.72,
      travelRatio: 0.72,
      windupDistance: 10,
      arcHeight: 4,
      style: "dash",
    });
  }

  if (preset.style === "shadow-force") {
    return actor.playContactMotion({
      target,
      durationMs: request.definition.durationMs,
      windupEnd: 0.34,
      dashEnd: 0.7,
      impactHoldEnd: 0.82,
      travelRatio: 0.78,
      windupDistance: 4,
      arcHeight: 9,
      style: "reckless",
    });
  }

  if (preset.style === "flame-wheel-retro") {
    return actor.playContactMotion({
      target,
      durationMs: request.definition.durationMs,
      windupEnd: 0.18,
      dashEnd: 0.7,
      impactHoldEnd: 0.8,
      travelRatio: 0.8,
      windupDistance: 10,
      arcHeight: 3,
      style: "reckless",
    });
  }

  if (preset.style === "quick-attack-retro") {
    return actor.playContactMotion({
      target,
      durationMs: request.definition.durationMs,
      windupEnd: 0.08,
      dashEnd: 0.54,
      impactHoldEnd: 0.64,
      travelRatio: 0.9,
      windupDistance: 6,
      arcHeight: 0,
      style: "dash",
    });
  }

  if (preset.style === "rage-retro") {
    return actor.playContactMotion({
      target,
      durationMs: request.definition.durationMs,
      windupEnd: 0.28,
      dashEnd: 0.68,
      impactHoldEnd: 0.78,
      travelRatio: 0.74,
      windupDistance: 9,
      arcHeight: 2,
      style: "reckless",
    });
  }

  if (preset.style === "fly-retro") {
    return actor.playContactMotion({
      target,
      durationMs: request.definition.durationMs,
      windupEnd: 0.18,
      dashEnd: 0.68,
      impactHoldEnd: 0.8,
      travelRatio: 0.84,
      windupDistance: 12,
      arcHeight: 28,
      style: "reckless",
    });
  }

  if (preset.style === "strength-retro") {
    return actor.playContactMotion({
      target,
      durationMs: request.definition.durationMs,
      windupEnd: 0.16,
      dashEnd: 0.62,
      impactHoldEnd: 0.76,
      travelRatio: 0.74,
      windupDistance: 10,
      arcHeight: 2,
      style: "slam",
    });
  }

  if (preset.style === "rock-smash-retro") {
    return actor.playContactMotion({
      target,
      durationMs: request.definition.durationMs,
      windupEnd: 0.12,
      dashEnd: 0.54,
      impactHoldEnd: 0.7,
      travelRatio: 0.72,
      windupDistance: 8,
      arcHeight: 0,
      style: "headbutt",
    });
  }

  if (preset.style === "rock-climb-retro") {
    return actor.playContactMotion({
      target,
      durationMs: request.definition.durationMs,
      windupEnd: 0.14,
      dashEnd: 0.62,
      impactHoldEnd: 0.78,
      travelRatio: 0.76,
      windupDistance: 10,
      arcHeight: 12,
      style: "reckless",
    });
  }

  return Promise.resolve();
}

function animate(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly source: BattleMoveVfxPoint;
  readonly target: BattleMoveVfxPoint;
  readonly missed: boolean;
  readonly durationMs: number;
  readonly preset: SignatureEffectPreset;
  readonly vector: Vector;
  readonly isCancelled: () => boolean;
}): Promise<void> {
  const startedAt = performance.now();

  return new Promise<void>((resolve) => {
    const tick = (now: number): void => {
      if (input.isCancelled()) {
        input.ctx.clearRect(0, 0, input.width, input.height);
        resolve();
        return;
      }

      const progress = clamp01((now - startedAt) / input.durationMs);
      input.ctx.clearRect(0, 0, input.width, input.height);
      drawFrame(input, progress, now * 0.001);

      if (progress >= 1) {
        input.ctx.clearRect(0, 0, input.width, input.height);
        resolve();
        return;
      }

      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  });
}

function drawFrame(
  input: {
    readonly ctx: CanvasRenderingContext2D;
    readonly width: number;
    readonly height: number;
    readonly source: BattleMoveVfxPoint;
    readonly target: BattleMoveVfxPoint;
    readonly missed: boolean;
    readonly preset: SignatureEffectPreset;
    readonly vector: Vector;
  },
  progress: number,
  time: number,
): void {
  const { preset } = input;
  switch (preset.style) {
    case "lightning-bolt": drawLightningBolt(input, progress, time); return;
    case "thunder": drawThunder(input, progress, time); return;
    case "blizzard": drawBlizzard(input, progress, time); return;
    case "psychic": drawPsychic(input, progress, time); return;
    case "aura-sphere": drawOrbProjectile(input, progress, time, "aura"); return;
    case "dark-pulse": drawPulse(input, progress, time, "dark"); return;
    case "dragon-pulse": drawPulse(input, progress, time, "dragon"); return;
    case "focus-blast": drawOrbProjectile(input, progress, time, "focus"); return;
    case "brave-bird": drawBraveBird(input, progress, time); return;
    case "close-combat": drawCloseCombat(input, progress, time); return;
    case "leaf-storm": drawLeafStorm(input, progress, time); return;
    case "draco-meteor": drawDracoMeteor(input, progress, time); return;
    case "air-slash": drawAirSlash(input, progress, time); return;
    case "flash-cannon": drawFlashCannon(input, progress, time); return;
    case "stone-edge": drawStoneEdge(input, progress, time); return;
    case "shadow-force": drawShadowForce(input, progress, time); return;
    case "water-gun-retro": drawWaterGunRetro(input, progress, time); return;
    case "razor-leaf-retro": drawRazorLeafRetro(input, progress, time); return;
    case "absorb-retro": drawAbsorbRetro(input, progress, time); return;
    case "giga-drain-retro": drawGigaDrainRetro(input, progress, time); return;
    case "flame-wheel-retro": drawFlameWheelRetro(input, progress, time); return;
    case "quick-attack-retro": drawQuickAttackRetro(input, progress, time); return;
    case "scary-face-retro": drawScaryFaceRetro(input, progress, time); return;
    case "rage-retro": drawRageRetro(input, progress, time); return;
    case "vine-whip-retro": drawVineWhipRetro(input, progress, time); return;
    case "bubble-retro": drawBubbleRetro(input, progress, time); return;
    case "dragon-rage-retro": drawDragonRageRetro(input, progress, time); return;
    case "thunder-shock-retro": drawThunderShockRetro(input, progress, time); return;
    case "cut-retro": drawCutRetro(input, progress, time); return;
    case "fly-retro": drawFlyRetro(input, progress, time); return;
    case "surf-retro": drawSurfRetro(input, progress, time); return;
    case "strength-retro": drawStrengthRetro(input, progress, time); return;
    case "waterfall-retro": drawWaterfallRetro(input, progress, time); return;
    case "rock-smash-retro": drawRockSmashRetro(input, progress, time); return;
    case "whirlpool-retro": drawWhirlpoolRetro(input, progress, time); return;
    case "rock-climb-retro": drawRockClimbRetro(input, progress, time); return;
    case "defog-retro": drawDefogRetro(input, progress, time); return;
  }
}

function drawLightningBolt(
  input: FrameInput,
  progress: number,
  time: number,
): void {
  const { ctx, source, target, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  if (charge < 1) {
    drawChargeOrb(ctx, source, 12 + charge * 12, preset, charge);
    drawSparks(ctx, source, 8, 20 + charge * 16, preset.palette.primary, time);
  }

  if (progress >= preset.chargeEnd) {
    const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
    const front = lerpPoint(source, target, easeOutCubic(travel));
    drawJaggedBolt(ctx, source, front, preset, time, 1);
    if (travel > 0.55) drawJaggedBolt(ctx, source, front, preset, time + 2.1, 0.45);
  }

  if (!missed && progress >= preset.travelEnd) {
    drawElectricImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), time);
  }
}

function drawThunder(input: FrameInput, progress: number, time: number): void {
  const { ctx, width, target, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  const cloudY = Math.max(18, target.y - 150);
  ctx.save();
  ctx.fillStyle = rgba(preset.palette.shadow, 0.18 + charge * 0.28);
  for (let i = 0; i < 7; i += 1) {
    const x = target.x + (i - 3) * 22 + Math.sin(time * 2 + i) * 5;
    ctx.beginPath();
    ctx.arc(x, cloudY + Math.sin(i * 1.7) * 7, 24 + (i % 3) * 6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  if (progress >= preset.chargeEnd) {
    const strike = phase(progress, preset.chargeEnd, preset.travelEnd);
    const end = { x: target.x, y: lerp(cloudY, target.y, easeOutCubic(strike)) };
    drawJaggedBolt(ctx, { x: target.x, y: cloudY }, end, preset, time, 1.25);
    drawScreenFlash(ctx, width, input.height, preset.palette.core, Math.sin(strike * Math.PI) * 0.13);
  }
  if (!missed && progress >= preset.travelEnd) {
    drawElectricImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), time);
  }
}

function drawBlizzard(input: FrameInput, progress: number, time: number): void {
  const { ctx, width, height, source, target, vector, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const front = lerpPoint(source, target, easeOutCubic(travel));
  if (progress < preset.chargeEnd) drawChargeOrb(ctx, source, 16 + progress * 40, preset, progress / preset.chargeEnd);

  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 38; i += 1) {
    const r = pseudo(i * 17 + 3);
    const r2 = pseudo(i * 29 + 9);
    const along = clamp01(travel * 1.2 - r * 0.26);
    const center = lerpPoint(source, front, along);
    const side = (r2 - 0.5) * (90 + 70 * travel);
    const x = center.x + vector.px * side + Math.sin(time * 4 + i) * 8;
    const y = center.y + vector.py * side + Math.cos(time * 3 + i) * 6;
    const len = 9 + r * 17;
    ctx.strokeStyle = rgba(i % 3 === 0 ? preset.palette.core : preset.palette.primary, 0.25 + r * 0.55);
    ctx.lineWidth = 1 + r * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - vector.nx * len, y - vector.ny * len);
    ctx.stroke();
    if (i % 5 === 0) drawCrystal(ctx, x, y, 4 + r * 5, preset.palette.secondary, 0.55);
  }
  ctx.restore();
  if (!missed && progress >= preset.travelEnd) drawFrostImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd));
  if (travel > 0.2) drawScreenVignette(ctx, width, height, preset.palette.primary, 0.035 * travel);
}

function drawPsychic(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  drawChargeOrb(ctx, source, 10 + charge * 17, preset, charge);
  const active = phase(progress, preset.chargeEnd, preset.impactEnd);
  if (active <= 0) return;
  const center = missed ? target : input.target;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i += 1) {
    const radius = 18 + i * 14 + Math.sin(time * 4 + i) * 4 + active * 10;
    ctx.strokeStyle = rgba(i % 2 ? preset.palette.primary : preset.palette.secondary, (0.48 - i * 0.05) * (1 - Math.max(0, active - 0.72) / 0.28));
    ctx.lineWidth = 2.5 - i * 0.25;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radius * (1.1 + Math.sin(time + i) * 0.08), radius * 0.55, time * 0.45 + i * 0.7, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i += 1) {
    const a = time * (1.5 + i * 0.08) + (i / 6) * TAU;
    const radius = 34 + (i % 2) * 17;
    ctx.fillStyle = rgba(preset.palette.accent, 0.45);
    ctx.beginPath();
    ctx.arc(center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius * 0.55, 3.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawOrbProjectile(input: FrameInput, progress: number, time: number, kind: "aura" | "focus"): void {
  const { ctx, source, target, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  const baseRadius = kind === "focus" ? 25 : 18;
  if (charge < 1) {
    drawChargeOrb(ctx, source, 7 + charge * baseRadius, preset, charge);
    drawSparks(ctx, source, kind === "focus" ? 12 : 7, 20 + baseRadius * charge, preset.palette.secondary, time);
  }
  if (progress < preset.chargeEnd) return;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const pos = lerpPoint(source, target, easeInOutCubic(travel));
  drawTrail(ctx, source, pos, preset, kind === "focus" ? 16 : 10, 0.48);
  drawEnergyOrb(ctx, pos, baseRadius * (0.92 + Math.sin(time * 8) * 0.08), preset, 0.95);
  if (kind === "aura") {
    ctx.save();
    ctx.strokeStyle = rgba(preset.palette.secondary, 0.65);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, baseRadius + 8 + Math.sin(time * 10) * 3, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  if (!missed && progress >= preset.travelEnd) drawRadialImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), kind === "focus" ? 58 : 42);
}

function drawPulse(input: FrameInput, progress: number, time: number, kind: "dark" | "dragon"): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  if (charge < 1) drawChargeOrb(ctx, source, 10 + charge * 15, preset, charge);
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  if (travel > 0) {
    const count = kind === "dragon" ? 8 : 7;
    for (let i = 0; i < count; i += 1) {
      const t = clamp01(travel * 1.18 - i * 0.095);
      if (t <= 0) continue;
      const p = lerpPoint(source, target, t);
      const wave = kind === "dragon" ? Math.sin(t * 18 + time * 8) * 13 : 0;
      const x = p.x + vector.px * wave;
      const y = p.y + vector.py * wave;
      ctx.save();
      ctx.strokeStyle = rgba(i % 2 ? preset.palette.primary : preset.palette.secondary, 0.62 * (1 - i / count * 0.45));
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, 12 + i * 1.4, kind === "dark" ? 22 : 16, Math.atan2(vector.dy, vector.dx), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (!missed && progress >= preset.travelEnd) drawRadialImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), kind === "dragon" ? 48 : 43);
}

function drawBraveBird(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const front = lerpPoint(source, target, easeInCubic(travel));
  if (progress < preset.chargeEnd) drawChargeOrb(ctx, source, 12 + progress * 70, preset, progress / preset.chargeEnd);
  if (travel > 0) {
    drawTrail(ctx, source, front, preset, 24, 0.64);
    ctx.save();
    ctx.strokeStyle = rgba(preset.palette.secondary, 0.72);
    ctx.lineWidth = 4;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(front.x, front.y);
      ctx.quadraticCurveTo(front.x - vector.nx * 28 + vector.px * side * 34, front.y - vector.ny * 28 + vector.py * side * 34, front.x - vector.nx * 64 + vector.px * side * 18, front.y - vector.ny * 64 + vector.py * side * 18);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (!missed && progress >= preset.travelEnd) drawRadialImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), 60 + Math.sin(time * 6) * 3);
}

function drawCloseCombat(input: FrameInput, progress: number, time: number): void {
  const { ctx, target, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  if (charge < 1) drawChargeOrb(ctx, input.source, 12 + charge * 13, preset, charge);
  if (missed || progress < preset.travelEnd) return;
  const local = phase(progress, preset.travelEnd, preset.impactEnd);
  const hitCount = 6;
  for (let i = 0; i < hitCount; i += 1) {
    const start = i / hitCount;
    const hit = phase(local, start, Math.min(1, start + 0.28));
    if (hit <= 0 || hit >= 1) continue;
    const a = (i / hitCount) * TAU + time * 0.25;
    const p = { x: target.x + Math.cos(a) * 24, y: target.y + Math.sin(a) * 16 };
    drawRadialImpact(ctx, p, preset, hit, 22 + (i % 2) * 7);
  }
}

function drawLeafStorm(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const front = lerpPoint(source, target, easeOutCubic(travel));
  if (progress < preset.chargeEnd) drawChargeOrb(ctx, source, 12 + progress * 35, preset, progress / preset.chargeEnd);
  for (let i = 0; i < 34; i += 1) {
    const r = pseudo(i * 19 + 4);
    const t = clamp01(travel * 1.15 - r * 0.24);
    if (t <= 0) continue;
    const p = lerpPoint(source, front, t);
    const spin = time * (2.5 + r * 3) + i;
    const side = Math.sin(spin) * (18 + 42 * t);
    drawLeaf(ctx, p.x + vector.px * side, p.y + vector.py * side, 5 + r * 7, spin, i % 3 === 0 ? preset.palette.secondary : preset.palette.primary, 0.72);
  }
  if (!missed && progress >= preset.travelEnd) drawRadialImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), 52);
}

function drawDracoMeteor(input: FrameInput, progress: number, time: number): void {
  const { ctx, height, target, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  drawChargeOrb(ctx, input.source, 10 + charge * 22, preset, charge);
  const rain = phase(progress, preset.chargeEnd, preset.impactEnd);
  if (rain <= 0) return;
  for (let i = 0; i < 7; i += 1) {
    const delay = i * 0.075;
    const t = phase(rain, delay, Math.min(1, delay + 0.56));
    if (t <= 0 || t >= 1) continue;
    const offset = (pseudo(i * 33 + 5) - 0.5) * 150;
    const endX = target.x + offset;
    const startY = Math.max(-40, target.y - Math.min(height * 0.65, 240) - pseudo(i + 9) * 90);
    const x = endX - 70 + t * 70;
    const y = lerp(startY, target.y + (pseudo(i + 2) - 0.5) * 30, easeInCubic(t));
    drawTrail(ctx, { x: x - 42, y: y - 60 }, { x, y }, preset, 13, 0.6);
    drawEnergyOrb(ctx, { x, y }, 10 + pseudo(i + 4) * 8, preset, 0.9);
  }
  if (!missed && rain > 0.5) drawRadialImpact(ctx, target, preset, clamp01((rain - 0.5) / 0.5), 64 + Math.sin(time * 7) * 4);
}

function drawAirSlash(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  for (let i = 0; i < 2; i += 1) {
    const t = clamp01(travel - i * 0.08);
    if (t <= 0) continue;
    const p = lerpPoint(source, target, easeOutCubic(t));
    const side = i === 0 ? -10 : 10;
    const angle = Math.atan2(vector.dy, vector.dx) + (i === 0 ? -0.5 : 0.5);
    drawCrescent(ctx, p.x + vector.px * side, p.y + vector.py * side, 34, angle, preset.palette.core, 0.82);
  }
  if (travel > 0) drawWindLines(ctx, source, lerpPoint(source, target, travel), vector, preset, time);
  if (!missed && progress >= preset.travelEnd) drawRadialImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), 36);
}

function drawFlashCannon(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  drawChargeOrb(ctx, source, 10 + charge * 22, preset, charge);
  if (progress < preset.chargeEnd) return;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const front = lerpPoint(source, target, easeOutCubic(travel));
  drawBeam(ctx, source, front, preset, 24 + Math.sin(time * 12) * 2);
  if (!missed && progress >= preset.travelEnd) drawRadialImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), 45);
}

function drawStoneEdge(input: FrameInput, progress: number, time: number): void {
  const { ctx, target, preset, missed } = input;
  const active = phase(progress, preset.chargeEnd, preset.impactEnd);
  if (active <= 0) {
    drawChargeOrb(ctx, input.source, 10 + progress * 40, preset, progress / preset.chargeEnd);
    return;
  }
  const center = target;
  for (let i = 0; i < 6; i += 1) {
    const delay = i * 0.08;
    const t = phase(active, delay, Math.min(1, delay + 0.42));
    if (t <= 0) continue;
    const x = center.x + (i - 2.5) * 19 + Math.sin(i * 4.1) * 5;
    const baseY = center.y + 31 + (i % 2) * 8;
    const h = (22 + (i % 3) * 13) * Math.sin(Math.min(1, t) * Math.PI * 0.72);
    drawRockSpike(ctx, x, baseY, h, 10 + (i % 2) * 5, preset, 0.75);
  }
  if (!missed && active > 0.45) drawRadialImpact(ctx, center, preset, clamp01((active - 0.45) / 0.55), 43 + Math.sin(time * 5) * 2);
}

function drawShadowForce(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, preset, missed } = input;
  const vanish = phase(progress, 0, preset.chargeEnd);
  if (vanish < 1) {
    drawVortex(ctx, source, 15 + vanish * 28, preset, vanish, time);
  }
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  if (travel > 0) {
    const p = lerpPoint(source, target, easeInCubic(travel));
    drawTrail(ctx, source, p, preset, 28, 0.35);
    drawVortex(ctx, p, 12 + travel * 18, preset, 0.75, time + 1.2);
  }
  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawCrescent(ctx, target.x, target.y, 44 + hit * 20, -0.75, preset.palette.secondary, (1 - hit) * 0.8 + 0.15);
    drawRadialImpact(ctx, target, preset, hit, 58);
  }
}



function drawQuickAttackRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const fade = progress < preset.travelEnd ? 1 : clamp01(1 - phase(progress, preset.travelEnd, preset.impactEnd));

  if (progress < preset.chargeEnd) {
    drawChargeOrb(ctx, source, 10 + progress * 45, preset, Math.max(0.25, progress / preset.chargeEnd) * 0.32);
  }

  if (travel > 0) {
    const front = lerpPoint(source, target, easeOutCubic(travel));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i += 1) {
      const delay = i * 0.07;
      const t = clamp01(travel - delay);
      const p = lerpPoint(source, target, easeOutCubic(t));
      const side = (i - 3) * 4.5;
      ctx.strokeStyle = rgba(i % 2 === 0 ? preset.palette.core : preset.palette.secondary, (0.55 - i * 0.055) * fade);
      ctx.lineWidth = Math.max(1.2, 4.8 - i * 0.5);
      ctx.beginPath();
      ctx.moveTo(p.x - vector.nx * (28 + i * 8) + vector.px * side, p.y - vector.ny * (28 + i * 8) + vector.py * side);
      ctx.lineTo(p.x + vector.px * side, p.y + vector.py * side);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i += 1) {
      const t = clamp01(travel - i * 0.1);
      if (t <= 0) continue;
      const p = lerpPoint(source, target, easeOutCubic(t));
      ctx.strokeStyle = rgba(preset.palette.primary, (0.28 - i * 0.06) * fade);
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - 13 - i * 4, p.y - 18, 26 + i * 8, 36);
    }
    ctx.restore();
    drawWindLines(ctx, source, front, vector, preset, time * 1.8);
  }

  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawRadialImpact(ctx, target, preset, hit, 38);
  }
}

function drawScaryFaceRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, width, height, target, preset, missed } = input;
  const reveal = phase(progress, 0, preset.travelEnd);
  const fade = progress <= preset.impactEnd ? 1 : clamp01((1 - progress) / Math.max(0.001, 1 - preset.impactEnd));
  const center = target;

  drawScreenVignette(ctx, width, height, preset.palette.shadow, 0.12 + reveal * 0.22);
  if (missed) return;

  const pulse = 0.92 + Math.sin(time * 11) * 0.08;
  const faceRadius = (34 + reveal * 20) * pulse;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, faceRadius * 1.8);
  g.addColorStop(0, rgba(preset.palette.primary, 0.16 * fade));
  g.addColorStop(0.5, rgba(preset.palette.shadow, 0.32 * fade));
  g.addColorStop(1, rgba(preset.palette.shadow, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(center.x, center.y, faceRadius * 1.8, 0, TAU);
  ctx.fill();

  const eyeY = center.y - 10;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(center.x + side * 21, eyeY);
    ctx.rotate(side * -0.22);
    ctx.fillStyle = rgba(preset.palette.accent, 0.92 * reveal * fade);
    ctx.beginPath();
    ctx.moveTo(-13, -5);
    ctx.lineTo(13, -2);
    ctx.lineTo(6, 8);
    ctx.lineTo(-10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(preset.palette.core, 0.96 * reveal * fade);
    ctx.beginPath();
    ctx.arc(side * 2, 1, 2.8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = rgba(preset.palette.secondary, 0.72 * reveal * fade);
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(center.x - 22, center.y + 20);
  ctx.quadraticCurveTo(center.x, center.y + 34, center.x + 22, center.y + 20);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < 5; i += 1) {
    const y = center.y + 34 + i * 8 + Math.sin(time * 4 + i) * 2;
    ctx.strokeStyle = rgba(preset.palette.primary, (0.3 - i * 0.035) * reveal * fade);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x - 18 + i * 2, y);
    ctx.lineTo(center.x + 18 - i * 2, y + 4);
    ctx.stroke();
  }
}

function drawRageRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const center = travel > 0 ? lerpPoint(source, target, easeInOutCubic(travel)) : source;
  const fade = progress < preset.impactEnd ? 1 : clamp01(1 - phase(progress, preset.impactEnd, 1));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let ring = 0; ring < 3; ring += 1) {
    const r = 17 + ring * 10 + charge * 12 + Math.sin(time * (5 + ring) + ring) * 3;
    ctx.strokeStyle = rgba(ring === 0 ? preset.palette.core : preset.palette.primary, (0.6 - ring * 0.12) * fade * Math.max(0.25, charge));
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * TAU + time * 2.6;
    const r = 24 + charge * 18 + (i % 3) * 5;
    ctx.strokeStyle = rgba(i % 2 ? preset.palette.secondary : preset.palette.primary, 0.52 * fade);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x + Math.cos(angle) * (r - 8), center.y + Math.sin(angle) * (r - 8));
    ctx.lineTo(center.x + Math.cos(angle) * r, center.y + Math.sin(angle) * r);
    ctx.stroke();
  }
  ctx.restore();

  if (!missed && progress >= preset.travelEnd) {
    drawRadialImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), 46);
  }
}

function drawVineWhipRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const whipCount = 2;
  for (let i = 0; i < whipCount; i += 1) {
    const start = preset.chargeEnd + i * 0.13;
    const end = Math.min(preset.travelEnd, start + 0.42);
    const travel = phase(progress, start, end);
    if (travel <= 0) continue;
    const front = lerpPoint(source, target, easeOutCubic(travel));
    const side = i === 0 ? -1 : 1;
    const bend = 20 * side * Math.sin(travel * Math.PI);
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = rgba(preset.palette.shadow, 0.42);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y + side * 5);
    ctx.quadraticCurveTo((source.x + front.x) / 2 + vector.px * bend, (source.y + front.y) / 2 + vector.py * bend, front.x, front.y);
    ctx.stroke();
    ctx.strokeStyle = rgba(preset.palette.primary, 0.9);
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = rgba(preset.palette.secondary, 0.75);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawCrescent(ctx, target.x - 4, target.y, 31 + hit * 10, -0.65, preset.palette.core, (1 - hit) * 0.82);
    drawCrescent(ctx, target.x + 5, target.y + 3, 35 + hit * 10, 0.62, preset.palette.secondary, (1 - hit) * 0.68);
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * TAU + time;
      drawLeaf(ctx, target.x + Math.cos(angle) * (18 + hit * 24), target.y + Math.sin(angle) * (12 + hit * 18), 4.5, angle, preset.palette.primary, 0.45 * (1 - hit));
    }
  }
}

function drawBubbleRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const bubbleCount = 9;
  for (let i = 0; i < bubbleCount; i += 1) {
    const start = preset.chargeEnd + i * 0.035;
    const end = Math.min(preset.travelEnd, start + 0.5);
    const travel = phase(progress, start, end);
    if (travel <= 0 || progress > end + 0.08) continue;
    const t = easeInOutCubic(travel);
    const p = lerpPoint(source, target, t);
    const side = Math.sin(t * Math.PI * 2 + i * 1.6 + time * 2) * (5 + (i % 3) * 4);
    const x = p.x + vector.px * side;
    const y = p.y + vector.py * side - Math.sin(t * Math.PI) * (6 + (i % 2) * 4);
    const r = 5 + (i % 4) * 2;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rgba(preset.palette.primary, 0.14);
    ctx.strokeStyle = rgba(preset.palette.secondary, 0.8);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(preset.palette.core, 0.78);
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.28, Math.max(1.2, r * 0.2), 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawWaterSplash(ctx, target, vector, preset, hit, time);
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * TAU + time * 0.4;
      const r = 12 + hit * 32 + (i % 3) * 4;
      ctx.strokeStyle = rgba(preset.palette.secondary, (1 - hit) * 0.55);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(target.x + Math.cos(angle) * r, target.y + Math.sin(angle) * r * 0.65, 3 + (i % 2) * 2, 0, TAU);
      ctx.stroke();
    }
  }
}

function drawDragonRageRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  if (progress < preset.chargeEnd) {
    drawChargeOrb(ctx, source, 10 + charge * 17, preset, charge);
    drawSparks(ctx, source, 8, 18 + charge * 16, preset.palette.secondary, time * 1.2);
  }

  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  if (travel > 0) {
    const front = lerpPoint(source, target, easeOutCubic(travel));
    const segments = 10;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 0; i < segments; i += 1) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      if (t0 > travel) break;
      const a = lerpPoint(source, front, t0);
      const b = lerpPoint(source, front, Math.min(1, t1));
      const wave0 = Math.sin(t0 * 18 + time * 8) * 10 * Math.sin(t0 * Math.PI);
      const wave1 = Math.sin(t1 * 18 + time * 8) * 10 * Math.sin(t1 * Math.PI);
      ctx.strokeStyle = rgba(i % 2 ? preset.palette.primary : preset.palette.secondary, 0.72);
      ctx.lineWidth = 7 - (i % 3);
      ctx.beginPath();
      ctx.moveTo(a.x + vector.px * wave0, a.y + vector.py * wave0);
      ctx.lineTo(b.x + vector.px * wave1, b.y + vector.py * wave1);
      ctx.stroke();
    }
    ctx.restore();
    drawEnergyOrb(ctx, front, 10 + Math.sin(time * 8) * 1.5, preset, 0.8);
  }

  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawRadialImpact(ctx, target, preset, hit, 50);
    drawVortex(ctx, target, 18 + hit * 24, preset, (1 - hit) * 0.62, time * 1.4);
  }
}

function drawThunderShockRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  if (progress < preset.chargeEnd) {
    drawSparks(ctx, source, 5, 14 + charge * 8, preset.palette.primary, time * 2);
  }

  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  if (travel > 0) {
    const front = lerpPoint(source, target, easeOutCubic(travel));
    drawJaggedBolt(ctx, source, front, preset, time * 1.8, 0.6);
    if (travel > 0.35) drawJaggedBolt(ctx, source, front, preset, time * 1.8 + 1.7, 0.26);
  }

  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawElectricImpact(ctx, target, preset, hit, time * 1.5);
  }
}

function drawWaterGunRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);

  if (progress < preset.chargeEnd) {
    drawChargeOrb(ctx, source, 6 + charge * 8, preset, charge * 0.75);
  }

  const volleyStart = preset.chargeEnd;
  const pulseCount = 6;
  for (let index = 0; index < pulseCount; index += 1) {
    const start = volleyStart + index * 0.055;
    const end = Math.min(preset.travelEnd, start + 0.38);
    const travel = phase(progress, start, end);
    if (travel <= 0 || progress > end + 0.08) continue;

    const eased = easeInOutCubic(travel);
    const p = lerpPoint(source, target, eased);
    const wobble = Math.sin(eased * Math.PI * 2.4 + index * 1.7) * (2.5 + index * 0.45);
    const x = p.x + vector.px * wobble;
    const y = p.y + vector.py * wobble;
    const back = lerpPoint(source, target, Math.max(0, eased - 0.09));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba(preset.palette.primary, 0.28);
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(back.x + vector.px * wobble, back.y + vector.py * wobble);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.strokeStyle = rgba(preset.palette.secondary, 0.78);
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(back.x + vector.px * wobble, back.y + vector.py * wobble);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.fillStyle = rgba(preset.palette.core, 0.95);
    ctx.beginPath();
    ctx.ellipse(x, y, 7.5, 4.1, Math.atan2(vector.dy, vector.dx), 0, TAU);
    ctx.fill();
    ctx.restore();

    for (let drop = 0; drop < 2; drop += 1) {
      const side = (drop === 0 ? -1 : 1) * (5 + pseudo(index * 17 + drop) * 5);
      const trail = 7 + pseudo(index * 31 + drop) * 8;
      drawWaterDroplet(
        ctx,
        x - vector.nx * trail + vector.px * side,
        y - vector.ny * trail + vector.py * side,
        2.2 + pseudo(index * 43 + drop) * 1.8,
        preset.palette.secondary,
        0.55,
      );
    }
  }

  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawWaterSplash(ctx, target, vector, preset, hit, time);
  }
}

function drawRazorLeafRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);

  if (progress < preset.chargeEnd) {
    for (let i = 0; i < 5; i += 1) {
      const angle = time * 4 + (i / 5) * TAU;
      const radius = 7 + charge * 13;
      drawLeaf(
        ctx,
        source.x + Math.cos(angle) * radius,
        source.y + Math.sin(angle) * radius,
        4 + charge * 2,
        angle,
        i % 2 === 0 ? preset.palette.primary : preset.palette.secondary,
        0.65 * charge,
      );
    }
  }

  const leafCount = 6;
  for (let i = 0; i < leafCount; i += 1) {
    const start = preset.chargeEnd + i * 0.035;
    const end = Math.min(preset.travelEnd, start + 0.48);
    const travel = phase(progress, start, end);
    if (travel <= 0 || progress > end + 0.05) continue;
    const t = easeOutCubic(travel);
    const p = lerpPoint(source, target, t);
    const fan = (i - (leafCount - 1) / 2) * 7.5;
    const curve = Math.sin(t * Math.PI) * fan;
    const x = p.x + vector.px * curve;
    const y = p.y + vector.py * curve;
    const spin = time * (8 + i * 0.7) + i * 0.85;

    drawLeaf(
      ctx,
      x,
      y,
      8 + (i % 3) * 1.5,
      spin + Math.atan2(vector.dy, vector.dx),
      i % 2 === 0 ? preset.palette.primary : preset.palette.secondary,
      0.92,
    );

    ctx.save();
    ctx.strokeStyle = rgba(preset.palette.accent, 0.22);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - vector.nx * 18, y - vector.ny * 18);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
  }

  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    const fade = 1 - hit;
    drawCrescent(ctx, target.x - 5, target.y - 3, 30 + hit * 14, -0.72, preset.palette.core, 0.72 * fade);
    drawCrescent(ctx, target.x + 6, target.y + 5, 36 + hit * 12, 0.66, preset.palette.secondary, 0.58 * fade);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * TAU + time * 1.4;
      const radius = 18 + hit * 30;
      drawLeaf(ctx, target.x + Math.cos(angle) * radius, target.y + Math.sin(angle) * radius * 0.65, 4.5, angle, preset.palette.primary, 0.48 * fade);
    }
  }
}

function drawAbsorbRetro(input: FrameInput, progress: number, time: number): void {
  drawDrainRetro(input, progress, time, false);
}

function drawGigaDrainRetro(input: FrameInput, progress: number, time: number): void {
  drawDrainRetro(input, progress, time, true);
}

function drawDrainRetro(input: FrameInput, progress: number, time: number, giga: boolean): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const gather = phase(progress, 0, preset.chargeEnd + 0.08);
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const fade = progress <= preset.impactEnd ? 1 : clamp01((1 - progress) / Math.max(0.001, 1 - preset.impactEnd));
  const moteCount = giga ? 14 : 7;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (gather > 0) {
    const ringCount = giga ? 3 : 1;
    for (let ring = 0; ring < ringCount; ring += 1) {
      const radius = (18 + ring * 11) * gather;
      ctx.strokeStyle = rgba(ring % 2 === 0 ? preset.palette.secondary : preset.palette.accent, (0.48 - ring * 0.08) * fade);
      ctx.lineWidth = giga ? 2.2 : 1.7;
      ctx.beginPath();
      ctx.ellipse(target.x, target.y, radius, radius * 0.52, time * (0.8 + ring * 0.25), 0, TAU);
      ctx.stroke();
    }
  }

  for (let i = 0; i < moteCount; i += 1) {
    const stagger = i / moteCount * (giga ? 0.34 : 0.26);
    const local = clamp01((travel - stagger) / Math.max(0.01, 1 - stagger));
    if (local <= 0) {
      const orbit = 18 + pseudo(i * 37 + 5) * (giga ? 34 : 21);
      const angle = time * (1.6 + pseudo(i * 17 + 3)) + i * 2.399;
      drawEnergyMote(
        ctx,
        target.x + Math.cos(angle) * orbit,
        target.y + Math.sin(angle) * orbit * 0.58,
        giga ? 3.2 : 2.5,
        i % 3 === 0 ? preset.palette.core : preset.palette.secondary,
        0.58 * gather,
      );
      continue;
    }

    const eased = easeInOutCubic(local);
    const p = lerpPoint(target, source, eased);
    const sideAmplitude = (giga ? 24 : 12) * (0.45 + pseudo(i * 19 + 2) * 0.7);
    const side = Math.sin(eased * Math.PI * 2 + i * 1.35 + time * 3) * sideAmplitude * Math.sin(eased * Math.PI);
    const x = p.x - vector.px * side;
    const y = p.y - vector.py * side;

    drawEnergyMote(
      ctx,
      x,
      y,
      (giga ? 4 : 2.8) + pseudo(i * 31 + 9) * (giga ? 3.2 : 1.8),
      i % 4 === 0 ? preset.palette.core : (i % 2 === 0 ? preset.palette.secondary : preset.palette.primary),
      0.88 * fade,
    );

    if (giga && i % 2 === 0) {
      const trailBack = lerpPoint(target, source, Math.max(0, eased - 0.07));
      ctx.strokeStyle = rgba(preset.palette.primary, 0.2 * fade);
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(trailBack.x, trailBack.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  ctx.restore();

  if (!missed && travel > (giga ? 0.42 : 0.56)) {
    const receive = clamp01((travel - (giga ? 0.42 : 0.56)) / (giga ? 0.58 : 0.44));
    drawHealingPulse(ctx, source, preset, receive, giga ? 54 : 34, giga ? 3 : 1, time);
  }
}

function drawFlameWheelRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const center = travel > 0 ? lerpPoint(source, target, easeInOutCubic(travel)) : source;
  const active = progress < preset.travelEnd ? 1 : clamp01(1 - phase(progress, preset.travelEnd, preset.impactEnd));
  const radius = 20 + charge * 17 + (travel > 0 ? 7 : 0);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 1.7);
  glow.addColorStop(0, rgba(preset.palette.core, 0.34 * active));
  glow.addColorStop(0.45, rgba(preset.palette.primary, 0.2 * active));
  glow.addColorStop(1, rgba(preset.palette.primary, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 1.7, 0, TAU);
  ctx.fill();

  for (let ring = 0; ring < 3; ring += 1) {
    ctx.strokeStyle = rgba(ring === 0 ? preset.palette.core : (ring === 1 ? preset.palette.secondary : preset.palette.primary), (0.86 - ring * 0.18) * active);
    ctx.lineWidth = 5 - ring;
    ctx.lineCap = "round";
    ctx.beginPath();
    const start = time * (7.5 + ring * 1.8) + ring * 1.7;
    ctx.arc(center.x, center.y, radius + ring * 5, start, start + Math.PI * (1.15 + ring * 0.18));
    ctx.stroke();
  }

  for (let i = 0; i < 11; i += 1) {
    const angle = time * 8 + (i / 11) * TAU;
    const flameRadius = radius + 5 + (i % 3) * 4;
    const fx = center.x + Math.cos(angle) * flameRadius;
    const fy = center.y + Math.sin(angle) * flameRadius;
    drawFlameTongue(ctx, fx, fy, 5 + (i % 3) * 2, angle, i % 2 === 0 ? preset.palette.secondary : preset.palette.primary, active);
  }

  if (travel > 0) {
    for (let i = 0; i < 10; i += 1) {
      const lag = (i + 1) * 0.045;
      const t = Math.max(0, easeInOutCubic(travel) - lag);
      const p = lerpPoint(source, target, t);
      const side = (pseudo(i * 23 + 7) - 0.5) * 18;
      drawEnergyMote(ctx, p.x + vector.px * side, p.y + vector.py * side, 2 + (i % 3), i % 2 ? preset.palette.primary : preset.palette.secondary, (1 - i / 12) * 0.62 * active);
    }
  }
  ctx.restore();

  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawRadialImpact(ctx, target, preset, hit, 52);
    const fade = 1 - hit;
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * TAU + time * 1.3;
      drawFlameTongue(ctx, target.x + Math.cos(angle) * (18 + hit * 28), target.y + Math.sin(angle) * (18 + hit * 28), 5 + (i % 3) * 2, angle, preset.palette.secondary, fade * 0.75);
    }
  }
}

function drawWaterSplash(
  ctx: CanvasRenderingContext2D,
  target: BattleMoveVfxPoint,
  vector: Vector,
  preset: SignatureEffectPreset,
  progress: number,
  time: number,
): void {
  const fade = 1 - progress;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = rgba(preset.palette.secondary, 0.72 * fade);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(target.x, target.y + 3, 14 + progress * 25, 7 + progress * 12, 0, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 9; i += 1) {
    const angle = -Math.PI * 0.9 + (i / 8) * Math.PI * 1.8 + Math.sin(time * 2 + i) * 0.05;
    const distance = 9 + progress * (28 + (i % 3) * 6);
    drawWaterDroplet(ctx, target.x + Math.cos(angle) * distance - vector.nx * progress * 6, target.y + Math.sin(angle) * distance - vector.ny * progress * 6, 2.4 + (i % 3), i % 2 ? preset.palette.primary : preset.palette.core, fade * 0.8);
  }
  ctx.restore();
}

function drawWaterDroplet(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number): void {
  ctx.save();
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, size, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawEnergyMote(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.8);
  glow.addColorStop(0, rgba(color, alpha));
  glow.addColorStop(0.35, rgba(color, alpha * 0.55));
  glow.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(color, Math.min(1, alpha + 0.12));
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawHealingPulse(ctx: CanvasRenderingContext2D, source: BattleMoveVfxPoint, preset: SignatureEffectPreset, progress: number, radius: number, rings: number, time: number): void {
  const fade = 1 - progress * 0.72;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let ring = 0; ring < rings; ring += 1) {
    const local = clamp01(progress - ring * 0.12);
    if (local <= 0) continue;
    ctx.strokeStyle = rgba(ring % 2 === 0 ? preset.palette.secondary : preset.palette.accent, 0.56 * (1 - local) * fade);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(source.x, source.y, 12 + local * radius, 7 + local * radius * 0.48, time * 0.35 + ring, 0, TAU);
    ctx.stroke();
  }
  drawChargeOrb(ctx, source, 13 + progress * 18, preset, 0.48 * fade);
  ctx.restore();
}

function drawFlameTongue(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, color: string, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(size * 1.8, 0);
  ctx.quadraticCurveTo(size * 0.15, -size * 0.9, -size * 0.8, 0);
  ctx.quadraticCurveTo(size * 0.15, size * 0.9, size * 1.8, 0);
  ctx.fill();
  ctx.restore();
}


type FrameInput = {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly source: BattleMoveVfxPoint;
  readonly target: BattleMoveVfxPoint;
  readonly missed: boolean;
  readonly preset: SignatureEffectPreset;
  readonly vector: Vector;
};

function drawChargeOrb(ctx: CanvasRenderingContext2D, p: BattleMoveVfxPoint, radius: number, preset: SignatureEffectPreset, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
  g.addColorStop(0, rgba(preset.palette.core, 0.82 * alpha));
  g.addColorStop(0.45, rgba(preset.palette.primary, 0.48 * alpha));
  g.addColorStop(1, rgba(preset.palette.primary, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawEnergyOrb(ctx: CanvasRenderingContext2D, p: BattleMoveVfxPoint, radius: number, preset: SignatureEffectPreset, alpha: number): void {
  drawChargeOrb(ctx, p, radius * 1.65, preset, alpha * 0.75);
  ctx.save();
  ctx.fillStyle = rgba(preset.palette.core, alpha);
  ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.48, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(preset.palette.secondary, alpha * 0.85);
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.stroke();
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, a: BattleMoveVfxPoint, b: BattleMoveVfxPoint, preset: SignatureEffectPreset, width: number, alpha: number): void {
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, rgba(preset.palette.primary, 0));
  g.addColorStop(0.6, rgba(preset.palette.primary, alpha * 0.48));
  g.addColorStop(1, rgba(preset.palette.core, alpha));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = g;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.restore();
}

function drawBeam(ctx: CanvasRenderingContext2D, a: BattleMoveVfxPoint, b: BattleMoveVfxPoint, preset: SignatureEffectPreset, width: number): void {
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  ctx.strokeStyle = rgba(preset.palette.primary, 0.28); ctx.lineWidth = width * 1.7; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = rgba(preset.palette.secondary, 0.78); ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = rgba(preset.palette.core, 0.95); ctx.lineWidth = Math.max(3, width * 0.24); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.restore();
}

function drawJaggedBolt(ctx: CanvasRenderingContext2D, a: BattleMoveVfxPoint, b: BattleMoveVfxPoint, preset: SignatureEffectPreset, time: number, strength: number): void {
  const v = getVector(a, b); if (v.length < 2) return;
  const points: BattleMoveVfxPoint[] = [a];
  const segments = 9;
  for (let i = 1; i < segments; i += 1) {
    const t = i / segments;
    const base = lerpPoint(a, b, t);
    const jitter = (pseudo(i * 23 + Math.floor(time * 22)) - 0.5) * 24 * strength * Math.sin(t * Math.PI);
    points.push({ x: base.x + v.px * jitter, y: base.y + v.py * jitter });
  }
  points.push(b);
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineJoin = "round";
  for (const [color, width, alpha] of [[preset.palette.primary, 9 * strength, 0.25], [preset.palette.secondary, 4.5 * strength, 0.82], [preset.palette.core, 1.7 * strength, 1]] as const) {
    ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (const p of points.slice(1)) ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  ctx.restore();
}

function drawElectricImpact(ctx: CanvasRenderingContext2D, p: BattleMoveVfxPoint, preset: SignatureEffectPreset, progress: number, time: number): void {
  drawRadialImpact(ctx, p, preset, progress, 50);
  const fade = 1 - progress;
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * TAU + time;
    const end = { x: p.x + Math.cos(angle) * (24 + progress * 36), y: p.y + Math.sin(angle) * (24 + progress * 36) };
    drawJaggedBolt(ctx, p, end, preset, time + i, 0.35 * fade + 0.2);
  }
}

function drawRadialImpact(ctx: CanvasRenderingContext2D, p: BattleMoveVfxPoint, preset: SignatureEffectPreset, progress: number, radius: number): void {
  const appear = clamp01(progress / 0.25);
  const fade = clamp01(1 - Math.max(0, progress - 0.45) / 0.55);
  const alpha = appear * fade;
  const r = radius * (0.45 + progress * 0.75);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  g.addColorStop(0, rgba(preset.palette.core, 0.95 * alpha));
  g.addColorStop(0.38, rgba(preset.palette.primary, 0.64 * alpha));
  g.addColorStop(1, rgba(preset.palette.primary, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * TAU + pseudo(i + 7) * 0.2;
    ctx.strokeStyle = rgba(i % 2 ? preset.palette.secondary : preset.palette.accent, alpha * 0.68);
    ctx.lineWidth = 1.5 + (i % 3);
    ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r * 0.35, p.y + Math.sin(a) * r * 0.35); ctx.lineTo(p.x + Math.cos(a) * r * 1.2, p.y + Math.sin(a) * r * 1.2); ctx.stroke();
  }
  ctx.restore();
}

function drawFrostImpact(ctx: CanvasRenderingContext2D, p: BattleMoveVfxPoint, preset: SignatureEffectPreset, progress: number): void {
  drawRadialImpact(ctx, p, preset, progress, 46);
  const fade = 1 - progress;
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * TAU;
    drawCrystal(ctx, p.x + Math.cos(a) * (22 + progress * 25), p.y + Math.sin(a) * (16 + progress * 20), 7 + (i % 3) * 3, preset.palette.core, fade * 0.8);
  }
}

function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = rgba(color, alpha); ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.48, 0); ctx.lineTo(0, size); ctx.lineTo(-size * 0.48, 0); ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, color: string, alpha: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.fillStyle = rgba(color, alpha); ctx.beginPath(); ctx.moveTo(-size, 0); ctx.quadraticCurveTo(0, -size * 0.7, size, 0); ctx.quadraticCurveTo(0, size * 0.7, -size, 0); ctx.fill(); ctx.restore();
}

function drawCrescent(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number, color: string, alpha: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = Math.max(3, radius * 0.15); ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(0, 0, radius, -0.95, 0.95); ctx.stroke(); ctx.restore();
}

function drawRockSpike(ctx: CanvasRenderingContext2D, x: number, baseY: number, height: number, halfWidth: number, preset: SignatureEffectPreset, alpha: number): void {
  ctx.save(); ctx.fillStyle = rgba(preset.palette.primary, alpha); ctx.strokeStyle = rgba(preset.palette.core, alpha * 0.55); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - halfWidth, baseY); ctx.lineTo(x - halfWidth * 0.25, baseY - height * 0.76); ctx.lineTo(x, baseY - height); ctx.lineTo(x + halfWidth * 0.35, baseY - height * 0.58); ctx.lineTo(x + halfWidth, baseY); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawVortex(ctx: CanvasRenderingContext2D, p: BattleMoveVfxPoint, radius: number, preset: SignatureEffectPreset, alpha: number, time: number): void {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 4; i += 1) {
    ctx.strokeStyle = rgba(i % 2 ? preset.palette.primary : preset.palette.secondary, alpha * (0.55 - i * 0.08)); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, radius + i * 6, (radius + i * 6) * 0.45, time * (0.7 + i * 0.1) + i, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawWindLines(ctx: CanvasRenderingContext2D, a: BattleMoveVfxPoint, b: BattleMoveVfxPoint, vector: Vector, preset: SignatureEffectPreset, time: number): void {
  ctx.save(); ctx.strokeStyle = rgba(preset.palette.primary, 0.34); ctx.lineWidth = 1.5;
  for (let i = 0; i < 7; i += 1) {
    const t = pseudo(i * 11 + 3); const p = lerpPoint(a, b, t); const side = (pseudo(i * 17 + 7) - 0.5) * 45; const wobble = Math.sin(time * 4 + i) * 6;
    ctx.beginPath(); ctx.moveTo(p.x + vector.px * side, p.y + vector.py * side); ctx.lineTo(p.x - vector.nx * (24 + i * 2) + vector.px * (side + wobble), p.y - vector.ny * (24 + i * 2) + vector.py * (side + wobble)); ctx.stroke();
  }
  ctx.restore();
}

function drawSparks(ctx: CanvasRenderingContext2D, p: BattleMoveVfxPoint, count: number, radius: number, color: string, time: number): void {
  ctx.save(); ctx.fillStyle = rgba(color, 0.72);
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * TAU + time * (0.8 + i * 0.02); const r = radius * (0.55 + pseudo(i + 4) * 0.45);
    ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 1.5 + pseudo(i + 7) * 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawScreenFlash(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, alpha: number): void {
  if (alpha <= 0) return; ctx.save(); ctx.fillStyle = rgba(color, alpha); ctx.fillRect(0, 0, width, height); ctx.restore();
}

function drawScreenVignette(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.18, width / 2, height / 2, Math.max(width, height) * 0.7);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, alpha)); ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, width, height); ctx.restore();
}


function drawCutRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const center = lerpPoint(source, target, easeOutCubic(Math.max(0.15, travel)));
  if (travel > 0) {
    for (let i = 0; i < 3; i += 1) {
      const slashT = clamp01((travel - i * 0.08) / (1 - i * 0.08));
      if (slashT <= 0) continue;
      const offset = (i - 1) * 10;
      const len = 28 + slashT * 22;
      ctx.save();
      ctx.translate(center.x + offset, center.y - offset * 0.7);
      ctx.rotate(-0.82 + i * 0.18);
      ctx.strokeStyle = rgba(i === 1 ? preset.palette.core : preset.palette.secondary, 0.82 - i * 0.16);
      ctx.lineWidth = 4 - i * 0.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-len * 0.5, -6);
      ctx.lineTo(len * 0.5, 6);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (!missed && progress >= preset.travelEnd) drawRadialImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), 34);
}

function drawFlyRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const charge = phase(progress, 0, preset.chargeEnd);
  if (charge < 1) {
    for (const side of [-1, 1]) {
      drawCrescent(ctx, source.x + side * 8, source.y - 8, 16 + charge * 16, side * -0.7, side < 0 ? preset.palette.secondary : preset.palette.core, 0.42 + charge * 0.25);
    }
    drawWindLines(ctx, { x: source.x - 14, y: source.y + 10 }, { x: source.x + 14, y: source.y - 10 }, vector, preset, time);
  }
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  if (travel > 0) {
    const p = lerpPoint(source, target, easeInOutCubic(travel));
    const arc = Math.sin(travel * Math.PI) * 48;
    const airborne = { x: p.x, y: p.y - arc };
    drawTrail(ctx, source, airborne, preset, 24, 0.42);
    for (let i = 0; i < 3; i += 1) {
      const feather = lerpPoint(source, airborne, clamp01(travel - i * 0.08));
      drawLeaf(ctx, feather.x - vector.px * 5 * i, feather.y - vector.py * 5 * i, 9 - i, time * 2.5 + i, i % 2 ? preset.palette.secondary : preset.palette.core, 0.35 - i * 0.07);
    }
  }
  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawRadialImpact(ctx, target, preset, hit, 44);
    for (let i = 0; i < 4; i += 1) drawCrescent(ctx, target.x, target.y, 26 + hit * 18 + i * 6, -0.75 + i * 0.45, i % 2 ? preset.palette.secondary : preset.palette.core, 0.34 * (1 - hit));
  }
}

function drawSurfRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  if (progress < preset.chargeEnd) {
    drawChargeOrb(ctx, source, 18 + progress * 55, preset, 0.22 + progress * 0.28);
  }
  if (travel > 0) {
    const front = lerpPoint(source, target, easeOutCubic(travel));
    const crest = 34 + travel * 22;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i += 1) {
      const back = { x: front.x - vector.nx * (46 + i * 18), y: front.y - vector.ny * (46 + i * 18) };
      ctx.strokeStyle = rgba(i === 0 ? preset.palette.primary : i === 1 ? preset.palette.secondary : preset.palette.core, 0.36 + i * 0.12);
      ctx.lineWidth = 18 - i * 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(back.x - vector.px * (10 + i * 4), back.y - vector.py * (10 + i * 4));
      ctx.quadraticCurveTo((back.x + front.x) / 2 + vector.px * crest, (back.y + front.y) / 2 + vector.py * crest, front.x + vector.px * 18, front.y + vector.py * 18);
      ctx.stroke();
    }
    for (let i = 0; i < 10; i += 1) {
      const t = i / 9;
      const p = lerpPoint({ x: front.x - vector.nx * 42, y: front.y - vector.ny * 42 }, front, t);
      ctx.fillStyle = rgba(preset.palette.core, 0.25);
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(time * 5 + i) * 3, p.y + Math.cos(time * 4 + i) * 2, 2 + (i % 3), 0, TAU);
      ctx.fill();
    }
  }
  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawRadialImpact(ctx, target, preset, hit, 60);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI - Math.PI * 0.92;
      const r = 28 + hit * 36;
      ctx.strokeStyle = rgba(i % 2 ? preset.palette.secondary : preset.palette.core, 0.4 * (1 - hit));
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(target.x + Math.cos(a) * (r * 0.45), target.y + 10 + Math.sin(a) * (r * 0.2));
      ctx.lineTo(target.x + Math.cos(a) * r, target.y - 8 + Math.sin(a) * (r * 0.85));
      ctx.stroke();
    }
  }
}

function drawStrengthRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  const p = travel > 0 ? lerpPoint(source, target, easeInOutCubic(travel)) : source;
  if (progress < preset.chargeEnd) {
    for (let i = 0; i < 4; i += 1) drawChargeOrb(ctx, source, 10 + i * 4 + progress * 24, preset, 0.09 + i * 0.04);
  }
  if (travel > 0) {
    drawTrail(ctx, source, p, preset, 18, 0.18);
    for (let i = 0; i < 5; i += 1) {
      const dust = lerpPoint(source, p, clamp01(travel - i * 0.09));
      ctx.fillStyle = rgba(preset.palette.secondary, 0.16);
      ctx.fillRect(dust.x - 5 + i * 2, dust.y + 14 - i, 8 + i, 4 + i * 0.6);
    }
  }
  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    drawRadialImpact(ctx, target, preset, hit, 48);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU + time * 0.5;
      drawRockSpike(ctx, target.x + Math.cos(a) * 8, target.y + 22 + Math.sin(a) * 5, 14 + hit * 18, 5 + (i % 2) * 2, preset, 0.34 * (1 - hit));
    }
  }
}

function drawWaterfallRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  if (travel > 0) {
    const front = lerpPoint(source, target, easeOutCubic(travel));
    drawTrail(ctx, source, front, preset, 12, 0.24);
  }
  if (progress >= preset.travelEnd * 0.65) {
    const rise = phase(progress, preset.travelEnd * 0.65, preset.impactEnd);
    const h = 18 + rise * 70;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i += 1) {
      ctx.strokeStyle = rgba(i === 0 ? preset.palette.primary : i === 1 ? preset.palette.secondary : preset.palette.core, 0.3 + i * 0.15);
      ctx.lineWidth = 16 - i * 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(target.x + (i - 1) * 5, target.y + 14);
      ctx.lineTo(target.x + (i - 1) * 7, target.y + 14 - h);
      ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < 7; i += 1) {
      ctx.fillStyle = rgba(preset.palette.core, 0.36 * (1 - rise));
      ctx.beginPath();
      ctx.arc(target.x + (i - 3) * 5, target.y + 10 - rise * 40 - Math.sin(time * 5 + i) * 4, 2 + (i % 2), 0, TAU);
      ctx.fill();
    }
  }
  if (!missed && progress >= preset.travelEnd) drawRadialImpact(ctx, target, preset, phase(progress, preset.travelEnd, preset.impactEnd), 52);
}

function drawRockSmashRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, target, preset, missed } = input;
  if (!missed && progress >= preset.travelEnd * 0.7) {
    const hit = phase(progress, preset.travelEnd * 0.7, preset.impactEnd);
    drawRadialImpact(ctx, target, preset, hit, 42);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU + 0.2;
      const d = 8 + hit * 30;
      drawRockSpike(ctx, target.x + Math.cos(a) * d * 0.45, target.y + 10 + Math.sin(a) * d * 0.25, 9 + (i % 3) * 4 + hit * 6, 4 + (i % 2), preset, 0.5 * (1 - hit));
    }
  }
}

function drawWhirlpoolRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, vector, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd * 0.72);
  if (travel > 0) {
    const front = lerpPoint(source, target, easeInOutCubic(travel));
    drawTrail(ctx, source, front, preset, 16, 0.18);
  }
  const active = phase(progress, preset.chargeEnd, preset.impactEnd);
  if (!missed && active > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let ring = 0; ring < 4; ring += 1) {
      const radius = 12 + ring * 9 + active * 10;
      ctx.strokeStyle = rgba(ring % 2 === 0 ? preset.palette.primary : preset.palette.secondary, 0.45 - ring * 0.08);
      ctx.lineWidth = 3 - ring * 0.35;
      ctx.beginPath();
      ctx.ellipse(target.x, target.y, radius, radius * 0.55, time * (1.8 + ring * 0.2) + ring, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < 11; i += 1) {
      const ang = time * 2.2 + i * 0.58;
      const r = 8 + (i % 4) * 5 + active * 16;
      ctx.fillStyle = rgba(i % 2 ? preset.palette.core : preset.palette.secondary, 0.24);
      ctx.beginPath();
      ctx.arc(target.x + Math.cos(ang) * r, target.y + Math.sin(ang) * r * 0.55, 1.8 + (i % 3), 0, TAU);
      ctx.fill();
    }
  }
}

function drawRockClimbRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, source, target, preset, missed } = input;
  const travel = phase(progress, preset.chargeEnd, preset.travelEnd);
  if (travel > 0) drawTrail(ctx, source, lerpPoint(source, target, easeOutCubic(travel)), preset, 18, 0.2);
  if (!missed && progress >= preset.travelEnd * 0.72) {
    const hit = phase(progress, preset.travelEnd * 0.72, preset.impactEnd);
    drawRadialImpact(ctx, target, preset, hit, 48);
    for (let i = 0; i < 5; i += 1) {
      const x = target.x + (i - 2) * 12;
      drawRockSpike(ctx, x, target.y + 24, 16 + Math.sin(hit * Math.PI) * (24 + i * 3), 6 + (i % 2) * 2, preset, 0.45 * (1 - hit) + 0.18);
    }
  }
}

function drawDefogRetro(input: FrameInput, progress: number, time: number): void {
  const { ctx, width, height, source, target, vector, preset, missed } = input;
  const active = phase(progress, 0, preset.impactEnd);
  drawScreenVignette(ctx, width, height, preset.palette.shadow, 0.06 * (1 - active));
  const sweepFront = lerpPoint(source, target, easeOutCubic(Math.max(0.08, phase(progress, preset.chargeEnd, preset.travelEnd))));
  for (let i = 0; i < 7; i += 1) {
    const side = (i - 3) * 10;
    const a = { x: source.x + vector.px * side, y: source.y + vector.py * side };
    const b = { x: sweepFront.x + vector.px * side * 0.65, y: sweepFront.y + vector.py * side * 0.65 };
    ctx.strokeStyle = rgba(i % 2 ? preset.palette.secondary : preset.palette.primary, 0.16 + active * 0.18);
    ctx.lineWidth = 4 - i * 0.35;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2 + vector.px * 12, (a.y + b.y) / 2 + vector.py * 12, b.x, b.y);
    ctx.stroke();
  }
  if (!missed && progress >= preset.travelEnd) {
    const hit = phase(progress, preset.travelEnd, preset.impactEnd);
    for (let i = 0; i < 4; i += 1) drawCrescent(ctx, target.x, target.y, 20 + i * 9 + hit * 10, -0.6 + i * 0.45, i % 2 ? preset.palette.secondary : preset.palette.core, 0.22 * (1 - hit));
  }
}

function drawReduced(ctx: CanvasRenderingContext2D, source: BattleMoveVfxPoint, target: BattleMoveVfxPoint, preset: SignatureEffectPreset, missed: boolean): void {
  ctx.save(); ctx.strokeStyle = rgba(preset.palette.primary, 0.68); ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.restore();
  if (!missed) drawRadialImpact(ctx, target, preset, 0.55, 34);
}

function resolveTarget(source: BattleMoveVfxPoint, target: BattleMoveVfxPoint, missed: boolean): BattleMoveVfxPoint {
  if (!missed) return target;
  const v = getVector(source, target);
  const side = pseudo(Math.round(source.x + target.y)) > 0.5 ? 1 : -1;
  return { x: target.x + v.px * 72 * side + v.nx * 25, y: target.y + v.py * 72 * side + v.ny * 25 };
}

function getVector(a: BattleMoveVfxPoint, b: BattleMoveVfxPoint): Vector {
  const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy) || 1; const nx = dx / length; const ny = dy / length;
  return { dx, dy, length, nx, ny, px: -ny, py: nx };
}

function lerpPoint(a: BattleMoveVfxPoint, b: BattleMoveVfxPoint, t: number): BattleMoveVfxPoint { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function phase(p: number, start: number, end: number): number { return clamp01((p - start) / Math.max(0.001, end - start)); }
function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function easeOutCubic(v: number): number { return 1 - Math.pow(1 - v, 3); }
function easeInCubic(v: number): number { return v * v * v; }
function easeInOutCubic(v: number): number { return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; }
function pseudo(seed: number): number { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
function rgba(rgb: string, alpha: number): string { return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`; }
function delay(ms: number): Promise<void> { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
