import type { MovementInputState } from "../input/MovementInputSource";

type VirtualJoystickOptions = {
  parent: HTMLElement;
  onChange: (state: MovementInputState) => void;
};

type JoystickGeometry = {
  centerX: number;
  centerY: number;
  maxRadius: number;
};

type PointerPosition = {
  clientX: number;
  clientY: number;
};

const DEADZONE_RATIO = 0.3;

export class VirtualJoystick {
  private readonly root: HTMLDivElement;

  private readonly base: HTMLDivElement;

  private readonly knob: HTMLDivElement;

  private readonly onChange: (state: MovementInputState) => void;

  private readonly orientationMedia = window.matchMedia("(orientation: portrait)");

  private activePointerId: number | undefined;

  private enabled = true;

  private geometry: JoystickGeometry | undefined;

  private pendingPointerPosition: PointerPosition | undefined;

  private animationFrameId: number | undefined;

  private lastMovementState: MovementInputState = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

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

    this.orientationMedia.addEventListener("change", this.handleOrientationChange);

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
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

  public reset(): void {
    const pointerId = this.activePointerId;

    this.activePointerId = undefined;

    this.cancelPendingFrame();

    this.pendingPointerPosition = undefined;

    this.geometry = undefined;

    if (pointerId !== undefined && this.base.hasPointerCapture(pointerId)) {
      try {
        this.base.releasePointerCapture(pointerId);
      } catch {
        /*
         * Browser may already have released
         * the pointer.
         */
      }
    }

    this.setKnobPosition(0, 0);

    this.emitMovementState({
      up: false,
      down: false,
      left: false,
      right: false,
    });
  }

  public destroy(): void {
    this.reset();

    this.orientationMedia.removeEventListener("change", this.handleOrientationChange);

    document.removeEventListener("visibilitychange", this.handleVisibilityChange);

    window.removeEventListener("blur", this.handleWindowBlur);

    this.base.removeEventListener("pointerdown", this.handlePointerDown);

    this.base.removeEventListener("pointermove", this.handlePointerMove);

    this.base.removeEventListener("pointerup", this.handlePointerEnd);

    this.base.removeEventListener("pointercancel", this.handlePointerEnd);

    this.base.removeEventListener("lostpointercapture", this.handleLostPointerCapture);

    this.root.remove();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled) {
      return;
    }

    if (this.activePointerId !== undefined) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.preventDefault();

    this.activePointerId = event.pointerId;

    this.refreshGeometry();

    try {
      this.base.setPointerCapture(event.pointerId);
    } catch {
      /*
       * Some browsers can reject capture
       * if pointer state changed between
       * pointerdown and this call.
       */
    }

    this.applyPointerPosition(event.clientX, event.clientY);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.enabled || event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();

    /* Keep only the newest position */
    const coalesced = event.getCoalescedEvents?.();

    const latestEvent =
      coalesced && coalesced.length > 0 ? coalesced[coalesced.length - 1] : event;

    this.pendingPointerPosition = {
      clientX: latestEvent.clientX,
      clientY: latestEvent.clientY,
    };

    this.schedulePointerFrame();
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();

    /* reset() also safely releases pointer capture */
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

  private readonly handleOrientationChange = (): void => {
    this.reset();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      return;
    }

    this.reset();
  };

  private readonly flushPointerFrame = (): void => {
    this.animationFrameId = undefined;

    const position = this.pendingPointerPosition;

    this.pendingPointerPosition = undefined;

    if (!position || this.activePointerId === undefined) {
      return;
    }

    this.applyPointerPosition(position.clientX, position.clientY);
  };

  private schedulePointerFrame(): void {
    if (this.animationFrameId !== undefined) {
      return;
    }

    this.animationFrameId = window.requestAnimationFrame(this.flushPointerFrame);
  }

  private cancelPendingFrame(): void {
    if (this.animationFrameId === undefined) {
      return;
    }

    window.cancelAnimationFrame(this.animationFrameId);

    this.animationFrameId = undefined;
  }

  private refreshGeometry(): void {
    const baseRect = this.base.getBoundingClientRect();

    const knobRect = this.knob.getBoundingClientRect();

    const maxRadius = Math.max(
      1,
      (Math.min(baseRect.width, baseRect.height) -
        Math.max(knobRect.width, knobRect.height)) /
        2
    );

    this.geometry = {
      centerX: baseRect.left + baseRect.width / 2,
      centerY: baseRect.top + baseRect.height / 2,
      maxRadius,
    };
  }

  private applyPointerPosition(clientX: number, clientY: number): void {
    const geometry = this.geometry;

    if (!geometry) {
      return;
    }

    const rawX = clientX - geometry.centerX;
    const rawY = clientY - geometry.centerY;

    const distance = Math.hypot(rawX, rawY);

    if (distance === 0) {
      this.setKnobPosition(0, 0);
      this.emitMovement(0, 0);
      return;
    }

    const limitedDistance = Math.min(distance, geometry.maxRadius);

    const scale = limitedDistance / distance;

    const x = rawX * scale;
    const y = rawY * scale;

    this.setKnobPosition(x, y);

    const normalizedX = x / geometry.maxRadius;
    const normalizedY = y / geometry.maxRadius;

    this.emitMovement(normalizedX, normalizedY);
  }

  private setKnobPosition(x: number, y: number): void {
    this.knob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  private emitMovement(x: number, y: number): void {
    this.emitMovementState({
      left: x < -DEADZONE_RATIO,
      right: x > DEADZONE_RATIO,
      up: y < -DEADZONE_RATIO,
      down: y > DEADZONE_RATIO,
    });
  }

  private emitMovementState(state: MovementInputState): void {
    if (
      state.up === this.lastMovementState.up &&
      state.down === this.lastMovementState.down &&
      state.left === this.lastMovementState.left &&
      state.right === this.lastMovementState.right
    ) {
      return;
    }

    this.lastMovementState = {
      ...state,
    };

    this.onChange(state);
  }
}
