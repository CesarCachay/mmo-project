import Phaser from "phaser";

import { AccountHttpClient } from "../account/account-http.client";
import {
  LocalAuthHttpClient,
  LocalAuthHttpError,
} from "../account/local-auth-http.client";
import { GoogleIdentityClient } from "../account/google-identity.client";
import { selectedTrainerStore } from "../account/selected-trainer.store";

import { setAccountShellAuthenticated } from "../account/account-shell.controller";

export class AccountLoginScene extends Phaser.Scene {
  private readonly accountHttpClient = new AccountHttpClient();
  private readonly localAuthHttpClient = new LocalAuthHttpClient();
  private readonly googleIdentityClient = new GoogleIdentityClient();

  private isAuthenticating = false;

  constructor() {
    super("AccountLoginScene");
  }

  create(): void {
    setAccountShellAuthenticated(false);

    this.input.keyboard?.disableGlobalCapture();

    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);

    const container = document.createElement("div");

    container.className = "join-panel account-login-panel";

    container.innerHTML = `
      <div class="join-header">
        <h1 class="join-title">
          MMO-Trainer
        </h1>
      </div>

      <div class="account-login-copy">
        Inicia sesión para continuar
      </div>

      <form
        class="account-local-form"
        data-login-form
      >
        <label class="account-local-field">
          <span>ID</span>

          <input
            class="account-local-input"
            type="text"
            autocomplete="username"
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
            autocomplete="current-password"
            maxlength="128"
            data-password
          />
        </label>

        <button
          class="account-local-button"
          type="submit"
          data-login-button
        >
          Iniciar sesión
        </button>
      </form>

      <div class="account-register-prompt">
        ¿No tienes una cuenta?

        <button
          type="button"
          class="account-text-button"
          data-register-link
        >
          Crear cuenta
        </button>
      </div>

      <div class="account-auth-divider">
        <span>o</span>
      </div>

      <div
        class="account-google-button"
        data-google-button
      ></div>

      <div
        class="account-login-status"
        data-login-status
      ></div>

      <p class="join-hint">
        Tu sesión se mantiene protegida
        mediante una cookie segura.
      </p>
    `;

    const domElement = this.add
      .dom(width / 2, height / 2, container)
      .setOrigin(0.5, 0.5);

    const form = container.querySelector<HTMLFormElement>("[data-login-form]");

    const loginIdInput =
      container.querySelector<HTMLInputElement>("[data-login-id]");

    const passwordInput =
      container.querySelector<HTMLInputElement>("[data-password]");

    const loginButton = container.querySelector<HTMLButtonElement>(
      "[data-login-button]",
    );

    const registerLink = container.querySelector<HTMLButtonElement>(
      "[data-register-link]",
    );

    const googleButton = container.querySelector<HTMLDivElement>(
      "[data-google-button]",
    );

    const status = container.querySelector<HTMLDivElement>(
      "[data-login-status]",
    );

    if (
      !form ||
      !loginIdInput ||
      !passwordInput ||
      !loginButton ||
      !registerLink ||
      !googleButton ||
      !status
    ) {
      throw new Error("Could not create account login UI");
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      void this.handleLocalLogin(
        loginIdInput,
        passwordInput,
        loginButton,
        domElement,
        status,
      );
    });

    registerLink.addEventListener("click", () => {
      domElement.destroy();
      this.scene.start("AccountRegisterScene");
    });

    void this.initialize(domElement, googleButton, status);
  }

  private async initialize(
    domElement: Phaser.GameObjects.DOMElement,
    googleButton: HTMLDivElement,
    status: HTMLDivElement,
  ): Promise<void> {
    this.setStatus(status, "Verificando sesión...");

    try {
      const session = await this.accountHttpClient.getSession();

      if (session) {
        setAccountShellAuthenticated(true);

        this.continueToGame(domElement);
        return;
      }
    } catch {
      // La ausencia de sesión no bloquea el formulario.
    }

    this.setStatus(status, "");

    try {
      await this.googleIdentityClient.renderSignInButton(
        googleButton,
        (credential) => {
          void this.handleGoogleCredential(credential, domElement, status);
        },
      );
    } catch {
      this.setStatus(
        status,
        "Google no está disponible. Puedes ingresar con tu ID.",
      );
    }
  }

  private async handleLocalLogin(
    loginIdInput: HTMLInputElement,
    passwordInput: HTMLInputElement,
    loginButton: HTMLButtonElement,
    domElement: Phaser.GameObjects.DOMElement,
    status: HTMLDivElement,
  ): Promise<void> {
    if (this.isAuthenticating) {
      return;
    }

    const loginId = loginIdInput.value;

    const password = passwordInput.value;

    if (!loginId.trim() || !password) {
      this.setStatus(status, "Ingresa tu ID y contraseña.", true);

      return;
    }

    this.isAuthenticating = true;

    loginIdInput.disabled = true;
    passwordInput.disabled = true;
    loginButton.disabled = true;

    this.setStatus(status, "Iniciando sesión...");

    try {
      await this.localAuthHttpClient.login({
        loginId,
        password,
      });

      setAccountShellAuthenticated(true);

      this.continueToGame(domElement);
    } catch (error) {
      this.isAuthenticating = false;

      loginIdInput.disabled = false;
      passwordInput.disabled = false;
      loginButton.disabled = false;

      this.setStatus(status, this.getLoginErrorMessage(error), true);
    }
  }

  private async handleGoogleCredential(
    credential: string,
    domElement: Phaser.GameObjects.DOMElement,
    status: HTMLDivElement,
  ): Promise<void> {
    if (this.isAuthenticating) {
      return;
    }

    this.isAuthenticating = true;

    this.setStatus(status, "Iniciando sesión...");

    try {
      await this.accountHttpClient.loginWithGoogle(credential);

      setAccountShellAuthenticated(true);

      this.continueToGame(domElement);
    } catch {
      this.isAuthenticating = false;
      this.setStatus(status, "No pudimos iniciar sesión con Google.", true);
    }
  }

  private getLoginErrorMessage(error: unknown): string {
    if (error instanceof LocalAuthHttpError && error.status === 401) {
      return "ID o contraseña incorrectos.";
    }

    return "No pudimos iniciar sesión.";
  }

  private continueToGame(domElement: Phaser.GameObjects.DOMElement): void {
    selectedTrainerStore.clear();
    domElement.destroy();
    this.scene.start("TrainerSelectionScene");
  }

  private setStatus(
    element: HTMLDivElement,
    message: string,
    isError = false,
  ): void {
    element.textContent = message;
    element.classList.toggle("is-error", isError);
  }
}
