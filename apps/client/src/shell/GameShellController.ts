const GAME_SHELL_ID = "game-shell";
const GAME_STAGE_ID = "game-stage";

export class GameShellController {
  private readonly shell: HTMLDivElement;

  private readonly topBar: HTMLElement;

  private readonly topBarCenter: HTMLDivElement;

  private readonly topBarActions: HTMLDivElement;

  constructor() {
    const app = document.getElementById("app");

    if (!(app instanceof HTMLDivElement)) {
      throw new Error('Game shell requires "#app"');
    }

    const parent = app.parentElement;

    if (!parent) {
      throw new Error('"#app" does not have a parent element');
    }

    // ---------------------------------------------------------
    // Game shell
    // ---------------------------------------------------------

    this.shell = document.createElement("div");

    this.shell.id = GAME_SHELL_ID;

    this.shell.className = "game-shell";

    // ---------------------------------------------------------
    // Top bar
    // ---------------------------------------------------------

    this.topBar = document.createElement("header");

    this.topBar.className = "game-shell__topbar";

    this.topBar.hidden = true;

    // ---------------------------------------------------------
    // Brand
    // ---------------------------------------------------------

    const brand = document.createElement("div");

    brand.className = "game-shell__brand";

    brand.textContent = "POKE-GANGTERS";

    // ---------------------------------------------------------
    // Center slot
    //
    // Current map / future location information.
    // ---------------------------------------------------------

    this.topBarCenter = document.createElement("div");

    this.topBarCenter.className = "game-shell__topbar-center";

    // ---------------------------------------------------------
    // Actions slot
    //
    // Trainer identity
    // Account menu
    // Settings
    // etc.
    // ---------------------------------------------------------

    this.topBarActions = document.createElement("div");

    this.topBarActions.className = "game-shell__topbar-actions";

    this.topBar.append(brand, this.topBarCenter, this.topBarActions);

    // ---------------------------------------------------------
    // Game viewport
    // ---------------------------------------------------------

    const viewport = document.createElement("main");

    viewport.className = "game-shell__viewport";

    const stage = document.createElement("div");

    stage.id = GAME_STAGE_ID;

    stage.className = "game-shell__stage";

    // ---------------------------------------------------------
    // DOM structure
    // ---------------------------------------------------------

    parent.insertBefore(this.shell, app);

    stage.append(app);

    viewport.append(stage);

    this.shell.append(this.topBar, viewport);
  }

  public getTopBarCenter(): HTMLElement {
    return this.topBarCenter;
  }

  public getTopBarActions(): HTMLElement {
    return this.topBarActions;
  }

  public setAuthenticated(authenticated: boolean): void {
    this.shell.classList.toggle("game-shell--authenticated", authenticated);

    this.topBar.hidden = !authenticated;
  }
}

let controller: GameShellController | undefined;

export function initializeGameShell(): GameShellController {
  if (!controller) {
    controller = new GameShellController();
  }

  return controller;
}
