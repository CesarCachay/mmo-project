export interface ModernBattleMessagePanelBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ModernBattleMessagePanelViewport {
  readonly width: number;
  readonly height: number;
}

const DEFAULT_MESSAGE_DURATION_MS = 900;

export class ModernBattleMessagePanel {
  private readonly root: HTMLDivElement;
  private readonly surface: HTMLDivElement;
  private readonly text: HTMLDivElement;

  private pendingTimer?: number;

  private pendingResolve?: () => void;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "battle-modern-message";
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-live", "polite");

    this.surface = document.createElement("div");
    this.surface.className = [
      "battle-modern-message__surface",
      "battle-ui-modern__surface",
    ].join(" ");

    this.text = document.createElement("div");
    this.text.className = "battle-modern-message__text";

    this.surface.appendChild(this.text);

    this.root.appendChild(this.surface);

    parent.appendChild(this.root);

    this.clear();
  }

  public setBounds(
    bounds: ModernBattleMessagePanelBounds,
    viewport: ModernBattleMessagePanelViewport
  ): void {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    const left = bounds.x - bounds.width / 2;
    const top = bounds.y - bounds.height / 2;

    this.root.style.left = `${(left / viewport.width) * 100}%`;
    this.root.style.top = `${(top / viewport.height) * 100}%`;
    this.root.style.width = `${(bounds.width / viewport.width) * 100}%`;
    this.root.style.height = `${(bounds.height / viewport.height) * 100}%`;
  }

  public present(
    message: string,
    durationMs: number = DEFAULT_MESSAGE_DURATION_MS
  ): Promise<void> {
    this.finishPendingPresentation();

    this.text.textContent = message;
    this.root.hidden = false;

    const safeDurationMs = Number.isFinite(durationMs)
      ? Math.max(0, durationMs)
      : DEFAULT_MESSAGE_DURATION_MS;

    return new Promise<void>((resolve) => {
      this.pendingResolve = () => resolve();

      this.pendingTimer = window.setTimeout(() => {
        this.pendingTimer = undefined;
        this.pendingResolve = undefined;
        resolve();
      }, safeDurationMs);
    });
  }

  public clear(): void {
    this.finishPendingPresentation();
    this.text.textContent = "";
    this.root.hidden = true;
  }

  public destroy(): void {
    this.clear();
    this.root.remove();
  }

  private finishPendingPresentation(): void {
    if (this.pendingTimer !== undefined) {
      window.clearTimeout(this.pendingTimer);
      this.pendingTimer = undefined;
    }

    const resolve = this.pendingResolve;
    this.pendingResolve = undefined;
    resolve?.();
  }
}
