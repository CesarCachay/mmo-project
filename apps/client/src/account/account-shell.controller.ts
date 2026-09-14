import { AccountSessionHttpClient } from "./account-session-http.client";

import { selectedTrainerStore } from "./selected-trainer.store";

export class AccountShellController {
  private readonly shell: HTMLDivElement;
  private readonly toolbar: HTMLDivElement;
  private readonly logoutButton: HTMLButtonElement;
  private readonly status: HTMLSpanElement;

  private readonly accountSessionHttpClient = new AccountSessionHttpClient();

  private isLoggingOut = false;

  constructor() {
    const app = document.getElementById("app");

    if (!(app instanceof HTMLDivElement)) {
      throw new Error('Account shell requires "#app"');
    }

    const parent = app.parentElement;

    if (!parent) {
      throw new Error('"#app" does not have a parent element');
    }

    this.shell = document.createElement("div");

    this.shell.id = "game-shell";

    this.toolbar = document.createElement("div");

    this.toolbar.className = "account-toolbar";

    this.toolbar.hidden = true;

    this.status = document.createElement("span");

    this.status.className = "account-toolbar-status";

    this.logoutButton = document.createElement("button");

    this.logoutButton.type = "button";

    this.logoutButton.className = "account-logout-button";

    this.logoutButton.textContent = "Cerrar sesión";

    this.logoutButton.addEventListener("click", () => {
      void this.handleLogout();
    });

    this.toolbar.append(this.status, this.logoutButton);

    parent.insertBefore(this.shell, app);

    this.shell.append(this.toolbar, app);
  }

  setAuthenticated(authenticated: boolean): void {
    this.toolbar.hidden = !authenticated;

    if (!authenticated) {
      this.status.textContent = "";
    }
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
       * Trainer selection is only runtime state.
       * It must disappear with the Account session.
       */
      selectedTrainerStore.clear();

      this.setAuthenticated(false);

      /*
       * Reload is intentional:
       *
       * - destroys Phaser cleanly
       * - closes the Socket.IO connection
       * - destroys every gameplay DOM overlay
       * - bootstraps AccountLoginScene again
       * - AccountLoginScene verifies that the
       *   HttpOnly session no longer exists
       *
       * This avoids introducing Account/logout
       * orchestration inside GameScene.
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
