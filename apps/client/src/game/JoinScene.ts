import Phaser from "phaser";

export class JoinScene extends Phaser.Scene {
  private errorMessage = "";

  private initialDisplayName = "";

  constructor() {
    super("JoinScene");
  }

  init(data?: { errorMessage?: string; displayName?: string }) {
    this.errorMessage = data?.errorMessage ?? "";

    this.initialDisplayName = data?.displayName ?? "";
  }

  create() {
    this.input.keyboard?.disableGlobalCapture();

    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);

    this.createJoinForm();
  }

  private createJoinForm() {
    const { width, height } = this.scale;

    const container = document.createElement("div");

    container.className = "join-panel";

    container.innerHTML = `
      <div class="join-header">
        <h1 class="join-title">MMO</h1>
        <p class="join-subtitle">
          CESAR EDITION
        </p>
      </div>

      <form class="join-form">
        <div class="join-field">
          <label
            class="join-label"
            for="player-name"
          >
            Choose your player name
          </label>

          <input
            id="player-name"
            class="join-input"
            type="text"
            maxlength="16"
            autocomplete="off"
            placeholder="Enter your name"
          />
        </div>

        <div
          class="join-error"
          data-error
        ></div>

        <button
          class="join-button"
          type="submit"
        >
          ENTER WORLD
        </button>

        <p class="join-hint">
          3-16 characters
        </p>
      </form>
    `;

    const domElement = this.add.dom(width / 2, height / 2, container);

    const form = container.querySelector<HTMLFormElement>(".join-form");

    const input = container.querySelector<HTMLInputElement>(".join-input");

    const errorText = container.querySelector<HTMLDivElement>("[data-error]");

    if (!form || !input || !errorText) {
      throw new Error("Could not create join form");
    }

    input.value = this.initialDisplayName;
    errorText.textContent = this.errorMessage;

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const displayName = input.value.trim();

      errorText.textContent = "";

      if (displayName.length < 3) {
        errorText.textContent = "Name must contain at least 3 characters.";

        return;
      }

      if (displayName.length > 16) {
        errorText.textContent = "Name can contain at most 16 characters.";

        return;
      }

      domElement.destroy();

      this.scene.start("GameScene", {
        displayName,
      });
    });

    input.focus();
  }
}
