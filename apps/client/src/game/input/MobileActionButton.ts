interface MobileActionButtonOptions {
  parent: HTMLElement;
  onPress: () => void;
}

export class MobileActionButton {
  private readonly root: HTMLDivElement;

  private readonly button: HTMLButtonElement;

  private readonly label: HTMLSpanElement;

  private enabled = true;

  constructor(options: MobileActionButtonOptions) {
    this.root = document.createElement("div");
    this.root.className = "mobile-action-control";

    this.root.hidden = true;

    this.button = document.createElement("button");

    this.button.type = "button";

    this.button.className = "mobile-action-control__button";

    this.button.innerHTML = `
        <span
          class="mobile-action-control__key"
          aria-hidden="true"
        >
          A
        </span>
      `;

    this.label = document.createElement("span");

    this.label.className = "mobile-action-control__label";

    this.root.append(this.button, this.label);

    options.parent.append(this.root);

    this.button.addEventListener("pointerdown", (event) => {
      event.preventDefault();

      if (!this.enabled) {
        return;
      }

      options.onPress();
    });
  }

  public show(label: string): void {
    const normalizedLabel = label.trim();

    if (!normalizedLabel) {
      this.hide();
      return;
    }

    this.label.textContent = normalizedLabel;

    this.button.setAttribute("aria-label", normalizedLabel);

    this.root.hidden = false;
  }

  public hide(): void {
    this.root.hidden = true;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    this.button.disabled = !enabled;

    this.root.classList.toggle("mobile-action-control--disabled", !enabled);
  }

  public destroy(): void {
    this.root.remove();
  }
}
