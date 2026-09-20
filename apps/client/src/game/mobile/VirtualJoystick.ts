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

const MOVEMENT_START_RATIO = 0.24;
const MOVEMENT_STOP_RATIO = 0.16;
const DIRECTION_SECTOR_RADIANS = Math.PI / 2;
const DIRECTION_HYSTERESIS_RADIANS = (10 * Math.PI) / 180;

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

  private lastDirectionIndex: number | undefined;

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

    this.lastDirectionIndex = undefined;

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

    /*
     * Let the knob follow the finger inside the deadzone. Once movement is
     * active, emitMovement() snaps the knob to the selected cardinal axis so
     * the visual control always matches the direction actually sent to the
     * movement system.
     */
    this.setKnobPosition(x, y);

    const normalizedX = x / geometry.maxRadius;
    const normalizedY = y / geometry.maxRadius;

    this.emitMovement(normalizedX, normalizedY, limitedDistance);
  }

  private setKnobPosition(x: number, y: number): void {
    this.knob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  private emitMovement(
    x: number,
    y: number,
    knobDistance?: number,
  ): void {
    const magnitude = Math.hypot(x, y);

    /*
     * Use a radial deadzone rather than independent X/Y thresholds.
     * This makes diagonals and cardinals feel symmetrical around the
     * center of the stick. Two thresholds add hysteresis so tiny finger
     * movements near the center do not rapidly start/stop movement.
     */
    if (this.lastDirectionIndex === undefined) {
      if (magnitude < MOVEMENT_START_RATIO) {
        this.emitNeutralMovement();
        return;
      }
    } else if (magnitude < MOVEMENT_STOP_RATIO) {
      this.lastDirectionIndex = undefined;
      this.emitNeutralMovement();
      return;
    }

    const candidateDirection = this.resolveDirectionIndex(x, y);

    const directionIndex = this.applyDirectionHysteresis(
      candidateDirection,
      x,
      y
    );

    this.lastDirectionIndex = directionIndex;

    if (knobDistance !== undefined) {
      this.snapKnobToDirection(directionIndex, knobDistance);
    }

    this.emitMovementState(this.directionIndexToState(directionIndex));
  }

  private emitNeutralMovement(): void {
    this.emitMovementState({
      up: false,
      down: false,
      left: false,
      right: false,
    });
  }

  /**
   * Quantize the stick to four cardinal sectors only. This deliberately
   * removes diagonals from touch input so mobile movement matches the
   * tile/cardinal nature of the overworld and the direction shown by the
   * player sprite.
   *
   * Indexes rotate clockwise because browser Y coordinates grow downward:
   * 0 right, 1 down, 2 left, 3 up.
   */
  private resolveDirectionIndex(x: number, y: number): number {
    const angle = this.normalizeAngle(Math.atan2(y, x));

    return Math.round(angle / DIRECTION_SECTOR_RADIANS) % 4;
  }

  private applyDirectionHysteresis(
    candidateDirection: number,
    x: number,
    y: number
  ): number {
    const previousDirection = this.lastDirectionIndex;

    if (
      previousDirection === undefined ||
      previousDirection === candidateDirection
    ) {
      return candidateDirection;
    }

    const angle = this.normalizeAngle(Math.atan2(y, x));
    const previousCenterAngle = previousDirection * DIRECTION_SECTOR_RADIANS;

    const distanceFromPreviousCenter = this.angularDistance(
      angle,
      previousCenterAngle
    );

    const previousSectorRetention =
      DIRECTION_SECTOR_RADIANS / 2 + DIRECTION_HYSTERESIS_RADIANS;

    return distanceFromPreviousCenter <= previousSectorRetention
      ? previousDirection
      : candidateDirection;
  }

  private directionIndexToState(directionIndex: number): MovementInputState {
    switch (directionIndex) {
      case 0:
        return { up: false, down: false, left: false, right: true };
      case 1:
        return { up: false, down: true, left: false, right: false };
      case 2:
        return { up: false, down: false, left: true, right: false };
      case 3:
        return { up: true, down: false, left: false, right: false };
      default:
        return { up: false, down: false, left: false, right: false };
    }
  }

  private snapKnobToDirection(
    directionIndex: number,
    distance: number,
  ): void {
    switch (directionIndex) {
      case 0:
        this.setKnobPosition(distance, 0);
        return;
      case 1:
        this.setKnobPosition(0, distance);
        return;
      case 2:
        this.setKnobPosition(-distance, 0);
        return;
      case 3:
        this.setKnobPosition(0, -distance);
        return;
      default:
        this.setKnobPosition(0, 0);
    }
  }

  private normalizeAngle(angle: number): number {
    const fullCircle = Math.PI * 2;

    return ((angle % fullCircle) + fullCircle) % fullCircle;
  }

  private angularDistance(angleA: number, angleB: number): number {
    const fullCircle = Math.PI * 2;
    const rawDistance = Math.abs(angleA - angleB) % fullCircle;

    return Math.min(rawDistance, fullCircle - rawDistance);
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
