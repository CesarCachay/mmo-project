import Phaser from "phaser";
import "./style.css";

import { GAME_HEIGHT, GAME_WIDTH } from "@cesar-mmo/shared";

import { GameScene } from "./game/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: GAME_WIDTH,
  height: GAME_HEIGHT,

  backgroundColor: "#1e1e1e",

  scene: [GameScene],
};

new Phaser.Game(config);
