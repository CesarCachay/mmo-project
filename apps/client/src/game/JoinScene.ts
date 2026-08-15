import Phaser from "phaser";
import { PLAYER_AVATARS } from "./config/playerAssets";
import type { PlayerAvatarId } from "@cesar-mmo/shared";

export class JoinScene extends Phaser.Scene {
  private errorMessage = "";

  private initialDisplayName = "";

  private selectedAvatar: PlayerAvatarId = "male-01";

  constructor() {
    super("JoinScene");
  }

  init(data?: {
    errorMessage?: string;
    displayName?: string;
    avatarId?: PlayerAvatarId;
  }) {
    this.errorMessage = data?.errorMessage ?? "";
    this.initialDisplayName = data?.displayName ?? "";
    this.selectedAvatar = data?.avatarId ?? "male-01";
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

        <div class="join-avatar-field">
          <span class="join-label">
            Choose your character
          </span>

          <div class="join-avatar-options">

            <button
              class="join-avatar-option selected"
              type="button"
              data-avatar="male-01"
            >
              <div
                class="join-avatar-preview"
                style="
                  background-image:
                    url('/${PLAYER_AVATARS["male-01"].path}/walk-down.png');
                "
              ></div>

              <span class="join-avatar-label">
                ${PLAYER_AVATARS["male-01"].label}
              </span>
            </button>

            <button
              class="join-avatar-option"
              type="button"
              data-avatar="female-01"
            >
              <div
                class="join-avatar-preview"
                style="
                  background-image:
                    url('/${PLAYER_AVATARS["female-01"].path}/walk-down.png');
                "
              ></div>

              <span class="join-avatar-label">
                ${PLAYER_AVATARS["female-01"].label}
              </span>
            </button>

          </div>
        </div>

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

    const avatarButtons =
      container.querySelectorAll<HTMLButtonElement>(".join-avatar-option");

    if (!form || !input || !errorText) {
      throw new Error("Could not create join form");
    }

    input.value = this.initialDisplayName;
    errorText.textContent = this.errorMessage;

    const updateAvatarSelection = () => {
      avatarButtons.forEach((button) => {
        button.classList.toggle(
          "selected",
          button.dataset.avatar === this.selectedAvatar
        );
      });
    };

    avatarButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const avatarId = button.dataset.avatar;

        if (avatarId !== "male-01" && avatarId !== "female-01") {
          return;
        }

        this.selectedAvatar = avatarId;

        updateAvatarSelection();
      });
    });

    updateAvatarSelection();

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
        avatarId: this.selectedAvatar,
      });
    });

    input.focus();
  }
}
