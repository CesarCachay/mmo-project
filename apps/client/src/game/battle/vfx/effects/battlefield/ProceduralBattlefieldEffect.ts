import type { BattleMoveVfxRenderRequest } from "../../battle-move-vfx.types";
import { getBattlefieldEffectPreset, type BattlefieldEffectPreset } from "./battlefield-effect.presets";

interface Runtime {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly request: BattleMoveVfxRenderRequest;
  readonly isCancelled: () => boolean;
}

const TAU = Math.PI * 2;

export async function playProceduralBattlefieldEffect(runtime: Runtime): Promise<void> {
  const { ctx, width, height, request, isCancelled } = runtime;
  if (request.definition.archetype !== "battlefield") return;
  const preset = getBattlefieldEffectPreset(request.definition.presetId);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const duration = reduced ? 180 : request.definition.durationMs;
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const frame = (now: number): void => {
      if (isCancelled()) { ctx.clearRect(0, 0, width, height); resolve(); return; }
      const p = Math.min(1, (now - start) / duration);
      ctx.clearRect(0, 0, width, height);
      if (preset.kind === "weather") drawWeather(ctx, width, height, preset, p, now, reduced);
      else if (preset.kind === "hazard") drawHazard(ctx, width, height, preset, p, now, request.target.x);
      else drawDistortion(ctx, width, height, preset, p, now);
      if (p >= 1) { ctx.clearRect(0, 0, width, height); resolve(); return; }
      window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(frame);
  });
}

function drawWeather(ctx: CanvasRenderingContext2D, width: number, height: number, preset: BattlefieldEffectPreset, p: number, now: number, reduced: boolean): void {
  const alpha = envelope(p);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (preset.particleKind === "sun") {
    const x = width * 0.78, y = height * 0.2, radius = Math.min(width, height) * 0.16;
    radial(ctx, x, y, radius, preset.palette.core, preset.palette.outer, 0.34 * alpha);
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * TAU + now * 0.0003;
      ctx.strokeStyle = rgba(preset.palette.particle, 0.38 * alpha);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * radius * 0.45, y + Math.sin(a) * radius * 0.45); ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); ctx.stroke();
    }
  } else {
    const count = reduced ? Math.min(12, preset.particleCount) : preset.particleCount;
    for (let i = 0; i < count; i += 1) {
      const sx = pseudo(i * 31 + 7), sy = pseudo(i * 53 + 11), speed = 0.00045 + pseudo(i * 17 + 3) * 0.00055;
      const phase = (sy + now * speed) % 1;
      const x = sx * width + (preset.particleKind === "sand" ? Math.sin(now * 0.003 + i) * 45 : 0);
      const y = phase * height;
      if (preset.particleKind === "rain") line(ctx, x, y, x - 8, y + 22, preset.palette.particle, 0.48 * alpha, 1.6);
      else if (preset.particleKind === "hail") circle(ctx, x, y, 2 + pseudo(i * 19) * 3, rgba(preset.palette.particle, 0.62 * alpha));
      else circle(ctx, x, y, 1.5 + pseudo(i * 23) * 3, rgba(preset.palette.particle, 0.36 * alpha));
    }
  }
  ctx.restore();
}

function drawHazard(ctx: CanvasRenderingContext2D, width: number, height: number, preset: BattlefieldEffectPreset, p: number, now: number, targetX: number): void {
  const alpha = envelope(p), grow = easeOutCubic(Math.min(1, p * 1.8));
  const rightSide = targetX >= width / 2;
  const centerX = rightSide ? width * 0.72 : width * 0.28;
  const baseY = height * 0.72;
  ctx.save();
  for (let i = 0; i < preset.particleCount; i += 1) {
    const x = centerX + (pseudo(i * 43 + 4) - 0.5) * width * 0.24;
    const y = baseY + (pseudo(i * 29 + 9) - 0.5) * height * 0.08;
    const size = (5 + pseudo(i * 71 + 2) * 8) * grow;
    ctx.save(); ctx.translate(x, y); ctx.rotate((pseudo(i * 13) - 0.5) * 1.1 + now * 0.00015);
    ctx.fillStyle = rgba(preset.palette.mid, 0.82 * alpha);
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.65, size * 0.7); ctx.lineTo(-size * 0.65, size * 0.7); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  radial(ctx, centerX, baseY, width * 0.16, preset.palette.inner, preset.palette.outer, 0.12 * alpha);
  ctx.restore();
}

function drawDistortion(ctx: CanvasRenderingContext2D, width: number, height: number, preset: BattlefieldEffectPreset, p: number, now: number): void {
  const alpha = envelope(p);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  if (preset.particleKind === "grid") {
    ctx.strokeStyle = rgba(preset.palette.mid, 0.3 * alpha); ctx.lineWidth = 1.5;
    const step = Math.max(32, Math.min(width, height) / 8);
    for (let x = -step; x < width + step; x += step) { ctx.beginPath(); ctx.moveTo(x + Math.sin(now * 0.002 + x) * 5, 0); ctx.lineTo(width - x, height); ctx.stroke(); }
    for (let y = 0; y < height + step; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, height - y); ctx.stroke(); }
    radial(ctx, width / 2, height / 2, Math.max(width, height) * 0.55, preset.palette.core, preset.palette.outer, 0.18 * alpha);
  } else {
    for (let i = 0; i < preset.particleCount; i += 1) {
      const x = pseudo(i * 37 + 5) * width;
      const y0 = pseudo(i * 61 + 7) * height * 0.75;
      const drop = ((now * (0.018 + pseudo(i * 11) * 0.02)) + i * 17) % (height * 0.5);
      line(ctx, x, y0 + drop, x, y0 + drop + 18, preset.palette.particle, 0.34 * alpha, 2);
    }
    radial(ctx, width / 2, height * 0.62, Math.max(width, height) * 0.45, preset.palette.inner, preset.palette.outer, 0.14 * alpha);
  }
  ctx.restore();
}

function envelope(p: number): number { return p < 0.15 ? p / 0.15 : p > 0.78 ? (1 - p) / 0.22 : 1; }
function easeOutCubic(v: number): number { const t = 1 - Math.max(0, Math.min(1, v)); return 1 - t*t*t; }
function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, core: string, outer: string, alpha: number): void { const g = ctx.createRadialGradient(x,y,0,x,y,Math.max(1,r)); g.addColorStop(0,rgba(core,alpha)); g.addColorStop(1,rgba(outer,0)); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill(); }
function line(ctx: CanvasRenderingContext2D, x1:number,y1:number,x2:number,y2:number,rgb:string,a:number,w:number):void { ctx.strokeStyle=rgba(rgb,a); ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
function circle(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,fill:string):void { ctx.fillStyle=fill; ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill(); }
function rgba(rgb:string,a:number):string { return `rgba(${rgb}, ${Math.max(0,Math.min(1,a))})`; }
function pseudo(seed:number):number { const x=Math.sin(seed*12.9898)*43758.5453; return x-Math.floor(x); }
