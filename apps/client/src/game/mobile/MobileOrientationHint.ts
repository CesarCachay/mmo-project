import "./mobile-orientation-hint.css";

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

export class MobileOrientationHint {
  private readonly root: HTMLDivElement;
  private readonly actionButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly messageElement: HTMLSpanElement;

  private dismissed = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "mobile-orientation-hint";

    this.root.innerHTML = `
      <div
        class="mobile-orientation-hint__card"
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          class="mobile-orientation-hint__action"
          data-orientation-action
          aria-label="Cambiar a orientación horizontal"
        >
          <span
            class="mobile-orientation-hint__icon"
            aria-hidden="true"
          >
            ↻
          </span>

          <span class="mobile-orientation-hint__content">
            <strong>Gira tu dispositivo</strong>

            <span data-orientation-message>
              Toca aquí para cambiar a horizontal.
            </span>
          </span>
        </button>

        <button
          type="button"
          class="mobile-orientation-hint__close"
          data-orientation-close
          aria-label="Cerrar aviso de orientación"
        >
          ×
        </button>
      </div>
    `;

    const actionButton = this.root.querySelector<HTMLButtonElement>(
      "[data-orientation-action]"
    );
    const closeButton = this.root.querySelector<HTMLButtonElement>(
      "[data-orientation-close]"
    );
    const messageElement = this.root.querySelector<HTMLSpanElement>(
      "[data-orientation-message]"
    );

    if (!actionButton || !closeButton || !messageElement) {
      throw new Error("Could not create MobileOrientationHint");
    }

    this.actionButton = actionButton;
    this.closeButton = closeButton;
    this.messageElement = messageElement;

    this.actionButton.addEventListener("click", this.handleOrientationRequest);
    this.closeButton.addEventListener("click", this.handleDismiss);

    parent.append(this.root);
  }

  public destroy(): void {
    this.actionButton.removeEventListener("click", this.handleOrientationRequest);
    this.closeButton.removeEventListener("click", this.handleDismiss);
    this.root.remove();
  }

  private readonly handleDismiss = (): void => {
    this.dismissed = true;
    this.root.classList.add("mobile-orientation-hint--dismissed");
  };

  private readonly handleOrientationRequest = (): void => {
    void this.requestLandscape();
  };

  private async requestLandscape(): Promise<void> {
    if (window.matchMedia("(orientation: landscape)").matches) {
      return;
    }

    this.actionButton.disabled = true;
    this.setMessage("Intentando activar el modo horizontal...");

    const orientation = (
      window.screen as Screen & {
        orientation?: LockableScreenOrientation;
      }
    ).orientation;

    if (!orientation || typeof orientation.lock !== "function") {
      this.handleUnsupportedOrientationLock();
      return;
    }

    try {
      if (
        !document.fullscreenElement &&
        typeof document.documentElement.requestFullscreen === "function"
      ) {
        try {
          await document.documentElement.requestFullscreen({
            navigationUI: "hide",
          });
        } catch {
          // Continue and try orientation.lock anyway.
        }
      }

      await orientation.lock("landscape");
      this.setMessage("Modo horizontal activado.");
    } catch {
      this.handleUnsupportedOrientationLock();
    } finally {
      this.actionButton.disabled = false;
    }
  }

  private handleUnsupportedOrientationLock(): void {
    this.setMessage(
      "Tu navegador no permite girar automáticamente. Gira el dispositivo manualmente."
    );

    this.actionButton.disabled = false;
  }

  private setMessage(message: string): void {
    if (this.dismissed) {
      return;
    }

    this.messageElement.textContent = message;
  }
}
