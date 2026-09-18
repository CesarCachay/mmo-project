const GAME_VIEWPORT_ID = "game-shell-viewport";

export class GameViewportOverlay {
  private readonly root: HTMLDivElement;

  constructor(className?: string) {
    const viewport = document.getElementById(GAME_VIEWPORT_ID);

    if (!(viewport instanceof HTMLElement)) {
      throw new Error(`GameViewportOverlay requires "#${GAME_VIEWPORT_ID}"`);
    }

    this.root = document.createElement("div");

    this.root.className = "game-viewport-overlay";

    if (className) {
      this.root.classList.add(className);
    }

    viewport.append(this.root);
  }

  public mount(element: HTMLElement): void {
    this.root.replaceChildren(element);
  }

  public setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  public get isVisible(): boolean {
    return !this.root.hidden;
  }

  public destroy(): void {
    this.root.remove();
  }
}
