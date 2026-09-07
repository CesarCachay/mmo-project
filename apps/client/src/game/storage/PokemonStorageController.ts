import type {
  PokemonStorageCommand,
  PokemonStorageErrorPayload,
  PokemonStorageStatePayload,
} from "@cesar-mmo/shared";

import { PokemonStoragePanel } from "./ui/PokemonStoragePanel";

export interface PokemonStorageControllerOptions {
  openStorage: (terminalId: string) => void;

  closeStorage: () => void;

  sendCommand: (command: PokemonStorageCommand) => void;
}

export class PokemonStorageController {
  private readonly panel: PokemonStoragePanel;

  private readonly options: PokemonStorageControllerOptions;

  private opening = false;

  constructor(options: PokemonStorageControllerOptions) {
    this.options = options;

    this.panel = new PokemonStoragePanel({
      onWithdraw: (pokemonInstanceId) => {
        this.submit({
          type: "withdraw",
          pokemonInstanceId,
        });
      },

      onDeposit: (pokemonInstanceId) => {
        this.submit({
          type: "deposit",
          pokemonInstanceId,
        });
      },

      onSwap: (storedPokemonInstanceId, partyPokemonInstanceId) => {
        this.submit({
          type: "swap",
          storedPokemonInstanceId,
          partyPokemonInstanceId,
        });
      },

      onClose: () => {
        this.close();
      },
    });
  }

  public get isVisible(): boolean {
    return this.panel.isVisible;
  }

  public get isBlockingGameplay(): boolean {
    return this.opening || this.panel.isVisible;
  }

  public requestOpen(terminalId: string): void {
    if (this.opening || this.panel.isVisible) {
      return;
    }

    this.opening = true;

    this.options.openStorage(terminalId);
  }

  public applyState(payload: PokemonStorageStatePayload): void {
    this.opening = false;

    this.panel.setState(payload);

    this.panel.show();
  }

  public applyError(payload: PokemonStorageErrorPayload): void {
    this.opening = false;

    this.panel.setPending(false);

    /*
     * El acceso dejó de ser válido.
     *
     * Ejemplos:
     * - demasiado lejos
     * - Battle
     * - invalid session
     */
    if (payload.code === "STORAGE_NOT_AVAILABLE") {
      this.panel.hide();

      return;
    }

    /*
     * Errores de command:
     *
     * PARTY_FULL
     * LAST_PARTY_POKEMON
     * STALE_COMMAND
     * INVALID_POKEMON
     *
     * mantienen la PC abierta.
     */
    this.panel.setError(payload.message);
  }

  public dismiss(): void {
    this.opening = false;

    this.panel.hide();
  }

  public destroy(): void {
    this.panel.destroy();
  }

  private close(): void {
    if (!this.opening && !this.panel.isVisible) {
      return;
    }

    this.options.closeStorage();

    this.dismiss();
  }

  private submit(command: PokemonStorageCommand): void {
    if (!this.panel.isVisible) {
      return;
    }

    this.panel.setError();
    this.panel.setPending(true);
    this.options.sendCommand(command);
  }
}
