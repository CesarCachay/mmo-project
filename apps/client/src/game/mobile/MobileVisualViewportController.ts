import { MOBILE_VISUAL_VIEWPORT_STABLE_EVENT } from "./mobileViewportEvents";

const KEYBOARD_THRESHOLD_PX = 120;
const VIEWPORT_STABILIZATION_DELAY_MS = 160;

/**
 * Keeps DOM gameplay sizing aligned with the *visible* browser viewport.
 *
 * iOS Safari can report an intermediate layout viewport while rotating to
 * landscape or while its browser chrome is settling. `window.visualViewport`
 * reflects the actually visible area more reliably, so we publish its stable
 * dimensions as CSS custom properties and notify Phaser once layout has had a
 * chance to reflow.
 *
 * The keyboard path intentionally keeps the last non-keyboard viewport size.
 * Chat already uses --game-keyboard-inset and hides competing gameplay controls;
 * shrinking the whole GameShell to the keyboard viewport would cause a second,
 * unrelated camera resize while typing.
 */
export class MobileVisualViewportController {
  private readonly root: HTMLElement;
  private readonly visualViewport: VisualViewport | null;
  private readonly documentRoot: HTMLElement;

  private firstAnimationFrame?: number;
  private secondAnimationFrame?: number;
  private stabilizationTimer?: number;

  private lastStableWidth?: number;
  private lastStableHeight?: number;
  private lastStableOffsetTop = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.visualViewport = window.visualViewport;
    this.documentRoot = document.documentElement;

    this.syncViewport(false);

    this.visualViewport?.addEventListener("resize", this.handleViewportChange);
    this.visualViewport?.addEventListener("scroll", this.handleViewportChange);

    window.addEventListener("resize", this.handleViewportChange);
    window.addEventListener("orientationchange", this.handleOrientationChange);
    window.addEventListener("pageshow", this.handleViewportChange);

    this.scheduleViewportStabilization();
  }

  public destroy(): void {
    this.visualViewport?.removeEventListener("resize", this.handleViewportChange);
    this.visualViewport?.removeEventListener("scroll", this.handleViewportChange);

    window.removeEventListener("resize", this.handleViewportChange);
    window.removeEventListener("orientationchange", this.handleOrientationChange);
    window.removeEventListener("pageshow", this.handleViewportChange);

    this.cancelScheduledStabilization();

    this.root.style.removeProperty("--game-keyboard-inset");
    this.root.classList.remove("game-viewport--keyboard-open");

    this.documentRoot.style.removeProperty("--game-visual-viewport-width");
    this.documentRoot.style.removeProperty("--game-visual-viewport-height");
    this.documentRoot.style.removeProperty("--game-visual-viewport-offset-top");
  }

  private readonly handleViewportChange = (): void => {
    this.syncViewport(false);
    this.scheduleViewportStabilization();
  };

  private readonly handleOrientationChange = (): void => {
    /*
     * Safari can fire orientationchange before visualViewport has reached its
     * final dimensions. Do an immediate keyboard/state sync, then wait for two
     * animation frames plus one short delayed confirmation.
     */
    this.syncViewport(false);
    this.scheduleViewportStabilization();
  };

  private scheduleViewportStabilization(): void {
    this.cancelScheduledStabilization();

    this.firstAnimationFrame = window.requestAnimationFrame(() => {
      this.firstAnimationFrame = undefined;

      this.secondAnimationFrame = window.requestAnimationFrame(() => {
        this.secondAnimationFrame = undefined;
        this.syncViewport(true);
      });
    });

    this.stabilizationTimer = window.setTimeout(() => {
      this.stabilizationTimer = undefined;
      this.syncViewport(true);
    }, VIEWPORT_STABILIZATION_DELAY_MS);
  }

  private cancelScheduledStabilization(): void {
    if (this.firstAnimationFrame !== undefined) {
      window.cancelAnimationFrame(this.firstAnimationFrame);
      this.firstAnimationFrame = undefined;
    }

    if (this.secondAnimationFrame !== undefined) {
      window.cancelAnimationFrame(this.secondAnimationFrame);
      this.secondAnimationFrame = undefined;
    }

    if (this.stabilizationTimer !== undefined) {
      window.clearTimeout(this.stabilizationTimer);
      this.stabilizationTimer = undefined;
    }
  }

  private syncViewport(notifyStable: boolean): void {
    const viewport = this.visualViewport;

    if (!viewport) {
      this.setKeyboardInset(0);
      this.publishViewportSize(window.innerWidth, window.innerHeight, 0);

      if (notifyStable) {
        this.notifyViewportStable();
      }

      return;
    }

    const layoutHeight = window.innerHeight;
    const visualBottom = viewport.height + viewport.offsetTop;
    const keyboardInset = Math.max(0, layoutHeight - visualBottom);
    const keyboardOpen = keyboardInset >= KEYBOARD_THRESHOLD_PX;

    this.setKeyboardInset(keyboardInset);

    /*
     * Keep the last non-keyboard dimensions as the gameplay viewport. The
     * virtual keyboard is handled independently via --game-keyboard-inset.
     */
    if (!keyboardOpen) {
      this.lastStableWidth = viewport.width;
      this.lastStableHeight = viewport.height;
      this.lastStableOffsetTop = viewport.offsetTop;

      this.publishViewportSize(
        viewport.width,
        viewport.height,
        viewport.offsetTop
      );
    } else if (
      this.lastStableWidth !== undefined &&
      this.lastStableHeight !== undefined
    ) {
      this.publishViewportSize(
        this.lastStableWidth,
        this.lastStableHeight,
        this.lastStableOffsetTop
      );
    }

    if (notifyStable && !keyboardOpen) {
      this.notifyViewportStable();
    }
  }

  private publishViewportSize(width: number, height: number, offsetTop: number): void {
    this.documentRoot.style.setProperty(
      "--game-visual-viewport-width",
      `${Math.max(1, Math.round(width))}px`
    );

    this.documentRoot.style.setProperty(
      "--game-visual-viewport-height",
      `${Math.max(1, Math.round(height))}px`
    );

    this.documentRoot.style.setProperty(
      "--game-visual-viewport-offset-top",
      `${Math.max(0, Math.round(offsetTop))}px`
    );
  }

  private notifyViewportStable(): void {
    window.dispatchEvent(new Event(MOBILE_VISUAL_VIEWPORT_STABLE_EVENT));
  }

  private setKeyboardInset(inset: number): void {
    const keyboardOpen = inset >= KEYBOARD_THRESHOLD_PX;

    this.root.style.setProperty(
      "--game-keyboard-inset",
      `${keyboardOpen ? inset : 0}px`
    );

    this.root.classList.toggle("game-viewport--keyboard-open", keyboardOpen);
  }
}
