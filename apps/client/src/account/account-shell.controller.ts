import { AccountSessionHttpClient } from "./account-session-http.client";

import { selectedTrainerStore } from "./selected-trainer.store";

import type { AccountTrainer } from "./trainer-http.client";

import { initializeGameShell } from "../shell/GameShellController";

const ACCOUNT_MENU_ID = "account-menu";

export class AccountShellController {
  private readonly toolbar: HTMLDivElement;

  private readonly menuTrigger: HTMLButtonElement;

  private readonly triggerAvatar: HTMLSpanElement;

  private readonly triggerName: HTMLSpanElement;

  private readonly menu: HTMLDivElement;

  private readonly menuTrainerContext: HTMLDivElement;

  private readonly menuTrainerName: HTMLSpanElement;

  private readonly logoutButton: HTMLButtonElement;

  private readonly status: HTMLSpanElement;

  private readonly accountSessionHttpClient = new AccountSessionHttpClient();

  private isLoggingOut = false;

  constructor() {
    const gameShell = initializeGameShell();

    // ---------------------------------------------------------
    // Toolbar root
    // ---------------------------------------------------------

    this.toolbar = document.createElement("div");

    this.toolbar.className = "account-toolbar";

    this.toolbar.hidden = true;

    // ---------------------------------------------------------
    // Account menu trigger
    // ---------------------------------------------------------

    this.menuTrigger = document.createElement("button");

    this.menuTrigger.type = "button";

    this.menuTrigger.className = "account-menu-trigger";

    this.menuTrigger.setAttribute("aria-haspopup", "menu");

    this.menuTrigger.setAttribute("aria-expanded", "false");

    this.menuTrigger.setAttribute("aria-controls", ACCOUNT_MENU_ID);

    this.triggerAvatar = document.createElement("span");

    this.triggerAvatar.className = "account-menu-trigger__avatar";

    this.triggerAvatar.setAttribute("aria-hidden", "true");

    this.triggerName = document.createElement("span");

    this.triggerName.className = "account-menu-trigger__name";

    const chevron = document.createElement("span");

    chevron.className = "account-menu-trigger__chevron";

    chevron.textContent = "▾";

    chevron.setAttribute("aria-hidden", "true");

    this.menuTrigger.append(this.triggerAvatar, this.triggerName, chevron);

    // ---------------------------------------------------------
    // Account menu
    // ---------------------------------------------------------

    this.menu = document.createElement("div");

    this.menu.id = ACCOUNT_MENU_ID;

    this.menu.className = "account-menu";

    this.menu.setAttribute("role", "menu");

    this.menu.hidden = true;

    // ---------------------------------------------------------
    // Trainer context
    // ---------------------------------------------------------

    this.menuTrainerContext = document.createElement("div");

    this.menuTrainerContext.className = "account-menu__trainer";

    const trainerLabel = document.createElement("span");

    trainerLabel.className = "account-menu__label";

    trainerLabel.textContent = "Trainer actual";

    this.menuTrainerName = document.createElement("span");

    this.menuTrainerName.className = "account-menu__trainer-name";

    this.menuTrainerContext.append(trainerLabel, this.menuTrainerName);

    // ---------------------------------------------------------
    // Divider
    // ---------------------------------------------------------

    const divider = document.createElement("div");

    divider.className = "account-menu__divider";

    // ---------------------------------------------------------
    // Logout
    // ---------------------------------------------------------

    this.logoutButton = document.createElement("button");

    this.logoutButton.type = "button";

    this.logoutButton.className = "account-menu__item account-menu__item--danger";

    this.logoutButton.textContent = "Cerrar sesión";

    this.logoutButton.setAttribute("role", "menuitem");

    this.logoutButton.addEventListener("click", () => {
      void this.handleLogout();
    });

    // ---------------------------------------------------------
    // Status
    // ---------------------------------------------------------

    this.status = document.createElement("span");

    this.status.className = "account-menu__status";

    // ---------------------------------------------------------
    // Assemble menu
    // ---------------------------------------------------------

    this.menu.append(this.menuTrainerContext, divider, this.logoutButton, this.status);

    this.toolbar.append(this.menuTrigger, this.menu);

    gameShell.getTopBarActions().append(this.toolbar);

    // ---------------------------------------------------------
    // Trigger behavior
    // ---------------------------------------------------------

    this.menuTrigger.addEventListener("click", () => {
      this.toggleMenu();
    });

    // ---------------------------------------------------------
    // Outside click
    // ---------------------------------------------------------

    document.addEventListener("pointerdown", (event) => {
      if (this.menu.hidden) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (this.toolbar.contains(target)) {
        return;
      }

      this.closeMenu();
    });

    // ---------------------------------------------------------
    // Escape
    // ---------------------------------------------------------

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || this.menu.hidden) {
        return;
      }

      event.preventDefault();

      this.closeMenu();

      this.menuTrigger.focus();
    });

    // ---------------------------------------------------------
    // Default authenticated state has no selected Trainer yet.
    // ---------------------------------------------------------

    this.setTrainerContext(undefined);
  }

  public setAuthenticated(authenticated: boolean): void {
    initializeGameShell().setAuthenticated(authenticated);

    this.toolbar.hidden = !authenticated;

    if (!authenticated) {
      this.closeMenu();

      this.status.textContent = "";

      this.setTrainerContext(undefined);
    }
  }

  public setTrainerContext(trainer: AccountTrainer | undefined): void {
    if (!trainer) {
      this.triggerAvatar.textContent = "C";

      this.triggerName.textContent = "Cuenta";

      this.menuTrainerContext.hidden = true;

      this.menuTrainerName.textContent = "";

      this.menuTrigger.title = "Cuenta";

      return;
    }

    const displayName = trainer.displayName.trim() || "Trainer";

    this.triggerAvatar.textContent = this.getInitial(displayName);

    this.triggerName.textContent = displayName;

    this.menuTrainerName.textContent = displayName;

    this.menuTrainerContext.hidden = false;

    this.menuTrigger.title = displayName;
  }

  private toggleMenu(): void {
    if (this.menu.hidden) {
      this.openMenu();

      return;
    }

    this.closeMenu();
  }

  private openMenu(): void {
    this.menu.hidden = false;

    this.menuTrigger.setAttribute("aria-expanded", "true");
  }

  private closeMenu(): void {
    this.menu.hidden = true;

    this.menuTrigger.setAttribute("aria-expanded", "false");
  }

  private getInitial(displayName: string): string {
    return displayName.charAt(0).toLocaleUpperCase();
  }

  private async handleLogout(): Promise<void> {
    if (this.isLoggingOut) {
      return;
    }

    this.isLoggingOut = true;

    this.logoutButton.disabled = true;

    this.logoutButton.textContent = "Cerrando sesión...";

    this.status.textContent = "";

    try {
      await this.accountSessionHttpClient.logout();

      /*
       * Trainer selection is runtime state.
       * It must disappear with the Account session.
       */
      selectedTrainerStore.clear();

      this.setTrainerContext(undefined);

      this.setAuthenticated(false);

      /*
       * Reload is intentional:
       *
       * - destroys Phaser cleanly
       * - closes Socket.IO
       * - destroys gameplay DOM overlays
       * - bootstraps AccountLoginScene again
       * - verifies that the HttpOnly session
       *   no longer exists
       *
       * Logout orchestration remains outside
       * GameScene.
       */
      window.location.reload();
    } catch {
      this.isLoggingOut = false;

      this.logoutButton.disabled = false;

      this.logoutButton.textContent = "Cerrar sesión";

      this.status.textContent = "No se pudo cerrar la sesión.";
    }
  }
}

let controller: AccountShellController | undefined;

export function initializeAccountShell(): AccountShellController {
  if (!controller) {
    controller = new AccountShellController();
  }

  return controller;
}

export function setAccountShellAuthenticated(authenticated: boolean): void {
  controller?.setAuthenticated(authenticated);
}

export function setAccountShellTrainerContext(trainer: AccountTrainer | undefined): void {
  controller?.setTrainerContext(trainer);
}
