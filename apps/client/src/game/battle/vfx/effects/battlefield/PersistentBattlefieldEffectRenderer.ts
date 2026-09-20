import type {
  BattleFieldState,
  BattleSide,
  BattleSideHazards,
} from "@cesar-mmo/shared";

interface PersistentBattlefieldRenderInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly fieldState: BattleFieldState;
  readonly localSide: BattleSide;
  readonly opponentSide: BattleSide;
  readonly now: number;
  readonly reducedMotion: boolean;
  readonly particleScale: number;
}

const TAU = Math.PI * 2;

export function drawPersistentBattlefieldEffects(
  input: PersistentBattlefieldRenderInput,
): void {
  const {
    ctx,
    width,
    height,
    fieldState,
    localSide,
    opponentSide,
    now,
    reducedMotion,
    particleScale,
  } = input;

  drawWeather(ctx, width, height, fieldState, now, reducedMotion, particleScale);
  drawFieldEffects(ctx, width, height, fieldState, now, reducedMotion, particleScale);

  drawHazards(
    ctx,
    width,
    height,
    fieldState.hazards[localSide],
    width * 0.28,
    height * 0.73,
    now,
    reducedMotion,
  );

  drawHazards(
    ctx,
    width,
    height,
    fieldState.hazards[opponentSide],
    width * 0.72,
    height * 0.53,
    now,
    reducedMotion,
  );
}

function drawWeather(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fieldState: BattleFieldState,
  now: number,
  reducedMotion: boolean,
  particleScale: number,
): void {
  const weather = fieldState.weather;

  if (!weather) {
    return;
  }

  switch (weather.type) {
    case "rain":
      drawRain(ctx, width, height, now, reducedMotion, particleScale);
      return;

    case "sun":
      drawSun(ctx, width, height, now, reducedMotion);
      return;

    case "sandstorm":
      drawSandstorm(ctx, width, height, now, reducedMotion, particleScale);
      return;

    case "hail":
      drawHail(ctx, width, height, now, reducedMotion, particleScale);
      return;
  }
}

function drawRain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  particleScale: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(25, 62, 101, 0.08)";
  ctx.fillRect(0, 0, width, height);

  const count = scaledCount(reducedMotion ? 18 : 54, particleScale, 8);
  const clock = reducedMotion ? 0 : now;

  for (let i = 0; i < count; i += 1) {
    const x = pseudo(i * 41 + 3) * (width + 80) - 40;
    const speed = 0.42 + pseudo(i * 17 + 9) * 0.42;
    const y = (pseudo(i * 71 + 5) * height + clock * speed) % (height + 34) - 17;
    line(ctx, x, y, x - 8, y + 23, "rgba(170, 226, 255, 0.34)", 1.25);
  }

  ctx.restore();
}

function drawSun(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(255, 187, 56, 0.055)";
  ctx.fillRect(0, 0, width, height);

  const x = width * 0.78;
  const y = height * 0.18;
  const radius = Math.min(width, height) * 0.13;
  const pulse = reducedMotion ? 1 : 0.94 + Math.sin(now * 0.0022) * 0.06;

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.8);
  gradient.addColorStop(0, "rgba(255, 250, 205, 0.28)");
  gradient.addColorStop(0.4, "rgba(255, 205, 76, 0.14)");
  gradient.addColorStop(1, "rgba(255, 167, 38, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.8 * pulse, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 220, 120, 0.18)";
  ctx.lineWidth = 1.5;
  const rotation = reducedMotion ? 0 : now * 0.00012;

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * TAU + rotation;
    ctx.beginPath();
    ctx.moveTo(
      x + Math.cos(angle) * radius * 0.65,
      y + Math.sin(angle) * radius * 0.65,
    );
    ctx.lineTo(
      x + Math.cos(angle) * radius * 1.2,
      y + Math.sin(angle) * radius * 1.2,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawSandstorm(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  particleScale: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(128, 93, 45, 0.065)";
  ctx.fillRect(0, 0, width, height);

  const count = scaledCount(reducedMotion ? 20 : 64, particleScale, 8);
  const clock = reducedMotion ? 0 : now;

  for (let i = 0; i < count; i += 1) {
    const speed = 0.025 + pseudo(i * 29 + 2) * 0.05;
    const x = (pseudo(i * 47 + 7) * width + clock * speed) % (width + 30) - 15;
    const y = pseudo(i * 67 + 13) * height;
    const radius = 1 + pseudo(i * 19 + 5) * 2.5;
    circle(ctx, x, y, radius, "rgba(220, 181, 111, 0.28)");
  }

  ctx.restore();
}

function drawHail(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  particleScale: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(132, 196, 221, 0.045)";
  ctx.fillRect(0, 0, width, height);

  const count = scaledCount(reducedMotion ? 14 : 38, particleScale, 6);
  const clock = reducedMotion ? 0 : now;

  for (let i = 0; i < count; i += 1) {
    const x = pseudo(i * 37 + 11) * width;
    const speed = 0.22 + pseudo(i * 31 + 3) * 0.32;
    const y = (pseudo(i * 59 + 17) * height + clock * speed) % (height + 20) - 10;
    const radius = 1.6 + pseudo(i * 23 + 1) * 2.3;
    circle(ctx, x, y, radius, "rgba(222, 248, 255, 0.42)");
  }

  ctx.restore();
}

function drawFieldEffects(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fieldState: BattleFieldState,
  now: number,
  reducedMotion: boolean,
  particleScale: number,
): void {
  if (fieldState.effects.trickRoomRemainingTurns > 0) {
    drawTrickRoom(ctx, width, height, now, reducedMotion);
  }

  if (fieldState.effects.gravityRemainingTurns > 0) {
    drawGravity(ctx, width, height, now, reducedMotion, particleScale);
  }
}

function drawTrickRoom(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(188, 132, 234, 0.105)";
  ctx.lineWidth = 1;
  const step = Math.max(42, Math.min(width, height) / 7);
  const drift = reducedMotion ? 0 : Math.sin(now * 0.0018) * 6;

  for (let x = -height; x < width + height; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + drift, 0);
    ctx.lineTo(x - height + drift, height);
    ctx.stroke();
  }

  for (let x = -height; x < width + height; x += step) {
    ctx.beginPath();
    ctx.moveTo(x - drift, 0);
    ctx.lineTo(x + height - drift, height);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(103, 58, 183, 0.025)";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawGravity(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  reducedMotion: boolean,
  particleScale: number,
): void {
  ctx.save();
  const count = scaledCount(reducedMotion ? 8 : 22, particleScale, 5);
  const clock = reducedMotion ? 0 : now;

  for (let i = 0; i < count; i += 1) {
    const x = pseudo(i * 43 + 4) * width;
    const phase = (pseudo(i * 61 + 9) * height + clock * 0.05) % height;
    line(
      ctx,
      x,
      phase,
      x,
      Math.min(height, phase + 18),
      "rgba(174, 139, 222, 0.16)",
      1.5,
    );
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(78, 52, 127, 0)");
  gradient.addColorStop(1, "rgba(78, 52, 127, 0.08)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawHazards(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  hazards: BattleSideHazards,
  centerX: number,
  centerY: number,
  now: number,
  reducedMotion: boolean,
): void {
  if (hazards.spikesLayers > 0) {
    const count = Math.min(9, hazards.spikesLayers * 3);
    drawSpikes(ctx, width, height, centerX, centerY, count, false);
  }

  if (hazards.toxicSpikesLayers > 0) {
    const count = Math.min(8, hazards.toxicSpikesLayers * 4);
    drawSpikes(ctx, width, height, centerX, centerY + 5, count, true);
  }

  if (hazards.stealthRock) {
    drawStealthRock(ctx, width, height, centerX, centerY, now, reducedMotion);
  }
}

function drawSpikes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  count: number,
  toxic: boolean,
): void {
  ctx.save();

  for (let i = 0; i < count; i += 1) {
    const spreadX = width * 0.17;
    const spreadY = height * 0.04;
    const x = centerX + (pseudo(i * 37 + (toxic ? 19 : 3)) - 0.5) * spreadX;
    const y = centerY + (pseudo(i * 53 + (toxic ? 29 : 7)) - 0.5) * spreadY;
    const size = 4.5 + pseudo(i * 71 + 5) * 5;

    ctx.fillStyle = toxic
      ? "rgba(187, 104, 210, 0.58)"
      : "rgba(154, 124, 88, 0.58)";
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.7, y + size * 0.55);
    ctx.lineTo(x - size * 0.7, y + size * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawStealthRock(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  now: number,
  reducedMotion: boolean,
): void {
  ctx.save();
  const clock = reducedMotion ? 0 : now;

  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * TAU + clock * 0.00022;
    const orbitX = width * 0.075;
    const orbitY = height * 0.035;
    const x = centerX + Math.cos(angle) * orbitX;
    const y = centerY - height * 0.055 + Math.sin(angle) * orbitY;
    const size = 4.5 + pseudo(i * 23 + 11) * 4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * 1.7);
    ctx.fillStyle = "rgba(146, 127, 107, 0.58)";
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.8, -size * 0.15);
    ctx.lineTo(size * 0.45, size * 0.8);
    ctx.lineTo(-size * 0.65, size * 0.6);
    ctx.lineTo(-size * 0.85, -size * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeStyle: string,
  width: number,
): void {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fillStyle: string,
): void {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function scaledCount(base: number, scale: number, minimum: number): number {
  return Math.max(minimum, Math.round(base * Math.max(0.2, scale)));
}

function pseudo(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
