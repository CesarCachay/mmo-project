import type { MovementInputState } from "../input/MovementInputSource";

type TouchDpadOptions = {
  parent: HTMLElement;
  onChange: (state: MovementInputState) => void;
};

type DpadDirection = "up" | "down" | "left" | "right";

const NEUTRAL_STATE: MovementInputState = {
  up: false,
  down: false,
  left: false,
  right: false,
};

const CENTER_DEADZONE_PX = 18;

export class TouchDpad {
  private readonly root: HTMLDivElement;
  private readonly buttons: Record<DpadDirection, HTMLButtonElement>;
  private readonly onChange: (state: MovementInputState) => void;
  private readonly orientationMedia = window.matchMedia("(orientation: portrait)");

  private enabled = true;
  private activePointerId: number | undefined;
  private activeDirection: DpadDirection | undefined;
  private lastState: MovementInputState = NEUTRAL_STATE;

  constructor(options: TouchDpadOptions) {
    this.onChange = options.onChange;

    this.root = document.createElement("div");
    this.root.className = "touch-dpad";
    this.root.setAttribute("aria-label", "Controles de movimiento");

    this.buttons = {
      up: this.createButton("up", "▲", "Mover arriba"),
      down: this.createButton("down", "▼", "Mover abajo"),
      left: this.createButton("left", "◀", "Mover izquierda"),
      right: this.createButton("right", "▶", "Mover derecha"),
    };

    this.root.append(
      this.buttons.up,
      this.buttons.left,
      this.buttons.right,
      this.buttons.down,
    );

    options.parent.append(this.root);

    this.root.addEventListener("pointerdown", this.handlePointerDown);
    this.root.addEventListener("pointermove", this.handlePointerMove);
    this.root.addEventListener("pointerup", this.handlePointerEnd);
    this.root.addEventListener("pointercancel", this.handlePointerEnd);
    this.root.addEventListener("lostpointercapture", this.handleLostPointerCapture);

    window.addEventListener("blur", this.handleWindowBlur);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.orientationMedia.addEventListener("change", this.handleOrientationChange);
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;
    this.root.classList.toggle("touch-dpad--disabled", !enabled);

    for (const button of Object.values(this.buttons)) {
      button.disabled = !enabled;
    }

    if (!enabled) {
      this.reset();
    }
  }

  public reset(): void {
    const pointerId = this.activePointerId;

    this.activePointerId = undefined;
    this.setActiveDirection(undefined);

    if (pointerId !== undefined && this.root.hasPointerCapture(pointerId)) {
      try {
        this.root.releasePointerCapture(pointerId);
      } catch {
        // Browser may already have released pointer capture.
      }
    }

    this.emitState(NEUTRAL_STATE);
  }

  public destroy(): void {
    this.reset();

    this.orientationMedia.removeEventListener("change", this.handleOrientationChange);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("blur", this.handleWindowBlur);

    this.root.removeEventListener("pointerdown", this.handlePointerDown);
    this.root.removeEventListener("pointermove", this.handlePointerMove);
    this.root.removeEventListener("pointerup", this.handlePointerEnd);
    this.root.removeEventListener("pointercancel", this.handlePointerEnd);
    this.root.removeEventListener("lostpointercapture", this.handleLostPointerCapture);

    this.root.remove();
  }

  private createButton(
    direction: DpadDirection,
    symbol: string,
    ariaLabel: string,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `touch-dpad__button touch-dpad__button--${direction}`;
    button.dataset.direction = direction;
    button.setAttribute("aria-label", ariaLabel);
    button.innerHTML = `<span aria-hidden="true">${symbol}</span>`;
    return button;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled || this.activePointerId !== undefined) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const direction = this.getDirectionFromEventTarget(event.target);

    if (!direction) {
      return;
    }

    event.preventDefault();

    this.activePointerId = event.pointerId;

    try {
      this.root.setPointerCapture(event.pointerId);
    } catch {
      // Some mobile browsers can reject pointer capture during transitions.
    }

    this.activateDirection(direction);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.enabled || event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();

    const direction = this.resolveDirectionFromPointer(event.clientX, event.clientY);

    if (direction === this.activeDirection) {
      return;
    }

    if (!direction) {
      this.setActiveDirection(undefined);
      this.emitState(NEUTRAL_STATE);
      return;
    }

    this.activateDirection(direction);
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();
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
    if (document.visibilityState !== "visible") {
      this.reset();
    }
  };

  private getDirectionFromEventTarget(target: EventTarget | null): DpadDirection | undefined {
    if (!(target instanceof Element)) {
      return undefined;
    }

    const button = target.closest<HTMLButtonElement>(".touch-dpad__button");
    const direction = button?.dataset.direction;

    return isDpadDirection(direction) ? direction : undefined;
  }

  private resolveDirectionFromPointer(
    clientX: number,
    clientY: number,
  ): DpadDirection | undefined {
    const rect = this.root.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    if (Math.hypot(dx, dy) < CENTER_DEADZONE_PX) {
      return undefined;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx < 0 ? "left" : "right";
    }

    return dy < 0 ? "up" : "down";
  }

  private activateDirection(direction: DpadDirection): void {
    this.setActiveDirection(direction);
    this.emitState(directionToState(direction));
  }

  private setActiveDirection(direction: DpadDirection | undefined): void {
    this.activeDirection = direction;

    for (const [buttonDirection, button] of Object.entries(this.buttons) as Array<
      [DpadDirection, HTMLButtonElement]
    >) {
      button.classList.toggle(
        "touch-dpad__button--active",
        buttonDirection === direction,
      );
    }
  }

  private emitState(state: MovementInputState): void {
    if (movementStatesEqual(state, this.lastState)) {
      return;
    }

    this.lastState = state;
    this.onChange(state);
  }
}

function directionToState(direction: DpadDirection): MovementInputState {
  return {
    up: direction === "up",
    down: direction === "down",
    left: direction === "left",
    right: direction === "right",
  };
}

function movementStatesEqual(
  left: MovementInputState,
  right: MovementInputState,
): boolean {
  return (
    left.up === right.up &&
    left.down === right.down &&
    left.left === right.left &&
    left.right === right.right
  );
}

function isDpadDirection(value: string | undefined): value is DpadDirection {
  return value === "up" || value === "down" || value === "left" || value === "right";
}
