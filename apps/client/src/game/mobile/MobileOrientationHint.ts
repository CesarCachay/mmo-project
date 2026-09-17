import "./mobile-orientation-hint.css";

export class MobileOrientationHint {
  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");

    this.root.className = "mobile-orientation-hint";

    this.root.innerHTML = `
      <div
        class="mobile-orientation-hint__card"
        role="status"
        aria-live="polite"
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

          <span>
            Para una mejor experiencia,
            juega en horizontal.
          </span>
        </div>
      </div>
    `;

    parent.append(this.root);
  }

  public destroy(): void {
    this.root.remove();
  }
}
