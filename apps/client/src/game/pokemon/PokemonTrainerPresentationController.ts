import Phaser from "phaser";

import type { Direction, PokemonInstance, PokemonTrainerState } from "@cesar-mmo/shared";

import { PokemonFollowerController } from "./PokemonFollowerController";
import { PokemonOverworldSpriteLoader } from "./PokemonOverworldSpriteLoader";
import { PokemonSpriteLoader } from "./PokemonSpriteLoader";

import type { TrainerPanelController } from "../ui/TrainerPanelController";

export interface PokemonTrainerPresentationControllerOptions {
  readonly pokemonSpriteLoader: PokemonSpriteLoader;
  readonly pokemonOverworldSpriteLoader: PokemonOverworldSpriteLoader;
  readonly trainerPanelController: TrainerPanelController;
  readonly onPartyPresenceChanged: (hasParty: boolean) => void;
  readonly getPlayerPresentationState: () => {
    readonly x: number;
    readonly y: number;
    readonly direction: Direction;
  };
}

export class PokemonTrainerPresentationController {
  private readonly pokemonSpriteLoader: PokemonSpriteLoader;
  private readonly pokemonOverworldSpriteLoader: PokemonOverworldSpriteLoader;
  private readonly trainerPanelController: TrainerPanelController;
  private readonly pokemonFollowerController: PokemonFollowerController;
  private readonly onPartyPresenceChanged: (hasParty: boolean) => void;
  private readonly getPlayerPresentationState: PokemonTrainerPresentationControllerOptions["getPlayerPresentationState"];

  /* Último TRAINER_STATE recibido */
  private trainerState?: PokemonTrainerState;

  constructor(scene: Phaser.Scene, options: PokemonTrainerPresentationControllerOptions) {
    this.pokemonSpriteLoader = options.pokemonSpriteLoader;
    this.pokemonOverworldSpriteLoader = options.pokemonOverworldSpriteLoader;
    this.trainerPanelController = options.trainerPanelController;
    this.onPartyPresenceChanged = options.onPartyPresenceChanged;
    this.pokemonFollowerController = new PokemonFollowerController(scene);
    this.getPlayerPresentationState = options.getPlayerPresentationState;
  }

  public get canChooseStarter(): boolean {
    if (!this.trainerState) {
      return false;
    }
    return this.trainerState.party.pokemon.length === 0;
  }

  public async applyTrainerState(trainerState: PokemonTrainerState): Promise<void> {
    /* Esta asignación debe ocurrir ANTES de cualquier await */
    this.trainerState = trainerState;
    this.trainerPanelController.setInventory(trainerState.inventory);

    const party = trainerState.party.pokemon;
    const hasParty = party.length > 0;
    this.onPartyPresenceChanged(hasParty);

    if (!hasParty) {
      this.trainerPanelController.setParty([]);
      this.pokemonFollowerController.destroy();
      return;
    }

    try {
      await this.pokemonSpriteLoader.ensurePartyLoaded(party);

      /* Mientras Phaser cargaba las texturas pudo llegar otro TRAINER_STATE */
      if (this.trainerState !== trainerState) {
        return;
      }

      this.trainerPanelController.setParty(party);
    } catch (error) {
      console.error("[Pokemon Party] Failed to prepare party presentation", error);
      return;
    }

    const firstPokemon = party[0];

    if (!firstPokemon) {
      this.pokemonFollowerController.destroy();

      return;
    }

    await this.prepareFollower(trainerState, firstPokemon);
  }

  public updateFollower(
    playerX: number,
    playerY: number,
    playerDirection: Direction,
    delta: number
  ): void {
    this.pokemonFollowerController.update(playerX, playerY, playerDirection, delta);
  }

  public resetFollowerToPlayerPosition(
    playerX: number,
    playerY: number,
    playerDirection: Direction
  ): void {
    this.pokemonFollowerController.resetToPlayerPosition(
      playerX,
      playerY,
      playerDirection
    );
  }

  public destroy(): void {
    this.trainerState = undefined;
    this.pokemonFollowerController.destroy();
  }

  private async prepareFollower(
    trainerState: PokemonTrainerState,
    pokemon: PokemonInstance
  ): Promise<void> {
    try {
      await this.pokemonOverworldSpriteLoader.ensurePokemonLoaded(pokemon);

      /* Primera protección: el snapshot completo sigue siendo el último estado recibido */
      if (this.trainerState !== trainerState) {
        return;
      }

      /* Segunda protección: incluso dentro del mismo flujo, position 0 debe seguir correspondiendo al mismo Pokémon */
      const currentFirstPokemon = this.trainerState.party.pokemon[0];

      if (!currentFirstPokemon || currentFirstPokemon.instanceId !== pokemon.instanceId) {
        return;
      }

      const player = this.getPlayerPresentationState();

      this.pokemonFollowerController.create(
        pokemon,
        player.x,
        player.y,
        player.direction
      );

      /* La posición actual del jugador se obtiene mediante getPlayerPresentationState() */
    } catch (error) {
      console.error("[Pokemon Follower] Failed to prepare follower", error);
      this.pokemonFollowerController.destroy();
      return;
    }
  }
}
