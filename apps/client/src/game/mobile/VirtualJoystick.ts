import type { MovementInputState } from "../input/MovementInputSource";

type VirtualJoystickOptions = {
  parent: HTMLElement;
  onChange: (state: MovementInputState) => void;
};

const DEADZONE_RATIO = 0.28;
const MAX_RADIUS = 42;

export class VirtualJoystick {
  private readonly root: HTMLDivElement;

  private readonly base: HTMLDivElement;

  private readonly knob: HTMLDivElement;

  private readonly onChange: (state: MovementInputState) => void;

  private activePointerId: number | undefined;

  private enabled = true;

  constructor(options: VirtualJoystickOptions) {
    this.onChange = options.onChange;

    this.root = document.createElement("div");
    this.root.className = "virtual-joystick";

    this.base = document.createElement("div");
    this.base.className = "virtual-joystick__base";

    this.knob = document.createElement("div");
    this.knob.className = "virtual-joystick__knob";

    this.base.append(this.knob);
    this.root.append(this.base);

    options.parent.append(this.root);

    this.base.addEventListener("pointerdown", this.handlePointerDown);
    this.base.addEventListener("pointermove", this.handlePointerMove);
    this.base.addEventListener("pointerup", this.handlePointerEnd);
    this.base.addEventListener("pointercancel", this.handlePointerEnd);
    this.base.addEventListener("lostpointercapture", this.handleLostPointerCapture);

    window.addEventListener("blur", this.handleWindowBlur);
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;

    this.root.classList.toggle("virtual-joystick--disabled", !enabled);

    if (!enabled) {
      this.reset();
    }
  }

  public destroy(): void {
    this.reset();

    this.base.removeEventListener("pointerdown", this.handlePointerDown);
    this.base.removeEventListener("pointermove", this.handlePointerMove);
    this.base.removeEventListener("pointerup", this.handlePointerEnd);
    this.base.removeEventListener("pointercancel", this.handlePointerEnd);
    this.base.removeEventListener("lostpointercapture", this.handleLostPointerCapture);

    window.removeEventListener("blur", this.handleWindowBlur);

    this.root.remove();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled) {
      return;
    }

    if (this.activePointerId !== undefined) {
      return;
    }

    event.preventDefault();

    this.activePointerId = event.pointerId;

    this.base.setPointerCapture(event.pointerId);

    this.updateFromPointer(event);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.enabled || event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();

    this.updateFromPointer(event);
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();

    if (this.base.hasPointerCapture(event.pointerId)) {
      this.base.releasePointerCapture(event.pointerId);
    }

    this.reset();
  };

  private readonly handleLostPointerCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) {
      this.reset();
    }
  };

  private readonly handleWindowBlur = (): void => {
    this.reset();
  };

  private updateFromPointer(event: PointerEvent): void {
    const rect = this.base.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;

    const centerY = rect.top + rect.height / 2;

    const rawX = event.clientX - centerX;

    const rawY = event.clientY - centerY;

    const distance = Math.hypot(rawX, rawY);

    const limitedDistance = Math.min(distance, MAX_RADIUS);

    const angle = Math.atan2(rawY, rawX);

    const x = Math.cos(angle) * limitedDistance;

    const y = Math.sin(angle) * limitedDistance;

    this.knob.style.transform = `translate(${x}px, ${y}px)`;

    const normalizedX = x / MAX_RADIUS;

    const normalizedY = y / MAX_RADIUS;

    this.emitMovement(normalizedX, normalizedY);
  }

  private emitMovement(x: number, y: number): void {
    const state: MovementInputState = {
      left: x < -DEADZONE_RATIO,
      right: x > DEADZONE_RATIO,
      up: y < -DEADZONE_RATIO,
      down: y > DEADZONE_RATIO,
    };

    this.onChange(state);
  }

  private reset(): void {
    this.activePointerId = undefined;

    this.knob.style.transform = "translate(0px, 0px)";

    this.onChange({
      up: false,
      down: false,
      left: false,
      right: false,
    });
  }
}
