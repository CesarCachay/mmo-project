import Phaser from "phaser";

import { GameViewportOverlay } from "../../shell/GameViewportOverlay";

import {
  GAME_SCENE_KEY,
  WORLD_BOOT_ABORTED_EVENT,
  WORLD_LOADING_SCENE_KEY,
  WORLD_READY_EVENT,
} from "./world-loading.contract";

import type { WorldEntryData, WorldReadyPayload } from "./world-loading.contract";

type GameSceneModule = typeof import("../GameScene");

let gameSceneModulePromise: Promise<GameSceneModule> | undefined;

async function loadGameSceneModule(): Promise<GameSceneModule> {
  gameSceneModulePromise ??= import("../GameScene");

  try {
    return await gameSceneModulePromise;
  } catch (error: unknown) {
    /*
     * Permite reintentar si la descarga
     * dinámica falló por un problema de red.
     */
    gameSceneModulePromise = undefined;

    throw error;
  }
}

export class WorldLoadingScene extends Phaser.Scene {
  private entryData?: WorldEntryData;

  private viewportOverlay?: GameViewportOverlay;

  private messageElement?: HTMLParagraphElement;

  private hasWorldReady = false;

  private isShuttingDown = false;

  constructor() {
    super(WORLD_LOADING_SCENE_KEY);
  }

  init(data: WorldEntryData): void {
    this.entryData = data;

    this.hasWorldReady = false;

    this.isShuttingDown = false;
  }

  create(): void {
    if (!this.entryData) {
      throw new Error("WorldLoadingScene requires world entry data");
    }

    this.input.keyboard?.disableGlobalCapture();

    this.createLoadingUi();

    this.game.events.once(WORLD_READY_EVENT, this.handleWorldReady, this);

    this.game.events.once(WORLD_BOOT_ABORTED_EVENT, this.handleWorldBootAborted, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    void this.loadAndLaunchGameScene();
  }

  private createLoadingUi(): void {
    const panel = document.createElement("section");

    panel.className = "world-loading-panel";

    panel.setAttribute("role", "status");

    panel.setAttribute("aria-live", "polite");

    panel.innerHTML = `
      <div
        class="world-loading-panel__spinner"
        aria-hidden="true"
      ></div>

      <p class="world-loading-panel__eyebrow">
        CESAR MMO EDITION
      </p>

      <h1 class="world-loading-panel__title">
        Entrando al mundo...
      </h1>

      <p
        class="world-loading-panel__message"
        data-world-loading-message
      >
        Cargando runtime del mundo...
      </p>
    `;

    this.messageElement =
      panel.querySelector<HTMLParagraphElement>("[data-world-loading-message]") ??
      undefined;

    this.viewportOverlay = new GameViewportOverlay("world-loading-scene-overlay");

    this.viewportOverlay.mount(panel);
  }

  private async loadAndLaunchGameScene(): Promise<void> {
    const entryData = this.entryData;

    if (!entryData) {
      return;
    }

    try {
      const registeredGameScene = this.game.scene.getScene(GAME_SCENE_KEY);

      /*
       * Primera entrada al mundo:
       *
       * GameScene todavía no existe
       * en el SceneManager.
       */
      if (!registeredGameScene) {
        this.setLoadingMessage("Cargando runtime del mundo...");

        const { GameScene } = await loadGameSceneModule();

        /*
         * WorldLoadingScene pudo haberse
         * cerrado mientras importábamos
         * el chunk.
         */
        if (this.isShuttingDown) {
          return;
        }

        /*
         * Protección contra registro doble.
         */
        if (!this.game.scene.getScene(GAME_SCENE_KEY)) {
          this.scene.add(GAME_SCENE_KEY, GameScene, false);
        }
      }

      if (this.isShuttingDown) {
        return;
      }

      this.setLoadingMessage("Preparando mapa, Trainer y conexión multijugador...");

      this.scene.launch(GAME_SCENE_KEY, entryData);
    } catch (error: unknown) {
      console.error("Could not lazy-load GameScene", error);

      if (this.isShuttingDown) {
        return;
      }

      this.scene.start("TrainerSelectionScene", {
        errorMessage:
          "No se pudo cargar el mundo. Verifica tu conexión e inténtalo nuevamente.",
      });
    }
  }

  private setLoadingMessage(message: string): void {
    if (this.messageElement) {
      this.messageElement.textContent = message;
    }
  }

  private handleWorldReady(_payload: WorldReadyPayload): void {
    this.hasWorldReady = true;

    this.scene.stop(WORLD_LOADING_SCENE_KEY);
  }

  private handleWorldBootAborted(): void {
    if (this.hasWorldReady) {
      return;
    }

    this.scene.stop(WORLD_LOADING_SCENE_KEY);
  }

  private handleShutdown(): void {
    this.isShuttingDown = true;

    this.game.events.off(WORLD_READY_EVENT, this.handleWorldReady, this);

    this.game.events.off(WORLD_BOOT_ABORTED_EVENT, this.handleWorldBootAborted, this);

    this.viewportOverlay?.destroy();

    this.viewportOverlay = undefined;

    this.messageElement = undefined;

    this.entryData = undefined;
  }
}
