export interface ModernBattleStageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModernBattleStageLayout {
  viewport: {
    width: number;
    height: number;
  };

  battleFieldHeight: number;
  commandAreaHeight: number;

  trainerBounds: ModernBattleStageBounds;
  wildBounds: ModernBattleStageBounds;
}

export class ModernBattleStage {
  private readonly root: HTMLDivElement;
  private readonly battlefield: HTMLDivElement;
  private readonly commandArea: HTMLDivElement;
  private readonly trainerPlatform: HTMLDivElement;
  private readonly wildPlatform: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");

    this.root.className = "battle-modern-stage";

    const backdrop = document.createElement("div");

    backdrop.className = "battle-modern-stage__backdrop";

    const glow = document.createElement("div");

    glow.className = "battle-modern-stage__ambient";

    this.battlefield = document.createElement("div");

    this.battlefield.className = "battle-modern-stage__field";

    const horizon = document.createElement("div");

    horizon.className = "battle-modern-stage__horizon";

    this.trainerPlatform = document.createElement("div");

    this.trainerPlatform.className = [
      "battle-modern-stage__platform",
      "battle-modern-stage__platform--trainer",
    ].join(" ");

    this.wildPlatform = document.createElement("div");

    this.wildPlatform.className = [
      "battle-modern-stage__platform",
      "battle-modern-stage__platform--wild",
    ].join(" ");

    this.battlefield.append(horizon, this.trainerPlatform, this.wildPlatform);

    this.commandArea = document.createElement("div");

    this.commandArea.className = "battle-modern-stage__command";

    const commandGlow = document.createElement("div");

    commandGlow.className = "battle-modern-stage__command-glow";

    this.commandArea.appendChild(commandGlow);

    const label = document.createElement("div");

    label.className = "battle-modern-stage__label";

    label.textContent = "WILD BATTLE";
    this.root.append(backdrop, glow, this.battlefield, this.commandArea, label);
    parent.appendChild(this.root);
  }

  public setLayout(layout: ModernBattleStageLayout): void {
    const { viewport, battleFieldHeight, commandAreaHeight, trainerBounds, wildBounds } =
      layout;

    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    this.battlefield.style.height = `${(battleFieldHeight / viewport.height) * 100}%`;
    this.commandArea.style.top = `${(battleFieldHeight / viewport.height) * 100}%`;
    this.commandArea.style.height = `${(commandAreaHeight / viewport.height) * 100}%`;

    this.positionPlatform(this.trainerPlatform, trainerBounds, viewport);
    this.positionPlatform(this.wildPlatform, wildBounds, viewport);
  }

  public destroy(): void {
    this.root.remove();
  }

  private positionPlatform(
    element: HTMLDivElement,
    bounds: ModernBattleStageBounds,
    viewport: {
      width: number;
      height: number;
    }
  ): void {
    const platformWidth = bounds.width * 0.72;
    const platformHeight = Math.max(24, bounds.height * 0.2);
    const centerX = bounds.x;

    /*
     * La plataforma aparece ligeramente
     * debajo del centro visual del Pokémon.
     */
    const centerY = bounds.y + bounds.height * 0.25;

    element.style.left = `${((centerX - platformWidth / 2) / viewport.width) * 100}%`;
    element.style.top = `${((centerY - platformHeight / 2) / viewport.height) * 100}%`;
    element.style.width = `${(platformWidth / viewport.width) * 100}%`;
    element.style.height = `${(platformHeight / viewport.height) * 100}%`;
  }
}
