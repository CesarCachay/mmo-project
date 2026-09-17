import Phaser from "phaser";

import {
  LocalAuthHttpClient,
  LocalAuthHttpError,
} from "../account/local-auth-http.client";

import { selectedTrainerStore } from "../account/selected-trainer.store";

import { setAccountShellAuthenticated } from "../account/account-shell.controller";

import { GameViewportOverlay } from "../shell/GameViewportOverlay";

export class AccountRegisterScene extends Phaser.Scene {
  private readonly localAuthHttpClient = new LocalAuthHttpClient();

  private viewportOverlay?: GameViewportOverlay;

  private isRegistering = false;

  constructor() {
    super("AccountRegisterScene");
  }

  create(): void {
    setAccountShellAuthenticated(false);

    this.input.keyboard?.disableGlobalCapture();

    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);

    const container = document.createElement("div");

    container.className = "join-panel account-login-panel";

    container.innerHTML = `
      <div class="account-register-navigation">
        <button type="button" class="account-back-button" data-back-button>
          ← Atrás
        </button>
      </div>

      <div class="join-header">
        <h1 class="join-title">
          POKE-Gangsters
        </h1>
      </div>

      <div class="account-login-copy">
        Crea tu cuenta
      </div>

      <form
        class="account-local-form"
        data-register-form
      >
        <label class="account-local-field">
          <span>ID</span>

          <input
            class="account-local-input"
            type="text"
            autocomplete="username"
            minlength="3"
            maxlength="32"
            spellcheck="false"
            data-login-id
          />
        </label>

        <label class="account-local-field">
          <span>Contraseña</span>

          <input
            class="account-local-input"
            type="password"
            autocomplete="new-password"
            minlength="10"
            maxlength="128"
            data-password
          />
        </label>

        <label class="account-local-field">
          <span>
            Confirmar contraseña
          </span>

          <input
            class="account-local-input"
            type="password"
            autocomplete="new-password"
            minlength="10"
            maxlength="128"
            data-confirm-password
          />
        </label>

        <button
          class="account-local-button"
          type="submit"
          data-register-button
        >
          Crear cuenta
        </button>
      </form>

      <div class="account-register-prompt">
        ¿Ya tienes una cuenta?

        <button
          type="button"
          class="account-text-button"
          data-login-link
        >
          Iniciar sesión
        </button>
      </div>

      <div
        class="account-login-status"
        data-register-status
      ></div>

      <p class="join-hint">
        Tu contraseña nunca se almacena
        directamente en el navegador.
      </p>
    `;

    this.viewportOverlay = new GameViewportOverlay("account-scene-overlay");
    this.viewportOverlay.mount(container);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.viewportOverlay?.destroy();
      this.viewportOverlay = undefined;
    });

    const form = container.querySelector<HTMLFormElement>("[data-register-form]");

    const backButton = container.querySelector<HTMLButtonElement>("[data-back-button]");

    const loginIdInput = container.querySelector<HTMLInputElement>("[data-login-id]");

    const passwordInput = container.querySelector<HTMLInputElement>("[data-password]");

    const confirmPasswordInput = container.querySelector<HTMLInputElement>(
      "[data-confirm-password]"
    );

    const registerButton = container.querySelector<HTMLButtonElement>(
      "[data-register-button]"
    );

    const loginLink = container.querySelector<HTMLButtonElement>("[data-login-link]");

    const status = container.querySelector<HTMLDivElement>("[data-register-status]");

    if (
      !form ||
      !loginIdInput ||
      !passwordInput ||
      !confirmPasswordInput ||
      !registerButton ||
      !loginLink ||
      !backButton ||
      !status
    ) {
      throw new Error("Could not create account register UI");
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      void this.handleRegister(
        loginIdInput,
        passwordInput,
        confirmPasswordInput,
        registerButton,
        backButton,
        loginLink,
        status
      );
    });

    loginLink.addEventListener("click", () => {
      if (this.isRegistering) {
        return;
      }
      this.scene.start("AccountLoginScene");
    });

    backButton.addEventListener("click", () => {
      if (this.isRegistering) {
        return;
      }
      this.scene.start("AccountLoginScene");
    });
  }

  private async handleRegister(
    loginIdInput: HTMLInputElement,
    passwordInput: HTMLInputElement,
    confirmPasswordInput: HTMLInputElement,
    registerButton: HTMLButtonElement,
    backButton: HTMLButtonElement,
    loginLink: HTMLButtonElement,
    status: HTMLDivElement
  ): Promise<void> {
    if (this.isRegistering) {
      return;
    }

    const loginId = loginIdInput.value;

    const password = passwordInput.value;

    const confirmPassword = confirmPasswordInput.value;

    if (!loginId.trim()) {
      this.setStatus(status, "Ingresa un ID.", true);

      return;
    }

    if (!password || !confirmPassword) {
      this.setStatus(status, "Ingresa y confirma tu contraseña.", true);

      return;
    }

    if (password !== confirmPassword) {
      this.setStatus(status, "Las contraseñas no coinciden.", true);

      return;
    }

    this.isRegistering = true;

    this.setControlsDisabled(
      loginIdInput,
      passwordInput,
      confirmPasswordInput,
      registerButton,
      backButton,
      loginLink,
      true
    );

    this.setStatus(status, "Creando cuenta...");

    try {
      await this.localAuthHttpClient.register({
        loginId,
        password,
      });

      setAccountShellAuthenticated(true);

      selectedTrainerStore.clear();

      this.scene.start("TrainerSelectionScene");
    } catch (error) {
      this.isRegistering = false;

      this.setControlsDisabled(
        loginIdInput,
        passwordInput,
        confirmPasswordInput,
        registerButton,
        backButton,
        loginLink,
        false
      );

      this.setStatus(status, this.getRegisterErrorMessage(error), true);
    }
  }

  private getRegisterErrorMessage(error: unknown): string {
    if (error instanceof LocalAuthHttpError) {
      if (error.status === 409) {
        return "Ese ID ya está registrado.";
      }

      if (error.status === 400) {
        return "Revisa el ID y la contraseña ingresados.";
      }
    }

    return "No pudimos crear la cuenta.";
  }

  private setControlsDisabled(
    loginIdInput: HTMLInputElement,
    passwordInput: HTMLInputElement,
    confirmPasswordInput: HTMLInputElement,
    registerButton: HTMLButtonElement,
    backButton: HTMLButtonElement,
    loginLink: HTMLButtonElement,
    disabled: boolean
  ): void {
    loginIdInput.disabled = disabled;
    passwordInput.disabled = disabled;
    confirmPasswordInput.disabled = disabled;
    registerButton.disabled = disabled;
    backButton.disabled = disabled;
    loginLink.disabled = disabled;
  }

  private setStatus(element: HTMLDivElement, message: string, isError = false): void {
    element.textContent = message;
    element.classList.toggle("is-error", isError);
  }
}
