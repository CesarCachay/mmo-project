import "./mobile-orientation-hint.css";

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

export class MobileOrientationHint {
  private readonly root: HTMLDivElement;

  private readonly actionButton: HTMLButtonElement;

  private readonly messageElement: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");

    this.root.className = "mobile-orientation-hint";

    this.root.innerHTML = `
      <button
        type="button"
        class="mobile-orientation-hint__card"
        data-orientation-action
        aria-label="Cambiar a orientación horizontal"
      >
        <div
          class="mobile-orientation-hint__icon"
          aria-hidden="true"
        >
          ↻
        </div>

        <div
          class="mobile-orientation-hint__content"
        >
          <strong>
            Gira tu dispositivo
          </strong>

          <span data-orientation-message>
            Toca aquí para cambiar a horizontal.
          </span>
        </div>
      </button>
    `;

    const actionButton = this.root.querySelector<HTMLButtonElement>(
      "[data-orientation-action]"
    );

    const messageElement = this.root.querySelector<HTMLSpanElement>(
      "[data-orientation-message]"
    );

    if (!actionButton || !messageElement) {
      throw new Error("Could not create MobileOrientationHint");
    }

    this.actionButton = actionButton;
    this.messageElement = messageElement;

    this.actionButton.addEventListener("click", this.handleOrientationRequest);

    parent.append(this.root);
  }

  public destroy(): void {
    this.actionButton.removeEventListener("click", this.handleOrientationRequest);

    this.root.remove();
  }

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
      /*
       * Algunos navegadores permiten orientation.lock()
       * únicamente desde fullscreen.
       *
       * Si fullscreen no está disponible o falla,
       * todavía intentamos el lock directamente.
       */
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
    this.messageElement.textContent = message;
  }
}
