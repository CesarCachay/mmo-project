import Phaser from "phaser";

import { isPlayerAvatarId, type PlayerAvatarId } from "@cesar-mmo/shared";

import { PLAYER_AVATARS } from "./config/playerAssets";

import { TrainerHttpClient, TrainerHttpError } from "../account/trainer-http.client";

import type { AccountTrainer } from "../account/trainer-http.client";

import { selectedTrainerStore } from "../account/selected-trainer.store";

import { GameViewportOverlay } from "../shell/GameViewportOverlay";

import { WORLD_LOADING_SCENE_KEY } from "./world/world-loading.contract";

const MAX_TRAINERS = 3;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export class TrainerSelectionScene extends Phaser.Scene {
  private readonly trainerHttpClient = new TrainerHttpClient();

  private trainers: AccountTrainer[] = [];

  private selectedAvatar: PlayerAvatarId = "male-01";

  private isCreating = false;

  private slotsElement?: HTMLDivElement;

  private creationElement?: HTMLDivElement;

  private statusElement?: HTMLDivElement;

  private viewportOverlay?: GameViewportOverlay;

  private initialErrorMessage = "";

  constructor() {
    super("TrainerSelectionScene");
  }

  init(data?: { errorMessage?: string }): void {
    this.initialErrorMessage = data?.errorMessage ?? "";
  }

  create(): void {
    this.input.keyboard?.disableGlobalCapture();

    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);

    const container = document.createElement("div");

    container.className = "trainer-selection-panel";

    const avatarOptionsHtml = Object.values(PLAYER_AVATARS)
      .map(
        (avatar) => `
          <button
            class="trainer-avatar-option${avatar.id === this.selectedAvatar ? " selected" : ""}"
            type="button"
            data-avatar="${avatar.id}"
          >
            <span
              class="trainer-avatar-sprite"
              style="
                background-image:
                  url('/${avatar.path}/walk-down.png');
              "
            ></span>

            <span>
              ${escapeHtml(avatar.label)}
            </span>
          </button>
        `
      )
      .join("");

    container.innerHTML = `
      <div class="trainer-selection-header">
        <div>
          <h1 class="trainer-selection-title">
            Elige tu Trainer
          </h1>

          <p class="trainer-selection-description">
            Cada cuenta puede tener hasta
            ${MAX_TRAINERS} Trainers.
          </p>
        </div>
      </div>

      <div
        class="trainer-selection-status"
        data-trainer-status
      >
        Cargando Trainers...
      </div>

      <div
        class="trainer-slots"
        data-trainer-slots
      ></div>

      <div
        class="trainer-create-panel"
        data-trainer-create
        hidden
      >
        <div class="trainer-create-header">
          <div>
            <h2>
              Nuevo Trainer
            </h2>

            <p>
              Configura tu personaje.
            </p>
          </div>

          <button
            class="trainer-create-close"
            type="button"
            data-create-close
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>

        <form
          class="trainer-create-form"
          data-create-form
        >
          <label
            class="trainer-create-label"
            for="trainer-name"
          >
            Nombre
          </label>

          <input
            id="trainer-name"
            class="trainer-create-input"
            data-create-name
            type="text"
            minlength="3"
            maxlength="16"
            autocomplete="off"
            placeholder="Nombre del Trainer"
          />

          <div class="trainer-create-label">
            Personaje
          </div>

          <div class="trainer-avatar-grid">
            ${avatarOptionsHtml}
          </div>

          <div
            class="trainer-create-error"
            data-create-error
          ></div>

          <button
            class="trainer-create-submit"
            type="submit"
          >
            CREAR TRAINER
          </button>
        </form>
      </div>
    `;

    this.viewportOverlay = new GameViewportOverlay("trainer-selection-scene-overlay");

    this.viewportOverlay.mount(container);
    this.slotsElement =
      container.querySelector<HTMLDivElement>("[data-trainer-slots]") ?? undefined;

    this.creationElement =
      container.querySelector<HTMLDivElement>("[data-trainer-create]") ?? undefined;

    this.statusElement =
      container.querySelector<HTMLDivElement>("[data-trainer-status]") ?? undefined;

    if (!this.slotsElement || !this.creationElement || !this.statusElement) {
      throw new Error("Could not create Trainer selection UI");
    }

    this.configureCreateForm(container);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.viewportOverlay?.destroy();
      this.viewportOverlay = undefined;
    });

    void this.loadTrainers();
  }

  private async loadTrainers(): Promise<void> {
    this.setStatus("Cargando Trainers...");

    try {
      this.trainers = await this.trainerHttpClient.listTrainers();
      this.renderTrainerSlots();

      if (this.initialErrorMessage) {
        this.setStatus(this.initialErrorMessage, true);
        this.initialErrorMessage = "";
        return;
      }

      if (this.trainers.length === 0) {
        this.setStatus("Crea tu primer Trainer para comenzar.");
        this.openCreatePanel();
        return;
      }

      this.setStatus("Selecciona un Trainer.");
    } catch (error: unknown) {
      if (error instanceof TrainerHttpError && error.status === 401) {
        selectedTrainerStore.clear();
        this.scene.start("AccountLoginScene");
        return;
      }

      this.setStatus("No se pudieron cargar tus Trainers.", true);
    }
  }

  private renderTrainerSlots(): void {
    const slots = this.slotsElement;

    if (!slots) {
      return;
    }

    const html: string[] = [];

    for (let index = 0; index < MAX_TRAINERS; index += 1) {
      const trainer = this.trainers[index];

      if (trainer) {
        html.push(this.renderTrainerCard(trainer, index));
        continue;
      }
      html.push(this.renderEmptySlot(index));
    }

    slots.innerHTML = html.join("");

    slots.querySelectorAll<HTMLButtonElement>("[data-trainer-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const trainerId = button.dataset.trainerId;

        if (!trainerId) {
          return;
        }

        this.selectTrainer(trainerId);
      });
    });

    slots.querySelectorAll<HTMLButtonElement>("[data-empty-slot]").forEach((button) => {
      button.addEventListener("click", () => {
        this.openCreatePanel();
      });
    });
  }

  private renderTrainerCard(
    trainer: AccountTrainer,

    index: number
  ): string {
    const avatar = trainer.avatarId ? PLAYER_AVATARS[trainer.avatarId] : undefined;

    const avatarStyle = avatar
      ? `
          background-image:
            url('/${avatar.path}/walk-down.png');
        `
      : "";

    const displayName = escapeHtml(trainer.displayName ?? "Trainer");

    const selected = selectedTrainerStore.getSelected()?.trainerId === trainer.trainerId;

    return `
      <button
        class="
          trainer-slot
          trainer-slot-filled
          ${selected ? "selected" : ""}
        "
        type="button"
        data-trainer-id="${trainer.trainerId}"
      >
        <span class="trainer-slot-number">
          SLOT ${index + 1}
        </span>

        <span
          class="trainer-slot-avatar"
          style="${avatarStyle}"
        ></span>

        <span class="trainer-slot-name">
          ${displayName}
        </span>

        <span class="trainer-slot-action">
          ${selected ? "SELECCIONADO" : "SELECCIONAR"}
        </span>
      </button>
    `;
  }

  private renderEmptySlot(index: number): string {
    return `
      <button
        class="
          trainer-slot
          trainer-slot-empty
        "
        type="button"
        data-empty-slot
      >
        <span class="trainer-slot-number">
          SLOT ${index + 1}
        </span>

        <span class="trainer-slot-plus">
          +
        </span>

        <span class="trainer-slot-empty-title">
          Crear Trainer
        </span>

        <span class="trainer-slot-empty-copy">
          Nuevo personaje
        </span>
      </button>
    `;
  }

  private selectTrainer(trainerId: string): void {
    const trainer = this.trainers.find((candidate) => candidate.trainerId === trainerId);

    if (!trainer) {
      return;
    }

    this.enterWorld(trainer);
  }

  private configureCreateForm(container: HTMLDivElement): void {
    const form = container.querySelector<HTMLFormElement>("[data-create-form]");

    const nameInput = container.querySelector<HTMLInputElement>("[data-create-name]");

    const errorElement = container.querySelector<HTMLDivElement>("[data-create-error]");

    const closeButton = container.querySelector<HTMLButtonElement>("[data-create-close]");

    const avatarButtons = container.querySelectorAll<HTMLButtonElement>("[data-avatar]");

    if (!form || !nameInput || !errorElement || !closeButton) {
      throw new Error("Could not create Trainer form");
    }

    const updateAvatarSelection = (): void => {
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

        if (!isPlayerAvatarId(avatarId)) {
          return;
        }

        this.selectedAvatar = avatarId;

        updateAvatarSelection();
      });
    });

    closeButton.addEventListener("click", () => {
      this.closeCreatePanel();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      void this.createTrainer(nameInput, errorElement);
    });

    updateAvatarSelection();
  }

  private async createTrainer(
    nameInput: HTMLInputElement,
    errorElement: HTMLDivElement
  ): Promise<void> {
    if (this.isCreating) {
      return;
    }

    const displayName = nameInput.value.trim();

    errorElement.textContent = "";

    if (displayName.length < 3 || displayName.length > 16) {
      errorElement.textContent = "El nombre debe tener entre 3 y 16 caracteres.";

      return;
    }

    this.isCreating = true;

    try {
      const trainer = await this.trainerHttpClient.createTrainer({
        displayName,
        avatarId: this.selectedAvatar,
      });

      nameInput.value = "";

      this.closeCreatePanel();

      this.enterWorld(trainer);
    } catch (error: unknown) {
      if (error instanceof TrainerHttpError && error.status === 409) {
        errorElement.textContent = "Ya tienes el máximo de 3 Trainers.";
        return;
      }

      if (error instanceof TrainerHttpError && error.status === 401) {
        selectedTrainerStore.clear();
        this.scene.start("AccountLoginScene");
        return;
      }

      errorElement.textContent = "No se pudo crear el Trainer.";
    } finally {
      this.isCreating = false;
    }
  }

  private openCreatePanel(): void {
    if (this.trainers.length >= MAX_TRAINERS) {
      this.setStatus("Ya tienes el máximo de 3 Trainers.", true);
      return;
    }

    if (this.slotsElement) {
      this.slotsElement.hidden = true;
    }

    if (this.creationElement) {
      this.creationElement.hidden = false;
    }
  }

  private closeCreatePanel(): void {
    if (this.creationElement) {
      this.creationElement.hidden = true;
    }

    if (this.slotsElement) {
      this.slotsElement.hidden = false;
    }
  }

  private setStatus(
    message: string,

    isError = false
  ): void {
    if (!this.statusElement) {
      return;
    }

    this.statusElement.textContent = message;
    this.statusElement.classList.toggle("is-error", isError);
  }

  private enterWorld(trainer: AccountTrainer): void {
    selectedTrainerStore.select(trainer);

    this.scene.start(WORLD_LOADING_SCENE_KEY, {
      avatarId: trainer.avatarId,
    });
  }
}
