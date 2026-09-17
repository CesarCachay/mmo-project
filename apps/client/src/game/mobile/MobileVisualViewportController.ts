const KEYBOARD_THRESHOLD_PX = 120;

export class MobileVisualViewportController {
  private readonly root: HTMLElement;
  private readonly visualViewport: VisualViewport | null;

  constructor(root: HTMLElement) {
    this.root = root;

    this.visualViewport = window.visualViewport;

    this.update();

    this.visualViewport?.addEventListener("resize", this.handleViewportChange);

    this.visualViewport?.addEventListener("scroll", this.handleViewportChange);

    window.addEventListener("resize", this.handleViewportChange);
  }

  public destroy(): void {
    this.visualViewport?.removeEventListener("resize", this.handleViewportChange);

    this.visualViewport?.removeEventListener("scroll", this.handleViewportChange);

    window.removeEventListener("resize", this.handleViewportChange);

    this.root.style.removeProperty("--game-keyboard-inset");

    this.root.classList.remove("game-viewport--keyboard-open");
  }

  private readonly handleViewportChange = (): void => {
    this.update();
  };

  private update(): void {
    const viewport = this.visualViewport;

    if (!viewport) {
      this.setKeyboardInset(0);
      return;
    }

    const layoutHeight = window.innerHeight;

    const visualBottom = viewport.height + viewport.offsetTop;

    const keyboardInset = Math.max(0, layoutHeight - visualBottom);

    this.setKeyboardInset(keyboardInset);
  }

  private setKeyboardInset(inset: number): void {
    const keyboardOpen = inset >= KEYBOARD_THRESHOLD_PX;
    this.root.style.setProperty("--game-keyboard-inset", `${keyboardOpen ? inset : 0}px`);
    this.root.classList.toggle("game-viewport--keyboard-open", keyboardOpen);
  }
}
