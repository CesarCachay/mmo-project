import Phaser from "phaser";

import { KeyboardActionInputSource } from "../input/KeyboardActionInputSource";

import { TouchActionInputSource } from "../input/TouchActionInputSource";

import { CompositeActionInputSource } from "../input/CompositeActionInputSource";

import { InteractionPrompt } from "../ui/InteractionPrompt";

import type { InteractionPromptVariant } from "../ui/InteractionPrompt";

import { MobileActionButton } from "../input/MobileActionButton";

interface WorldInteractionControlsControllerOptions {
  keyboard: Phaser.Input.Keyboard.KeyboardPlugin;
  parent: HTMLElement;
}

interface WorldInteractionPresentation {
  actionLabel: string;
  variant?: InteractionPromptVariant;
}

export class WorldInteractionControlsController {
  private readonly actionInputSource: CompositeActionInputSource;
  private readonly touchActionInputSource: TouchActionInputSource;
  private readonly interactionPrompt: InteractionPrompt;
  private readonly mobileActionButton: MobileActionButton;
  private readonly touchPrimaryQuery: MediaQueryList;

  constructor(options: WorldInteractionControlsControllerOptions) {
    const keyboardActionInputSource = new KeyboardActionInputSource(options.keyboard);

    this.touchActionInputSource = new TouchActionInputSource();

    this.actionInputSource = new CompositeActionInputSource([
      keyboardActionInputSource,
      this.touchActionInputSource,
    ]);

    this.interactionPrompt = new InteractionPrompt();

    this.mobileActionButton = new MobileActionButton({
      parent: options.parent,
      onPress: () => {
        this.touchActionInputSource.trigger("interact");
      },
    });

    this.touchPrimaryQuery = window.matchMedia("(hover: none) and (pointer: coarse)");
  }

  public consumeInteract(): boolean {
    return this.actionInputSource.consume("interact");
  }

  public showAction(presentation: WorldInteractionPresentation): void {
    const actionLabel = presentation.actionLabel.trim();

    if (!actionLabel) {
      this.hide();
      return;
    }

    this.interactionPrompt.show({
      keyLabel: this.getInteractionKeyLabel(),
      actionLabel,
      variant: presentation.variant ?? "default",
    });

    this.mobileActionButton.show(actionLabel);
  }

  public showDialogueContinue(): void {
    this.interactionPrompt.hide();
    this.mobileActionButton.show("Continuar");
  }

  public hide(): void {
    this.interactionPrompt.hide();
    this.mobileActionButton.hide();
    this.touchActionInputSource.reset();
  }

  public reset(): void {
    this.touchActionInputSource.reset();
    this.interactionPrompt.hide();
    this.mobileActionButton.hide();
  }

  public destroy(): void {
    this.reset();
    this.interactionPrompt.destroy();
    this.mobileActionButton.destroy();
  }

  private getInteractionKeyLabel(): "A" | "E" {
    return this.touchPrimaryQuery.matches ? "A" : "E";
  }
}
