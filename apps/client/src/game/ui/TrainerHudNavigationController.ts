import type { TrainerPanelController } from "./TrainerPanelController";

import { RightHudRail } from "./RightHudRail";

import { MobileTrainerHudDock } from "./MobileTrainerHudDock";

export class TrainerHudNavigationController {
  private readonly trainerPanelController: TrainerPanelController;
  private readonly rightHudRail: RightHudRail;
  private readonly mobileDock: MobileTrainerHudDock;

  constructor(trainerPanelController: TrainerPanelController) {
    this.trainerPanelController = trainerPanelController;

    const onPartyRequested = (): void => {
      this.trainerPanelController.toggleParty();
    };

    const onBagRequested = (): void => {
      this.trainerPanelController.toggleInventory();
    };

    const onTrainerRequested = (): void => {
      this.trainerPanelController.toggleTrainer();
    };

    this.rightHudRail = new RightHudRail({
      onPartyRequested,
      onBagRequested,
      onTrainerRequested,
    });

    this.mobileDock = new MobileTrainerHudDock({
      onPartyRequested,
      onBagRequested,
      onTrainerRequested,
    });
  }

  public update(): void {
    const activePanel = this.trainerPanelController.activePanel;
    this.rightHudRail.setActivePanel(activePanel);
    this.mobileDock.setActivePanel(activePanel);
  }

  public setVisible(visible: boolean): void {
    this.rightHudRail.setVisible(visible);
    this.mobileDock.setVisible(visible);
  }

  public destroy(): void {
    this.rightHudRail.destroy();
    this.mobileDock.destroy();
  }
}
