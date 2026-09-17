import "./interaction-prompt.css";

export type InteractionPromptVariant =
  | "default"
  | "storage"
  | "healing";

export interface InteractionPromptState {
  readonly keyLabel: string;
  readonly actionLabel: string;
  readonly variant?: InteractionPromptVariant;
}

export class InteractionPrompt {
  private readonly root: HTMLDivElement;
  private readonly key: HTMLSpanElement;
  private readonly action: HTMLSpanElement;

  private visible = false;
  private currentKeyLabel = "";
  private currentActionLabel = "";
  private currentVariant: InteractionPromptVariant = "default";

  constructor() {
    const app = document.getElementById("app");

    if (!(app instanceof HTMLDivElement)) {
      throw new Error(
        'InteractionPrompt requires "#app"',
      );
    }

    this.root = document.createElement("div");
    this.root.className = "interaction-prompt";
    this.root.hidden = true;
    this.root.setAttribute("aria-hidden", "true");

    this.key = document.createElement("span");
    this.key.className = "interaction-prompt__key";

    this.action = document.createElement("span");
    this.action.className = "interaction-prompt__action";

    this.root.append(
      this.key,
      this.action,
    );

    app.append(this.root);
  }

  public show(
    state: InteractionPromptState,
  ): void {
    const keyLabel = state.keyLabel.trim();
    const actionLabel = state.actionLabel.trim();
    const variant = state.variant ?? "default";

    if (!keyLabel || !actionLabel) {
      this.hide();
      return;
    }

    if (this.currentKeyLabel !== keyLabel) {
      this.currentKeyLabel = keyLabel;
      this.key.textContent = keyLabel;
    }

    if (this.currentActionLabel !== actionLabel) {
      this.currentActionLabel = actionLabel;
      this.action.textContent = actionLabel;
    }

    if (this.currentVariant !== variant) {
      this.currentVariant = variant;
      this.root.dataset.variant = variant;
    }

    if (this.visible) {
      return;
    }

    this.visible = true;
    this.root.hidden = false;
    this.root.setAttribute("aria-hidden", "false");

    window.requestAnimationFrame(() => {
      if (!this.visible) {
        return;
      }

      this.root.classList.add(
        "interaction-prompt--visible",
      );
    });
  }

  public hide(): void {
    if (!this.visible) {
      return;
    }

    this.visible = false;

    this.root.classList.remove(
      "interaction-prompt--visible",
    );

    this.root.setAttribute(
      "aria-hidden",
      "true",
    );

    /*
     * Keep the element in layout for the tiny fade-out,
     * then remove it from rendering.
     */
    window.setTimeout(() => {
      if (!this.visible) {
        this.root.hidden = true;
      }
    }, 110);
  }

  public destroy(): void {
    this.visible = false;
    this.root.remove();
  }
}
