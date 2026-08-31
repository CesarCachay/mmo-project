import Phaser from "phaser";

import type { PokemonBattleStartedPayload } from "@cesar-mmo/shared";

export class BattleDebugPanel {
  private readonly scene: Phaser.Scene;

  private container: Phaser.GameObjects.Container | undefined;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(payload: PokemonBattleStartedPayload): void {
    this.hide();

    const trainerParticipant = payload.battle.participants.find(
      (participant) => participant.type === "trainer"
    );

    const wildParticipant = payload.battle.participants.find(
      (participant) => participant.type === "wild"
    );

    if (!trainerParticipant || !wildParticipant) {
      console.warn("[BattleDebugPanel] Invalid battle participants", payload.battle);

      return;
    }

    const trainerPokemon =
      trainerParticipant.pokemon[trainerParticipant.activePokemonIndex];

    const wildPokemon = wildParticipant.pokemon[wildParticipant.activePokemonIndex];

    if (!trainerPokemon || !wildPokemon) {
      console.warn("[BattleDebugPanel] Active Pokémon not found", payload.battle);
      return;
    }

    const camera = this.scene.cameras.main;
    const container = this.scene.add.container(camera.width / 2, camera.height / 2);
    container.setScrollFactor(0).setDepth(10_000);
    const background = this.scene.add.rectangle(0, 0, 440, 240, 0x111827, 0.96);
    background.setStrokeStyle(2, 0xffffff, 0.75);

    const title = this.scene.add.text(0, -88, "WILD BATTLE", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold",
    });

    title.setOrigin(0.5);

    const trainerLabel = this.scene.add.text(
      -150,
      -20,
      [
        "YOUR POKÉMON",
        `#${trainerPokemon.pokemon.speciesId}`,
        `Lv. ${trainerPokemon.pokemon.level}`,
        `HP: ${trainerPokemon.currentHp}`,
      ],
      {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        align: "center",
      }
    );

    trainerLabel.setOrigin(0.5);

    const versus = this.scene.add.text(0, -10, "VS", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      fontStyle: "bold",
    });

    versus.setOrigin(0.5);

    const wildLabel = this.scene.add.text(
      150,
      -20,
      [
        "WILD POKÉMON",
        `#${wildPokemon.pokemon.speciesId}`,
        `Lv. ${wildPokemon.pokemon.level}`,
        `HP: ${wildPokemon.currentHp}`,
      ],
      {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        align: "center",
      }
    );

    wildLabel.setOrigin(0.5);

    const battleId = this.scene.add.text(
      0,
      88,
      `Battle ${payload.battle.battleId.slice(0, 8)}`,
      {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#9ca3af",
      }
    );

    battleId.setOrigin(0.5);
    container.add([background, title, trainerLabel, versus, wildLabel, battleId]);
    this.container = container;
  }

  hide(): void {
    if (!this.container) {
      return;
    }

    this.container.destroy(true);
    this.container = undefined;
  }

  destroy(): void {
    this.hide();
  }
}
