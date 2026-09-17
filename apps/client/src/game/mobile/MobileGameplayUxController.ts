import { MobileOrientationHint } from "./MobileOrientationHint";

import { MobileVisualViewportController } from "./MobileVisualViewportController";

export class MobileGameplayUxController {
  private readonly orientationHint: MobileOrientationHint;
  private readonly visualViewport: MobileVisualViewportController;

  constructor(parent: HTMLElement) {
    this.orientationHint = new MobileOrientationHint(parent);
    this.visualViewport = new MobileVisualViewportController(parent);
  }

  public destroy(): void {
    this.orientationHint.destroy();
    this.visualViewport.destroy();
  }
}
