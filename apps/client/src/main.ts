import Phaser from "phaser";
import "./style.css";

import { GameScene } from "./game/GameScene";

import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./game/game.constants";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,

  backgroundColor: "#1e1e1e",

  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },

  scene: [GameScene],
};

new Phaser.Game(config);
